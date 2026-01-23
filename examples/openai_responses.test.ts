/**
 * OpenAI Responses Provider E2E Tests
 *
 * Tests translating OpenAI Responses API format items to GenAI.
 * Includes both hardcoded messages and real API calls (when OPENAI_API_KEY is set).
 * This is a source-only provider, so only toGenAI translations are tested.
 */

import OpenAI from "openai";
import { Provider, translate } from "rosetta-ai";
import { describe, expect, it } from "vitest";

const hasApiKey = !!process.env.OPENAI_API_KEY;

describe("OpenAI Responses E2E", () => {
  describe.skipIf(!hasApiKey)("real OpenAI API calls", { timeout: 30000 }, () => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    it("should translate a real OpenAI Responses API response", async () => {
      const response = await openai.responses.create({
        model: "gpt-4o-mini",
        input: "What is 2+2? Reply in one word.",
      });

      // The output array contains ResponseOutputItems
      const outputItems = response.output;
      expect(outputItems.length).toBeGreaterThan(0);

      const result = translate(outputItems, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages.length).toBeGreaterThan(0);
      // Should have at least one assistant message
      const assistantMsg = result.messages.find((m) => m.role === "assistant");
      expect(assistantMsg).toBeDefined();
    });

    it("should translate function calls from real API", async () => {
      const response = await openai.responses.create({
        model: "gpt-4o-mini",
        input: "What's the weather in Paris?",
        tools: [
          {
            type: "function",
            name: "get_weather",
            description: "Get the current weather for a location",
            strict: false,
            parameters: {
              type: "object",
              properties: {
                location: { type: "string", description: "The city name" },
              },
              required: ["location"],
            },
          },
        ],
        tool_choice: "required",
      });

      const outputItems = response.output;

      const result = translate(outputItems, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      // Should have a function_call converted to tool_call part
      const toolCallMsg = result.messages.find((m) => m.parts.some((p) => p.type === "tool_call"));
      expect(toolCallMsg).toBeDefined();
      expect(toolCallMsg?.role).toBe("assistant");

      const toolCallPart = toolCallMsg?.parts.find((p) => p.type === "tool_call");
      expect((toolCallPart as { name: string }).name).toBe("get_weather");
    });

    it("should translate a conversation with input messages", async () => {
      // Build input with structured messages
      const input: OpenAI.Responses.ResponseInputItem[] = [
        { role: "user", content: "Hello! Remember my name is Alice." },
      ];

      const response = await openai.responses.create({
        model: "gpt-4o-mini",
        input,
      });

      // Combine input and output for full conversation
      const allItems = [...input, ...response.output];

      const result = translate(allItems, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages.length).toBeGreaterThanOrEqual(2);
      expect(result.messages[0]?.role).toBe("user");
    });

    it("should translate to Promptl format via GenAI", async () => {
      const response = await openai.responses.create({
        model: "gpt-4o-mini",
        input: "Say hello!",
      });

      const result = translate(response.output, {
        from: Provider.OpenAIResponses,
        to: Provider.Promptl,
      });

      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0]?.role).toBe("assistant");
    });
  });

  describe("hardcoded messages (no API key required)", () => {
    it("should translate simple message items to GenAI", () => {
      const items = [
        { role: "user" as const, content: "Hello!" },
        {
          type: "message" as const,
          id: "msg_123",
          role: "assistant" as const,
          status: "completed" as const,
          content: [{ type: "output_text" as const, text: "Hi there!" }],
        },
      ];

      const result = translate(items, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should translate system and developer messages", () => {
      const items = [
        { role: "system" as const, content: "You are a helpful assistant." },
        { role: "developer" as const, content: "Always respond in JSON." },
        { role: "user" as const, content: "What is 2+2?" },
      ];

      const result = translate(items, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      // System messages are extracted to result.system when translating to GenAI
      expect(result.system).toBeDefined();
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("developer");
      expect(result.messages[1]?.role).toBe("user");
    });

    it("should translate function_call items", () => {
      const items = [
        { role: "user" as const, content: "What's the weather?" },
        {
          type: "function_call" as const,
          call_id: "call_abc123",
          name: "get_weather",
          arguments: '{"location":"London"}',
        },
      ];

      const result = translate(items, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.parts[0]?.type).toBe("tool_call");
      expect((result.messages[1]?.parts[0] as { name: string }).name).toBe("get_weather");
      expect((result.messages[1]?.parts[0] as { arguments: unknown }).arguments).toEqual({ location: "London" });
    });

    it("should translate function_call_output items", () => {
      const items = [
        {
          type: "function_call_output" as const,
          call_id: "call_abc123",
          output: '{"temperature":20,"condition":"cloudy"}',
        },
      ];

      const result = translate(items, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("tool");
      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
      expect((result.messages[0]?.parts[0] as { response: unknown }).response).toEqual({
        temperature: 20,
        condition: "cloudy",
      });
    });

    it("should translate reasoning items", () => {
      const items = [
        {
          type: "reasoning" as const,
          id: "reasoning_123",
          summary: [
            { text: "Let me think about this...", type: "summary_text" as const },
            { text: "The answer is 4.", type: "summary_text" as const },
          ],
        },
      ];

      const result = translate(items, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]?.type).toBe("reasoning");
      expect((result.messages[0]?.parts[0] as { content: string }).content).toBe("Let me think about this...");
    });

    it("should translate multimodal content (image)", () => {
      const items = [
        {
          role: "user" as const,
          content: [
            { type: "input_text" as const, text: "What's in this image?" },
            { type: "input_image" as const, detail: "high" as const, image_url: "https://example.com/cat.jpg" },
          ],
        },
      ];

      const result = translate(items, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect(result.messages[0]?.parts[1]?.type).toBe("uri");
      expect((result.messages[0]?.parts[1] as { uri: string }).uri).toBe("https://example.com/cat.jpg");
    });

    it("should translate refusal content", () => {
      const items = [
        {
          type: "message" as const,
          id: "msg_123",
          role: "assistant" as const,
          status: "completed" as const,
          content: [{ type: "refusal" as const, refusal: "I cannot help with that request." }],
        },
      ];

      const result = translate(items, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect((result.messages[0]?.parts[0] as { content: string }).content).toBe("I cannot help with that request.");
      expect(result.messages[0]?.parts[0]?._provider_metadata?.openai_responses).toEqual({ isRefusal: true });
    });

    it("should translate passthrough items (file_search_call)", () => {
      const items = [
        {
          type: "file_search_call",
          id: "fs_123",
          queries: ["search query"],
          status: "completed",
          results: [{ file_id: "file_1", filename: "doc.pdf", text: "result" }],
        } as never,
      ];

      const result = translate(items, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]?.type).toBe("file_search_call");
      // Full item is preserved in metadata
      expect(result.messages[0]?.parts[0]?._provider_metadata?.openai_responses).toBeDefined();
    });

    it("should translate passthrough items (web_search_call)", () => {
      const items = [
        {
          type: "web_search_call",
          id: "ws_123",
          status: "completed",
        } as never,
      ];

      const result = translate(items, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]?.type).toBe("web_search_call");
    });

    it("should auto-detect OpenAI Responses format", () => {
      const items = [
        {
          type: "function_call" as const,
          call_id: "call_123",
          name: "test",
          arguments: "{}",
        },
      ];

      // No explicit 'from' - should auto-infer
      const result = translate(items);
      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call");
    });

    it("should translate to Promptl format", () => {
      const items = [
        { role: "system" as const, content: "You are a helpful assistant." },
        { role: "user" as const, content: "Hello!" },
        {
          type: "message" as const,
          id: "msg_1",
          role: "assistant" as const,
          status: "completed" as const,
          content: [{ type: "output_text" as const, text: "Hi there!" }],
        },
      ];

      const result = translate(items, {
        from: Provider.OpenAIResponses,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[1]?.role).toBe("user");
      expect(result.messages[2]?.role).toBe("assistant");
    });

    it("should handle full tool use conversation", () => {
      const items = [
        { role: "user" as const, content: "What's the weather in Tokyo?" },
        {
          type: "function_call" as const,
          call_id: "call_weather",
          name: "get_weather",
          arguments: '{"location":"Tokyo"}',
        },
        {
          type: "function_call_output" as const,
          call_id: "call_weather",
          output: '{"temp":25,"condition":"sunny"}',
        },
        {
          type: "message" as const,
          id: "msg_final",
          role: "assistant" as const,
          status: "completed" as const,
          content: [{ type: "output_text" as const, text: "The weather in Tokyo is 25°C and sunny." }],
        },
      ];

      const result = translate(items, {
        from: Provider.OpenAIResponses,
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
  });
});
