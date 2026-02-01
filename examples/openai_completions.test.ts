/**
 * OpenAI Completions Provider E2E Tests
 *
 * Tests translating OpenAI Chat Completions format messages to GenAI.
 * Includes both hardcoded messages and real API calls (when OPENAI_API_KEY is set).
 * This is a source-only provider, so only toGenAI translations are tested.
 */

import OpenAI from "openai";
import { Provider, translate } from "rosetta-ai";
import { describe, expect, it } from "vitest";

const hasApiKey = !!process.env.OPENAI_API_KEY;

describe("OpenAI Completions E2E", () => {
  describe.skipIf(!hasApiKey)("real OpenAI API calls", { timeout: 30000 }, () => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    it("should translate a real OpenAI chat completion response", async () => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant. Reply in one sentence." },
          { role: "user", content: "What is 2+2?" },
        ],
        max_tokens: 50,
      });

      const assistantMessage = completion.choices[0]?.message;
      expect(assistantMessage).toBeDefined();
      if (!assistantMessage) throw new Error("No assistant message");

      // Translate the response message
      const result = translate([assistantMessage], {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect((result.messages[0]?.parts[0] as { content: string }).content).toBeTruthy();
    });

    it("should translate a full conversation with real API", async () => {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say hello in exactly 3 words." },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 20,
      });

      // Build full conversation including the response
      const fullConversation = [...messages, completion.choices[0]?.message].filter(
        Boolean,
      ) as OpenAI.ChatCompletionMessageParam[];

      const result = translate(fullConversation, {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      // System extracted to system field
      expect(result.system).toBeDefined();
      expect(result.messages).toHaveLength(2); // user + assistant
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should translate tool calls from real API", async () => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "What's the weather in Paris?" }],
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Get the current weather for a location",
              parameters: {
                type: "object",
                properties: {
                  location: { type: "string", description: "The city name" },
                },
                required: ["location"],
              },
            },
          },
        ],
        tool_choice: "required",
        max_tokens: 100,
      });

      const assistantMessage = completion.choices[0]?.message;
      expect(assistantMessage?.tool_calls).toBeDefined();
      expect(assistantMessage?.tool_calls?.length).toBeGreaterThan(0);
      if (!assistantMessage) throw new Error("No assistant message");

      const result = translate([assistantMessage], {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");

      const toolCallPart = result.messages[0]?.parts[0];
      expect(toolCallPart?.type).toBe("tool_call");
      expect((toolCallPart as { name: string }).name).toBe("get_weather");
    });

    it("should translate tool call and response round-trip", async () => {
      // Step 1: Get a tool call from OpenAI
      const completion1 = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Get the current weather",
              parameters: {
                type: "object",
                properties: {
                  location: { type: "string" },
                },
                required: ["location"],
              },
            },
          },
        ],
        tool_choice: "required",
        max_tokens: 100,
      });

      const assistantMessage = completion1.choices[0]?.message;
      const toolCall = assistantMessage?.tool_calls?.[0];
      expect(toolCall).toBeDefined();
      if (!assistantMessage || !toolCall) throw new Error("No assistant message or tool call");

      // Step 2: Build the tool response
      const toolResponse: OpenAI.ChatCompletionToolMessageParam = {
        role: "tool",
        content: JSON.stringify({ temperature: 22, condition: "sunny" }),
        tool_call_id: toolCall.id,
      };

      // Step 3: Get final response
      const completion2 = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "What's the weather in Tokyo?" }, assistantMessage, toolResponse],
        max_tokens: 100,
      });

      const finalMessage = completion2.choices[0]?.message;
      if (!finalMessage) throw new Error("No final message");

      // Build full conversation
      const fullConversation = [
        { role: "user" as const, content: "What's the weather in Tokyo?" },
        assistantMessage,
        toolResponse,
        finalMessage,
      ];

      const result = translate(fullConversation, {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(4);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.parts[0]?.type).toBe("tool_call");
      expect(result.messages[2]?.role).toBe("tool");
      expect(result.messages[2]?.parts[0]?.type).toBe("tool_call_response");
      expect(result.messages[3]?.role).toBe("assistant");
    });

    it("should translate real API response to Promptl format", async () => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Reply with exactly: Hello World" }],
        max_tokens: 10,
      });

      const message = completion.choices[0]?.message;
      if (!message) throw new Error("No message");

      const result = translate([message], {
        from: Provider.OpenAICompletions,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
    });
  });

  describe("hardcoded messages (no API key required)", () => {
    it("should translate simple OpenAI messages to GenAI", () => {
      const openAIMessages = [
        { role: "system" as const, content: "You are a helpful assistant." },
        { role: "user" as const, content: "What is the capital of France?" },
        { role: "assistant" as const, content: "The capital of France is Paris." },
      ];

      const result = translate(openAIMessages, {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      // System messages are extracted to the system field when translating to GenAI
      expect(result.messages).toHaveLength(2);
      expect(result.system).toBeDefined();
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should translate developer message (o1 models)", () => {
      const openAIMessages = [
        { role: "developer" as const, content: "You must always respond in JSON format." },
        { role: "user" as const, content: "What is 2+2?" },
      ];

      const result = translate(openAIMessages, {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("developer");
    });

    it("should preserve message name field", () => {
      const openAIMessages = [{ role: "user" as const, content: "Hello!", name: "Alice" }];

      const result = translate(openAIMessages, {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.name).toBe("Alice");
    });

    it("should translate image URL content", () => {
      const openAIMessages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "What's in this image?" },
            { type: "image_url" as const, image_url: { url: "https://example.com/cat.jpg" } },
          ],
        },
      ];

      const result = translate(openAIMessages, {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect(result.messages[0]?.parts[1]?.type).toBe("uri");
    });

    it("should translate assistant message with function tool calls", () => {
      const openAIMessages = [
        { role: "user" as const, content: "What's the weather in London?" },
        {
          role: "assistant" as const,
          content: null,
          tool_calls: [
            {
              id: "call_abc123",
              type: "function" as const,
              function: {
                name: "get_weather",
                arguments: '{"location":"London","unit":"celsius"}',
              },
            },
          ],
        },
        {
          role: "tool" as const,
          content: '{"temperature":15,"condition":"cloudy"}',
          tool_call_id: "call_abc123",
        },
        { role: "assistant" as const, content: "The weather in London is 15°C and cloudy." },
      ];

      const result = translate(openAIMessages, {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(4);

      // Check tool call message
      const toolCallMsg = result.messages[1];
      expect(toolCallMsg?.role).toBe("assistant");
      expect(toolCallMsg?.parts[0]?.type).toBe("tool_call");
      const toolCallPart = toolCallMsg?.parts[0] as { name: string; arguments: unknown };
      expect(toolCallPart.name).toBe("get_weather");
      expect(toolCallPart.arguments).toEqual({ location: "London", unit: "celsius" });

      // Check tool response message
      const toolResponseMsg = result.messages[2];
      expect(toolResponseMsg?.role).toBe("tool");
      expect(toolResponseMsg?.parts[0]?.type).toBe("tool_call_response");
    });

    it("should translate refusal content", () => {
      const openAIMessages = [
        {
          role: "assistant" as const,
          content: [{ type: "refusal" as const, refusal: "I cannot help with that request." }],
        },
      ];

      const result = translate(openAIMessages, {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      const textPart = result.messages[0]?.parts[0];
      expect(textPart?.type).toBe("text");
      expect((textPart as { content: string }).content).toBe("I cannot help with that request.");
      // isRefusal is stored in _known_fields for cross-provider access
      expect((textPart?._provider_metadata?._known_fields as Record<string, unknown> | undefined)?.isRefusal).toBe(
        true,
      );
    });

    it("should auto-detect OpenAI Completions format", () => {
      const openAIMessages = [
        { role: "system" as const, content: "You are helpful." },
        { role: "user" as const, content: "Hello" },
      ];

      // No explicit 'from' - should auto-infer
      const result = translate(openAIMessages);

      // System extracted to system field, only user message remains
      expect(result.messages).toHaveLength(1);
      expect(result.system).toBeDefined();
      expect(result.messages[0]?.role).toBe("user");
    });

    it("should translate OpenAI to Promptl via GenAI", () => {
      const openAIMessages = [
        { role: "system" as const, content: "You are a helpful assistant." },
        { role: "user" as const, content: "Hello!" },
        { role: "assistant" as const, content: "Hi there!" },
      ];

      const result = translate(openAIMessages, {
        from: Provider.OpenAICompletions,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[1]?.role).toBe("user");
      expect(result.messages[2]?.role).toBe("assistant");
    });
  });
});
