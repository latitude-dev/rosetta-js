/**
 * VercelAI Provider E2E Tests
 *
 * Tests translating Vercel AI SDK format messages to/from GenAI.
 * Includes real API tests (when OPENAI_API_KEY is set) and hardcoded tests.
 */

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Provider, Translator, translate } from "rosetta-ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const hasApiKey = !!process.env.OPENAI_API_KEY;

describe("VercelAI E2E", () => {
  describe.skipIf(!hasApiKey)("real Vercel AI SDK calls", { timeout: 30000 }, () => {
    it("should translate a real Vercel AI SDK response", async () => {
      const { text, response } = await generateText({
        model: openai("gpt-4o-mini"),
        messages: [
          { role: "system", content: "You are a helpful assistant. Reply in one sentence." },
          { role: "user", content: "What is 2+2?" },
        ],
        maxOutputTokens: 50,
      });

      expect(text).toBeTruthy();

      // Get the response messages
      const responseMessages = response.messages;
      expect(responseMessages.length).toBeGreaterThan(0);

      // Translate the response messages
      const result = translate(responseMessages, {
        from: Provider.VercelAI,
        to: Provider.GenAI,
      });

      expect(result.messages.length).toBeGreaterThan(0);
    });

    it("should translate a full conversation with real API", async () => {
      // Test that we can translate a user message plus the API response
      const userMessage = { role: "user" as const, content: "Say hello in exactly 3 words." };

      const { response } = await generateText({
        model: openai("gpt-4o-mini"),
        system: "You are a helpful assistant.",
        messages: [userMessage],
        maxOutputTokens: 20,
      });

      // Combine user message with response messages to get full conversation
      const fullConversation = [userMessage, ...response.messages];

      // Translate the full conversation
      const result = translate(fullConversation, {
        from: Provider.VercelAI,
        to: Provider.GenAI,
      });

      expect(result.messages.length).toBeGreaterThanOrEqual(2);
      // Check that we have user and assistant messages
      const roles = result.messages.map((m) => m.role);
      expect(roles).toContain("user");
      expect(roles).toContain("assistant");
    });

    it("should translate tool calls from real API", async () => {
      const { response } = await generateText({
        model: openai("gpt-4o-mini"),
        messages: [{ role: "user", content: "What's the weather in Paris?" }],
        tools: {
          get_weather: {
            description: "Get the current weather for a location",
            inputSchema: z.object({
              location: z.string().describe("The city name"),
            }),
          },
        },
        toolChoice: "required",
        maxOutputTokens: 100,
      });

      // Translate all messages
      const result = translate(response.messages, {
        from: Provider.VercelAI,
        to: Provider.GenAI,
      });

      // Should have assistant message with tool call
      const assistantMsg = result.messages.find((m) => m.role === "assistant");
      expect(assistantMsg).toBeDefined();

      // Check for tool_call part
      const toolCallPart = assistantMsg?.parts.find((p) => p.type === "tool_call");
      expect(toolCallPart).toBeDefined();
      expect((toolCallPart as { name: string }).name).toBe("get_weather");
    });

    it("should translate real API response to Promptl format", async () => {
      const { response } = await generateText({
        model: openai("gpt-4o-mini"),
        messages: [{ role: "user", content: "Reply with exactly: Hello World" }],
        maxOutputTokens: 16,
      });

      const result = translate(response.messages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      expect(result.messages.length).toBeGreaterThan(0);
      const assistantMsg = result.messages.find((m) => m.role === "assistant");
      expect(assistantMsg).toBeDefined();
    });
  });

  describe("hardcoded messages (no API key required)", () => {
    it("should translate simple VercelAI messages to GenAI", () => {
      const vercelAIMessages = [
        { role: "system" as const, content: "You are a helpful assistant." },
        { role: "user" as const, content: "What is the capital of France?" },
        { role: "assistant" as const, content: "The capital of France is Paris." },
      ];

      const result = translate(vercelAIMessages, {
        from: Provider.VercelAI,
        to: Provider.GenAI,
      });

      // GenAI extracts system messages to the system field
      expect(result.system).toBeDefined();
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should translate image content", () => {
      const vercelAIMessages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "What's in this image?" },
            { type: "image" as const, image: "https://example.com/cat.jpg" },
          ],
        },
      ];

      const result = translate(vercelAIMessages, {
        from: Provider.VercelAI,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect(result.messages[0]?.parts[1]?.type).toBe("uri");
    });

    it("should translate tool calls", () => {
      const vercelAIMessages = [
        { role: "user" as const, content: "What's the weather in London?" },
        {
          role: "assistant" as const,
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "call_abc123",
              toolName: "get_weather",
              input: { location: "London", unit: "celsius" },
            },
          ],
        },
      ];

      const result = translate(vercelAIMessages, {
        from: Provider.VercelAI,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);

      const toolCallMsg = result.messages[1];
      expect(toolCallMsg?.role).toBe("assistant");
      expect(toolCallMsg?.parts[0]?.type).toBe("tool_call");
      const toolCallPart = toolCallMsg?.parts[0] as { name: string; arguments: unknown };
      expect(toolCallPart.name).toBe("get_weather");
      expect(toolCallPart.arguments).toEqual({ location: "London", unit: "celsius" });
    });

    it("should translate tool results", () => {
      const vercelAIMessages = [
        {
          role: "tool" as const,
          content: [
            {
              type: "tool-result" as const,
              toolCallId: "call_abc123",
              toolName: "get_weather",
              output: { type: "json" as const, value: { temperature: 15, condition: "cloudy" } },
            },
          ],
        },
      ];

      const result = translate(vercelAIMessages, {
        from: Provider.VercelAI,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      const toolMsg = result.messages[0];
      expect(toolMsg?.role).toBe("tool");
      expect(toolMsg?.parts[0]?.type).toBe("tool_call_response");
    });

    it("should translate reasoning content", () => {
      const vercelAIMessages = [
        {
          role: "assistant" as const,
          content: [
            { type: "reasoning" as const, text: "Let me think about this..." },
            { type: "text" as const, text: "The answer is 42." },
          ],
        },
      ];

      const result = translate(vercelAIMessages, {
        from: Provider.VercelAI,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]?.type).toBe("reasoning");
      expect(result.messages[0]?.parts[1]?.type).toBe("text");
    });

    it("should auto-detect VercelAI format", () => {
      const vercelAIMessages = [
        { role: "system" as const, content: "You are helpful." },
        { role: "user" as const, content: "Hello" },
      ];

      // No explicit 'from' - should auto-infer
      const result = translate(vercelAIMessages);

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it("should translate VercelAI to Promptl via GenAI", () => {
      const vercelAIMessages = [
        { role: "system" as const, content: "You are a helpful assistant." },
        { role: "user" as const, content: "Hello!" },
        { role: "assistant" as const, content: "Hi there!" },
      ];

      const result = translate(vercelAIMessages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[1]?.role).toBe("user");
      expect(result.messages[2]?.role).toBe("assistant");
    });

    it("should round-trip VercelAI -> GenAI -> VercelAI", () => {
      const original = [
        { role: "system" as const, content: "You are helpful." },
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" },
      ];

      // VercelAI -> GenAI
      const genAI = translate(original, {
        from: Provider.VercelAI,
        to: Provider.GenAI,
      });

      // GenAI extracts system to separate field, so we need to pass it back
      // GenAI -> VercelAI (include system)
      const backToVercelAI = translate(genAI.messages, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
        system: genAI.system,
      });

      expect(backToVercelAI.messages).toHaveLength(3);
      expect(backToVercelAI.messages[0]?.content).toBe("You are helpful.");
      expect(backToVercelAI.messages[1]?.content).toBe("Hello");
      expect(backToVercelAI.messages[2]?.content).toBe("Hi there!");
    });
  });

  describe("Promptl to VercelAI translation", () => {
    it("should translate simple Promptl conversation to VercelAI", () => {
      const promptlMessages = [
        { role: "system" as const, content: [{ type: "text" as const, text: "You are helpful." }] },
        { role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] },
        { role: "assistant" as const, content: [{ type: "text" as const, text: "Hi there!" }] },
      ];

      const result = translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
      });

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[1]?.role).toBe("user");
      expect(result.messages[2]?.role).toBe("assistant");
    });

    it("should translate Promptl tool calls to VercelAI format", () => {
      const promptlMessages = [
        { role: "user" as const, content: [{ type: "text" as const, text: "What's the weather?" }] },
        {
          role: "assistant" as const,
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "call_123",
              toolName: "get_weather",
              args: { location: "Paris" },
            },
          ],
        },
        {
          role: "tool" as const,
          toolName: "get_weather",
          toolId: "call_123",
          content: [{ type: "text" as const, text: '{"temp": 20}' }],
        },
      ];

      const result = translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
      });

      // Verify VercelAI format structure
      expect(result.messages).toHaveLength(3);
      const toolCallMsg = result.messages[1];
      const content = toolCallMsg?.content as Array<{ type: string; toolName: string }>;
      expect(content[0]?.type).toBe("tool-call");
      expect(content[0]?.toolName).toBe("get_weather");
    });

    it("should translate Promptl images to VercelAI format", () => {
      const promptlMessages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "What's in this image?" },
            { type: "image" as const, image: "https://example.com/cat.jpg" },
          ],
        },
      ];

      const result = translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
      });

      const content = result.messages[0]?.content as Array<{ type: string }>;
      expect(content[1]?.type).toBe("image");
    });

    it("should translate Promptl reasoning content to VercelAI", () => {
      const promptlMessages = [
        {
          role: "assistant" as const,
          content: [
            { type: "reasoning" as const, text: "Let me think about this..." },
            { type: "text" as const, text: "The answer is 42." },
          ],
        },
      ];

      const result = translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
      });

      const content = result.messages[0]?.content as Array<{ type: string }>;
      expect(content[0]?.type).toBe("reasoning");
      expect(content[1]?.type).toBe("text");
    });
  });

  describe("VercelAI to Promptl translation", () => {
    it("should translate simple VercelAI conversation to Promptl", () => {
      const vercelAIMessages = [
        { role: "system" as const, content: "You are helpful." },
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" },
      ];

      const result = translate(vercelAIMessages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[1]?.role).toBe("user");
      expect(result.messages[2]?.role).toBe("assistant");
    });

    it("should translate VercelAI multimodal content to Promptl", () => {
      const vercelAIMessages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "What's in this image?" },
            { type: "image" as const, image: "https://example.com/cat.jpg" },
          ],
        },
      ];

      const result = translate(vercelAIMessages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      const content = result.messages[0]?.content as Array<{ type: string }>;
      expect(content).toHaveLength(2);
      expect(content[0]?.type).toBe("text");
      expect(content[1]?.type).toBe("image");
    });

    it("should translate VercelAI tool calls to Promptl format", () => {
      const vercelAIMessages = [
        { role: "user" as const, content: "What's the weather?" },
        {
          role: "assistant" as const,
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "call_123",
              toolName: "get_weather",
              input: { location: "Paris" },
            },
          ],
        },
        {
          role: "tool" as const,
          content: [
            {
              type: "tool-result" as const,
              toolCallId: "call_123",
              toolName: "get_weather",
              output: { type: "json" as const, value: { temp: 20 } },
            },
          ],
        },
      ];

      const result = translate(vercelAIMessages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      // Verify Promptl format structure
      const toolCallContent = result.messages[1]?.content as Array<{ type: string; toolName?: string }>;
      expect(toolCallContent[0]?.type).toBe("tool-call");
      expect(toolCallContent[0]?.toolName).toBe("get_weather");

      const toolResultMsg = result.messages[2];
      expect(toolResultMsg?.role).toBe("tool");
    });

    it("should translate VercelAI reasoning to Promptl format", () => {
      const vercelAIMessages = [
        {
          role: "assistant" as const,
          content: [
            { type: "reasoning" as const, text: "Let me think..." },
            { type: "text" as const, text: "The answer is 42." },
          ],
        },
      ];

      const result = translate(vercelAIMessages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      const content = result.messages[0]?.content as Array<{ type: string }>;
      expect(content[0]?.type).toBe("reasoning");
      expect(content[1]?.type).toBe("text");
    });

    it("should round-trip Promptl -> VercelAI -> Promptl", () => {
      const originalPromptl = [
        { role: "system" as const, content: [{ type: "text" as const, text: "You are helpful." }] },
        { role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] },
        {
          role: "assistant" as const,
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "call_1",
              toolName: "greet",
              args: { name: "World" },
            },
          ],
        },
      ];

      // Promptl -> VercelAI
      const vercelAI = translate(originalPromptl, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
      });

      // VercelAI -> Promptl
      const backToPromptl = translate(vercelAI.messages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      expect(backToPromptl.messages).toHaveLength(3);
      expect((backToPromptl.messages[2]?.content[0] as { toolName: string }).toolName).toBe("greet");
    });
  });

  describe("metadata preservation (Promptl -> VercelAI with _promptlSourceMap)", () => {
    const sourceMap = [{ start: 0, end: 10, identifier: "test" }];

    describe("passthrough mode", () => {
      const translator = new Translator({ providerMetadata: "passthrough" });

      it("should preserve _promptlSourceMap on user message when translating Promptl to VercelAI", () => {
        const promptlMessages = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: "Hello", _promptlSourceMap: sourceMap }],
          },
        ];

        const result = translator.translate(promptlMessages, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // Content should be array to preserve part metadata
        expect(Array.isArray(result.messages[0]?.content)).toBe(true);
        const content = result.messages[0]?.content as Array<{
          type: string;
          text: string;
          _promptlSourceMap?: unknown;
        }>;
        expect(content[0]?._promptlSourceMap).toEqual(sourceMap);
      });

      it("should lose _promptlSourceMap on system message in passthrough mode (string content)", () => {
        const promptlMessages = [
          {
            role: "system" as const,
            content: [{ type: "text" as const, text: "Be helpful", _promptlSourceMap: sourceMap }],
          },
        ];

        const result = translator.translate(promptlMessages, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // System message uses string content, no parts to apply metadata to
        // In passthrough mode, _partsMetadata is stripped (not spread), so metadata is lost
        expect(result.messages[0]?.content).toBe("Be helpful");
        expect((result.messages[0] as { _promptlSourceMap?: unknown })._promptlSourceMap).toBeUndefined();
      });

      it("should preserve _promptlSourceMap on assistant message when translating Promptl to VercelAI", () => {
        const promptlMessages = [
          {
            role: "assistant" as const,
            content: [{ type: "text" as const, text: "Response", _promptlSourceMap: sourceMap }],
          },
        ];

        const result = translator.translate(promptlMessages, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // Content should be array to preserve part metadata
        expect(Array.isArray(result.messages[0]?.content)).toBe(true);
        const content = result.messages[0]?.content as Array<{
          type: string;
          text: string;
          _promptlSourceMap?: unknown;
        }>;
        expect(content[0]?._promptlSourceMap).toEqual(sourceMap);
      });
    });

    describe("preserve mode", () => {
      const translator = new Translator({ providerMetadata: "preserve" });

      it("should preserve _promptlSourceMap in _providerMetadata on user message", () => {
        const promptlMessages = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: "Hello", _promptlSourceMap: sourceMap }],
          },
        ];

        const result = translator.translate(promptlMessages, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // Content should be array to preserve part metadata
        expect(Array.isArray(result.messages[0]?.content)).toBe(true);
        const content = result.messages[0]?.content as Array<{
          type: string;
          text: string;
          _providerMetadata?: { _promptlSourceMap?: unknown };
        }>;
        expect(content[0]?._providerMetadata?._promptlSourceMap).toEqual(sourceMap);
      });

      it("should preserve _promptlSourceMap in _providerMetadata._partsMetadata on system message", () => {
        const promptlMessages = [
          {
            role: "system" as const,
            content: [{ type: "text" as const, text: "Be helpful", _promptlSourceMap: sourceMap }],
          },
        ];

        const result = translator.translate(promptlMessages, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // System message uses string content, part metadata is stored in _partsMetadata
        expect(result.messages[0]?.content).toBe("Be helpful");
        expect(
          (result.messages[0] as { _providerMetadata?: { _partsMetadata?: { _promptlSourceMap?: unknown } } })
            ._providerMetadata?._partsMetadata?._promptlSourceMap,
        ).toEqual(sourceMap);
      });
    });
  });

  describe("round-trip metadata preservation (Promptl -> VercelAI -> Promptl)", () => {
    const sourceMap = [{ start: 15, end: 25, identifier: "color" }];

    describe("passthrough mode", () => {
      const translator = new Translator({ providerMetadata: "passthrough" });

      it("should preserve _promptlSourceMap through full round-trip for user message", () => {
        const originalPromptl = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: "Why is the sky ?", _promptlSourceMap: sourceMap }],
          },
        ];

        // Promptl -> VercelAI (passthrough)
        const vercelAI = translator.translate(originalPromptl, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // Verify metadata is on VercelAI message
        const vercelContent = vercelAI.messages[0]?.content as Array<{ _promptlSourceMap?: unknown }>;
        expect(vercelContent[0]?._promptlSourceMap).toEqual(sourceMap);

        // VercelAI -> Promptl (passthrough)
        const backToPromptl = translator.translate(vercelAI.messages, {
          from: Provider.VercelAI,
          to: Provider.Promptl,
        });

        // Verify metadata survives full round-trip
        const promptlContent = backToPromptl.messages[0]?.content as Array<{ _promptlSourceMap?: unknown }>;
        expect(promptlContent[0]?._promptlSourceMap).toEqual(sourceMap);
      });

      it("should lose _promptlSourceMap through round-trip for system message in passthrough mode", () => {
        const systemSourceMap = [{ start: 30, end: 30, identifier: "mode" }];
        const originalPromptl = [
          {
            role: "system" as const,
            content: [
              { type: "text" as const, text: "Answer the following question :", _promptlSourceMap: systemSourceMap },
            ],
          },
        ];

        // Promptl -> VercelAI (passthrough)
        const vercelAI = translator.translate(originalPromptl, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // System uses string content, _partsMetadata is stripped in passthrough, so metadata is lost
        expect((vercelAI.messages[0] as { _promptlSourceMap?: unknown })._promptlSourceMap).toBeUndefined();

        // VercelAI -> Promptl (passthrough)
        const backToPromptl = translator.translate(vercelAI.messages, {
          from: Provider.VercelAI,
          to: Provider.Promptl,
        });

        // Metadata was lost in the Promptl -> VercelAI step
        const sysMsg = backToPromptl.messages[0];
        const msgLevelMeta = (sysMsg as { _promptlSourceMap?: unknown })._promptlSourceMap;
        const contentLevelMeta = (sysMsg?.content[0] as { _promptlSourceMap?: unknown })?._promptlSourceMap;
        expect(msgLevelMeta ?? contentLevelMeta).toBeUndefined();
      });

      it("should semi-preserve _promptlSourceMap through full round-trip for conversation", () => {
        const systemMap = [{ start: 30, end: 30, identifier: "mode" }];
        const userMap = [{ start: 15, end: 15, identifier: "color" }];

        const originalPromptl = [
          {
            role: "system" as const,
            content: [{ type: "text" as const, text: "Answer the following question :", _promptlSourceMap: systemMap }],
          },
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: "Why is the sky ?", _promptlSourceMap: userMap }],
          },
        ];

        // Promptl -> VercelAI (passthrough)
        const vercelAI = translator.translate(originalPromptl, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // VercelAI -> Promptl (passthrough)
        const backToPromptl = translator.translate(vercelAI.messages, {
          from: Provider.VercelAI,
          to: Provider.Promptl,
        });

        expect(backToPromptl.messages).toHaveLength(2);

        // Check system message metadata
        const systemContent = backToPromptl.messages[0]?.content as Array<{ _promptlSourceMap?: unknown }>;
        expect(systemContent[0]?._promptlSourceMap).toBeUndefined();

        // Check user message metadata
        const userContent = backToPromptl.messages[1]?.content as Array<{ _promptlSourceMap?: unknown }>;
        expect(userContent[0]?._promptlSourceMap).toEqual(userMap);
      });
    });

    describe("preserve mode", () => {
      const translator = new Translator({ providerMetadata: "preserve" });

      it("should preserve _promptlSourceMap through full round-trip for user message", () => {
        const originalPromptl = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: "Why is the sky ?", _promptlSourceMap: sourceMap }],
          },
        ];

        // Promptl -> VercelAI (preserve)
        const vercelAI = translator.translate(originalPromptl, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // Verify metadata is in _providerMetadata on VercelAI message
        const vercelContent = vercelAI.messages[0]?.content as Array<{
          _providerMetadata?: { _promptlSourceMap?: unknown };
        }>;
        expect(vercelContent[0]?._providerMetadata?._promptlSourceMap).toEqual(sourceMap);

        // VercelAI -> Promptl (preserve)
        const backToPromptl = translator.translate(vercelAI.messages, {
          from: Provider.VercelAI,
          to: Provider.Promptl,
        });

        // Verify metadata survives full round-trip (in _providerMetadata)
        const promptlContent = backToPromptl.messages[0]?.content as Array<{
          _providerMetadata?: { _promptlSourceMap?: unknown };
        }>;
        expect(promptlContent[0]?._providerMetadata?._promptlSourceMap).toEqual(sourceMap);
      });

      it("should preserve _promptlSourceMap through full round-trip for system message", () => {
        const systemSourceMap = [{ start: 30, end: 30, identifier: "mode" }];
        const originalPromptl = [
          {
            role: "system" as const,
            content: [
              { type: "text" as const, text: "Answer the following question :", _promptlSourceMap: systemSourceMap },
            ],
          },
        ];

        // Promptl -> VercelAI (preserve)
        const vercelAI = translator.translate(originalPromptl, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // System uses string content, part metadata is stored in _providerMetadata._partsMetadata
        expect(
          (vercelAI.messages[0] as { _providerMetadata?: { _partsMetadata?: { _promptlSourceMap?: unknown } } })
            ._providerMetadata?._partsMetadata?._promptlSourceMap,
        ).toEqual(systemSourceMap);

        // VercelAI -> Promptl (preserve)
        const backToPromptl = translator.translate(vercelAI.messages, {
          from: Provider.VercelAI,
          to: Provider.Promptl,
        });

        // Metadata should be preserved at content level in _providerMetadata
        const sysMsg = backToPromptl.messages[0];
        const contentLevelMeta = (sysMsg?.content[0] as { _providerMetadata?: { _promptlSourceMap?: unknown } })
          ?._providerMetadata?._promptlSourceMap;
        expect(contentLevelMeta).toEqual(systemSourceMap);
      });
    });
  });

  describe("_partsMetadata round-trip (system messages)", () => {
    const sourceMap = [{ start: 30, end: 30, identifier: "mode" }];

    describe("passthrough mode", () => {
      const translator = new Translator({ providerMetadata: "passthrough" });

      it("should lose _promptlSourceMap for system messages in passthrough mode (no parts to restore to)", () => {
        const originalPromptl = [
          {
            role: "system" as const,
            content: [{ type: "text" as const, text: "Answer the following question:", _promptlSourceMap: sourceMap }],
          },
        ];

        // Promptl -> VercelAI
        const vercelAI = translator.translate(originalPromptl, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // System message uses string content, _partsMetadata is stripped in passthrough mode
        expect(typeof vercelAI.messages[0]?.content).toBe("string");
        expect((vercelAI.messages[0] as { _promptlSourceMap?: unknown })._promptlSourceMap).toBeUndefined();

        // VercelAI -> Promptl
        const backToPromptl = translator.translate(vercelAI.messages, {
          from: Provider.VercelAI,
          to: Provider.Promptl,
        });

        // Metadata was lost in the Promptl -> VercelAI step
        expect(backToPromptl.messages[0]?.content).toHaveLength(1);
        const content = backToPromptl.messages[0]?.content[0] as { _promptlSourceMap?: unknown };
        expect(content._promptlSourceMap).toBeUndefined();
      });
    });

    describe("preserve mode", () => {
      const translator = new Translator({ providerMetadata: "preserve" });

      it("should restore _promptlSourceMap from _partsMetadata to first content part after round-trip", () => {
        const originalPromptl = [
          {
            role: "system" as const,
            content: [{ type: "text" as const, text: "Answer the following question:", _promptlSourceMap: sourceMap }],
          },
        ];

        // Promptl -> VercelAI
        const vercelAI = translator.translate(originalPromptl, {
          from: Provider.Promptl,
          to: Provider.VercelAI,
        });

        // System message uses string content, so metadata is in _providerMetadata._partsMetadata at message level
        expect(typeof vercelAI.messages[0]?.content).toBe("string");
        const msgMeta = (
          vercelAI.messages[0] as { _providerMetadata?: { _partsMetadata?: { _promptlSourceMap?: unknown } } }
        )._providerMetadata;
        expect(msgMeta?._partsMetadata?._promptlSourceMap).toEqual(sourceMap);

        // VercelAI -> Promptl
        const backToPromptl = translator.translate(vercelAI.messages, {
          from: Provider.VercelAI,
          to: Provider.Promptl,
        });

        // Metadata should be restored to first content part inside _providerMetadata
        expect(backToPromptl.messages[0]?.content).toHaveLength(1);
        const content = backToPromptl.messages[0]?.content[0] as {
          _providerMetadata?: { _promptlSourceMap?: unknown };
        };
        expect(content._providerMetadata?._promptlSourceMap).toEqual(sourceMap);
      });
    });
  });

  describe("preserve-then-passthrough round-trip (Promptl -> VercelAI [preserve] -> Promptl [passthrough])", () => {
    it("should preserve user message metadata exactly through preserve-then-passthrough round-trip", () => {
      const sourceMap = [{ start: 0, end: 10, identifier: "test" }];
      const originalPromptl = [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "Hello", _promptlSourceMap: sourceMap }],
        },
      ];

      // Promptl -> VercelAI (preserve mode: stores metadata in _providerMetadata)
      const preserveTranslator = new Translator({ providerMetadata: "preserve" });
      const vercelAI = preserveTranslator.translate(originalPromptl, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
      });

      // VercelAI -> Promptl (passthrough mode: spreads _providerMetadata back to entity level)
      const passthroughTranslator = new Translator({ providerMetadata: "passthrough" });
      const backToPromptl = passthroughTranslator.translate(vercelAI.messages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      // The final message should have metadata at the same level as the original
      expect(backToPromptl.messages[0]?.content).toHaveLength(1);
      const finalContent = backToPromptl.messages[0]?.content[0] as { _promptlSourceMap?: unknown };
      expect(finalContent._promptlSourceMap).toEqual(sourceMap);
    });

    it("should preserve assistant message metadata exactly through preserve-then-passthrough round-trip", () => {
      const sourceMap = [{ start: 0, end: 15, identifier: "response" }];
      const originalPromptl = [
        {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "Hi there!", _promptlSourceMap: sourceMap }],
        },
      ];

      // Promptl -> VercelAI (preserve)
      const preserveTranslator = new Translator({ providerMetadata: "preserve" });
      const vercelAI = preserveTranslator.translate(originalPromptl, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
      });

      // VercelAI -> Promptl (passthrough)
      const passthroughTranslator = new Translator({ providerMetadata: "passthrough" });
      const backToPromptl = passthroughTranslator.translate(vercelAI.messages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      // The final message should have metadata at the same level as the original
      expect(backToPromptl.messages[0]?.content).toHaveLength(1);
      const finalContent = backToPromptl.messages[0]?.content[0] as { _promptlSourceMap?: unknown };
      expect(finalContent._promptlSourceMap).toEqual(sourceMap);
    });

    it("should preserve system message metadata through preserve-then-passthrough round-trip", () => {
      const sourceMap = [{ start: 0, end: 20, identifier: "system" }];
      const originalPromptl = [
        {
          role: "system" as const,
          content: [{ type: "text" as const, text: "Be helpful", _promptlSourceMap: sourceMap }],
        },
      ];

      // Promptl -> VercelAI (preserve)
      // System messages use string content, so part metadata is stored in _partsMetadata
      const preserveTranslator = new Translator({ providerMetadata: "preserve" });
      const vercelAI = preserveTranslator.translate(originalPromptl, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
      });

      // VercelAI -> Promptl (passthrough)
      // _partsMetadata is applied back to the first content part
      const passthroughTranslator = new Translator({ providerMetadata: "passthrough" });
      const backToPromptl = passthroughTranslator.translate(vercelAI.messages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      // The final message should have metadata restored to the content part
      expect(backToPromptl.messages[0]?.content).toHaveLength(1);
      const finalContent = backToPromptl.messages[0]?.content[0] as { _promptlSourceMap?: unknown };
      expect(finalContent._promptlSourceMap).toEqual(sourceMap);
    });

    it("should preserve full conversation metadata through preserve-then-passthrough round-trip", () => {
      const systemSourceMap = [{ start: 0, end: 10, identifier: "system" }];
      const userSourceMap = [{ start: 0, end: 5, identifier: "user" }];
      const assistantSourceMap = [{ start: 0, end: 8, identifier: "assistant" }];

      const originalPromptl = [
        {
          role: "system" as const,
          content: [{ type: "text" as const, text: "Be helpful", _promptlSourceMap: systemSourceMap }],
        },
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "Hello", _promptlSourceMap: userSourceMap }],
        },
        {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "Hi there!", _promptlSourceMap: assistantSourceMap }],
        },
      ];

      // Promptl -> VercelAI (preserve)
      const preserveTranslator = new Translator({ providerMetadata: "preserve" });
      const vercelAI = preserveTranslator.translate(originalPromptl, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
      });

      // VercelAI -> Promptl (passthrough)
      const passthroughTranslator = new Translator({ providerMetadata: "passthrough" });
      const backToPromptl = passthroughTranslator.translate(vercelAI.messages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      // All messages should have their metadata restored
      expect(backToPromptl.messages).toHaveLength(3);

      const systemContent = backToPromptl.messages[0]?.content[0] as { _promptlSourceMap?: unknown };
      expect(systemContent._promptlSourceMap).toEqual(systemSourceMap);

      const userContent = backToPromptl.messages[1]?.content[0] as { _promptlSourceMap?: unknown };
      expect(userContent._promptlSourceMap).toEqual(userSourceMap);

      const assistantContent = backToPromptl.messages[2]?.content[0] as { _promptlSourceMap?: unknown };
      expect(assistantContent._promptlSourceMap).toEqual(assistantSourceMap);
    });

    it("should preserve message-level metadata through preserve-then-passthrough round-trip", () => {
      const contentSourceMap = [{ start: 0, end: 5, identifier: "content" }];
      const originalPromptl = [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "Hello", _promptlSourceMap: contentSourceMap }],
          customField: "message-level-data",
        },
      ];

      // Promptl -> VercelAI (preserve)
      const preserveTranslator = new Translator({ providerMetadata: "preserve" });
      const vercelAI = preserveTranslator.translate(originalPromptl, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
      });

      // VercelAI -> Promptl (passthrough)
      const passthroughTranslator = new Translator({ providerMetadata: "passthrough" });
      const backToPromptl = passthroughTranslator.translate(vercelAI.messages, {
        from: Provider.VercelAI,
        to: Provider.Promptl,
      });

      // Both content-level and message-level metadata should be preserved
      const finalMessage = backToPromptl.messages[0] as { customField?: string; content: unknown[] };
      expect(finalMessage.customField).toBe("message-level-data");

      const finalContent = finalMessage.content[0] as { _promptlSourceMap?: unknown };
      expect(finalContent._promptlSourceMap).toEqual(contentSourceMap);
    });
  });
});
