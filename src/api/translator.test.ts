/**
 * Translation API Tests
 *
 * Tests for the translate and safeTranslate functions.
 */

import { describe, expect, it } from "vitest";
import { safeTranslate, translate } from "$package/api/translator";
import type { GenAIMessage, GenAISystem } from "$package/core/genai";
import { Provider } from "$package/providers";

describe("translate", () => {
  describe("string messages", () => {
    it("should convert string to user message for input direction", () => {
      const result = translate("Hello, world!");

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "Hello, world!",
      });
    });

    it("should convert string to assistant message for output direction", () => {
      const result = translate("I can help you!", { direction: "output" });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "I can help you!",
      });
    });
  });

  describe("array messages", () => {
    it("should translate GenAI messages unchanged when from and to are GenAI", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi there!" }] },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should translate Promptl messages to GenAI", () => {
      const messages = [
        { role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] },
        { role: "assistant" as const, content: [{ type: "text" as const, text: "Hi there!" }] },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.parts[0]).toEqual({ type: "text", content: "Hi there!" });
    });

    it("should translate GenAI messages to Promptl", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi there!" }] },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.content[0]).toEqual({ type: "text", text: "Hello" });
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.content[0]).toEqual({ type: "text", text: "Hi there!" });
    });
  });

  describe("single message object", () => {
    it("should wrap a single message object in an array", () => {
      const message: GenAIMessage = { role: "user", parts: [{ type: "text", content: "Hello" }] };

      const result = translate(message, { from: Provider.GenAI, to: Provider.GenAI });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
    });

    it("should auto-infer the provider from a single message object", () => {
      const message = { role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] };

      const result = translate(message);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
    });

    it("should cross-translate a single message object", () => {
      const message: GenAIMessage = { role: "assistant", parts: [{ type: "text", content: "Hi there!" }] };

      const result = translate(message, { from: Provider.GenAI, to: Provider.Promptl });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.content[0]).toEqual({ type: "text", text: "Hi there!" });
    });
  });

  describe("provider auto-inference", () => {
    it("should auto-infer GenAI format when from is not provided", () => {
      const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hello" }] }];

      const result = translate(messages);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
    });

    it("should auto-infer Promptl format when from is not provided", () => {
      const messages = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }];

      const result = translate(messages);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
    });

    it("should use custom inferPriority when auto-inferring", () => {
      const messages = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }];

      const result = translate(messages, {
        inferPriority: [Provider.Promptl, Provider.GenAI],
      });

      expect(result.messages).toHaveLength(1);
    });

    it("should throw error when inferPriority is empty", () => {
      expect(() => translate("Hello", { inferPriority: [] })).toThrow(
        "Infer priority list cannot be empty if provided",
      );
    });
  });

  describe("system instructions", () => {
    it("should handle string system instruction", () => {
      const result = translate("Hello", {
        from: Provider.GenAI,
        to: Provider.GenAI,
        system: "You are a helpful assistant.",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.system).toHaveLength(1);
      expect(result.system?.[0]).toMatchObject({
        type: "text",
        content: "You are a helpful assistant.",
      });
    });

    it("should handle array system instruction", () => {
      const system: GenAISystem = [
        { type: "text", content: "Be helpful" },
        { type: "text", content: "Be concise" },
      ];

      const result = translate("Hello", {
        from: Provider.GenAI,
        to: Provider.GenAI,
        system,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.system).toHaveLength(2);
      expect(result.system?.[0]).toMatchObject({ type: "text", content: "Be helpful" });
      expect(result.system?.[1]).toMatchObject({ type: "text", content: "Be concise" });
    });

    it("should extract system from GenAI when converting to GenAI", () => {
      const messages: GenAIMessage[] = [
        { role: "system", parts: [{ type: "text", content: "Be helpful" }] },
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.system).toHaveLength(1);
      expect(result.system?.[0]).toMatchObject({ type: "text", content: "Be helpful" });
    });
  });

  describe("default target", () => {
    it("should default to GenAI as target when to is not provided", () => {
      const messages = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }];

      const result = translate(messages, {
        from: Provider.Promptl,
      });

      expect(result.messages[0]?.parts).toBeDefined();
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
    });
  });

  describe("error handling", () => {
    it("should throw when translating to a source-only provider", () => {
      const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hello" }] }];

      expect(() =>
        translate(messages, {
          from: Provider.GenAI,
          // @ts-expect-error Testing runtime error for source-only provider as target
          to: Provider.OpenAICompletions,
        }),
      ).toThrow('Translating to provider "openai_completions" is not supported');
    });

    it("should throw when system is provided for a provider that does not support it", () => {
      const messages = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }];

      expect(() =>
        translate(messages, {
          from: Provider.Promptl,
          system: "Be helpful",
        }),
      ).toThrow('Provider "promptl" does not support separated system instructions');
    });

    it("should throw on invalid message format", () => {
      const invalidMessages = [{ invalid: "format" }];

      expect(() =>
        translate(invalidMessages, {
          from: Provider.GenAI,
        }),
      ).toThrow();
    });
  });
});

describe("safeTranslate", () => {
  it("should return messages on success", () => {
    const result = safeTranslate("Hello, world!");

    expect(result.error).toBeUndefined();
    if (!result.error) {
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
    }
  });

  it("should return error instead of throwing", () => {
    const invalidMessages = [{ invalid: "format" }];

    const result = safeTranslate(invalidMessages, {
      from: Provider.GenAI,
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it("should return error for source-only provider as target", () => {
    const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hello" }] }];

    const result = safeTranslate(messages, {
      from: Provider.GenAI,
      // @ts-expect-error Testing runtime error for source-only provider as target
      to: Provider.OpenAICompletions,
    });

    expect(result.error).toBeDefined();
    if (result.error) {
      expect(result.error.message).toContain("openai_completions");
    }
  });

  it("should support all translate options", () => {
    const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hello" }] }];

    const result = safeTranslate(messages, {
      from: Provider.GenAI,
      to: Provider.Promptl,
      direction: "input",
    });

    expect(result.error).toBeUndefined();
    if (!result.error) {
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.content[0]).toEqual({ type: "text", text: "Hello" });
    }
  });
});

describe("cross-provider translation", () => {
  describe("GenAI to Promptl", () => {
    it("should translate simple text messages", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi!" }] },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.content).toEqual([{ type: "text", text: "Hello" }]);
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.content).toEqual([{ type: "text", text: "Hi!" }]);
    });

    it("should translate tool calls", () => {
      const messages: GenAIMessage[] = [
        {
          role: "assistant",
          parts: [
            {
              type: "tool_call",
              id: "call_123",
              name: "get_weather",
              arguments: { city: "NYC" },
            },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.content[0]).toMatchObject({
        type: "tool-call",
        toolCallId: "call_123",
        toolName: "get_weather",
        args: { city: "NYC" },
      });
    });

    it("should translate tool responses", () => {
      const messages: GenAIMessage[] = [
        {
          role: "tool",
          parts: [
            {
              type: "tool_call_response",
              id: "call_123",
              response: { temperature: 72 },
              _provider_metadata: {
                _known_fields: { toolName: "get_weather" },
              },
            },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("tool");
      expect(result.messages[0]).toHaveProperty("toolName", "get_weather");
      expect(result.messages[0]).toHaveProperty("toolId", "call_123");
    });
  });

  describe("Promptl to GenAI", () => {
    it("should translate simple text messages", () => {
      const messages = [
        { role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] },
        { role: "assistant" as const, content: [{ type: "text" as const, text: "Hi!" }] },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts).toEqual([{ type: "text", content: "Hello" }]);
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.parts).toEqual([{ type: "text", content: "Hi!" }]);
    });

    it("should translate tool calls", () => {
      const messages = [
        {
          role: "assistant" as const,
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "call_123",
              toolName: "get_weather",
              args: { city: "NYC" },
            },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "tool_call",
        id: "call_123",
        name: "get_weather",
        arguments: { city: "NYC" },
      });
    });

    it("should translate images as URLs", () => {
      const messages = [
        {
          role: "user" as const,
          content: [{ type: "image" as const, image: "https://example.com/image.jpg" }],
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "uri",
        modality: "image",
        uri: "https://example.com/image.jpg",
      });
    });

    it("should translate images as base64", () => {
      const messages = [
        {
          role: "user" as const,
          content: [{ type: "image" as const, image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" }],
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "blob",
        modality: "image",
        content: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
      });
    });
  });

  describe("OpenAI Completions to GenAI (source-only)", () => {
    it("should translate simple text messages", () => {
      const messages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" },
      ];

      const result = translate(messages, {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.parts[0]).toEqual({ type: "text", content: "Hi there!" });
    });

    it("should translate tool calls", () => {
      const messages = [
        {
          role: "assistant" as const,
          content: null,
          tool_calls: [
            {
              id: "call_123",
              type: "function" as const,
              function: {
                name: "get_weather",
                arguments: '{"city":"NYC"}',
              },
            },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "tool_call",
        id: "call_123",
        name: "get_weather",
        arguments: { city: "NYC" },
      });
    });

    it("should translate multimodal content", () => {
      const messages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "What is in this image?" },
            { type: "image_url" as const, image_url: { url: "https://example.com/image.jpg" } },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.OpenAICompletions,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "What is in this image?" });
      expect(result.messages[0]?.parts[1]).toMatchObject({
        type: "uri",
        modality: "image",
        uri: "https://example.com/image.jpg",
      });
    });
  });

  describe("OpenAI Responses to GenAI (source-only)", () => {
    it("should translate simple text messages", () => {
      const messages = [
        { type: "message" as const, role: "user" as const, content: [{ type: "input_text" as const, text: "Hello" }] },
        {
          type: "message" as const,
          role: "assistant" as const,
          content: [{ type: "output_text" as const, text: "Hi there!" }],
        },
      ];

      const result = translate(messages, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.parts[0]).toEqual({ type: "text", content: "Hi there!" });
    });

    it("should translate function calls", () => {
      const messages = [
        {
          type: "function_call" as const,
          call_id: "call_123",
          name: "get_weather",
          arguments: '{"city":"NYC"}',
        },
      ];

      const result = translate(messages, {
        from: Provider.OpenAIResponses,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "tool_call",
        id: "call_123",
        name: "get_weather",
        arguments: { city: "NYC" },
      });
    });
  });

  describe("round-trip translation", () => {
    it("should preserve compaction and server-side tool parts through GenAI -> GenAI", () => {
      const originalMessages: GenAIMessage[] = [
        {
          role: "user",
          parts: [
            { type: "compaction", id: "cmp_1", content: "Summary of the earlier turns." },
            { type: "text", content: "Keep going." },
          ],
        },
        {
          role: "assistant",
          parts: [
            {
              type: "server_tool_call",
              id: "srv_1",
              name: "web_search",
              server_tool_call: { type: "web_search", query: "opentelemetry genai" },
            },
            {
              type: "server_tool_call_response",
              id: "srv_1",
              server_tool_call_response: { type: "web_search_result", results: [{ url: "https://example.com" }] },
            },
          ],
          finish_reason: "compaction",
        },
      ];

      const result = translate(originalMessages, { from: Provider.GenAI, to: Provider.GenAI });

      expect(result.messages).toEqual(originalMessages);
    });

    it("should preserve a compaction part with no content through GenAI -> GenAI", () => {
      // Providers may only report the encrypted compaction item, without a readable summary
      const originalMessages: GenAIMessage[] = [{ role: "assistant", parts: [{ type: "compaction", id: "cmp_1" }] }];

      const result = translate(originalMessages, { from: Provider.GenAI, to: Provider.GenAI });

      expect(result.messages).toEqual(originalMessages);
    });

    it("should preserve messages through GenAI -> Promptl -> GenAI", () => {
      const originalMessages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi there!" }] },
      ];

      const promptlResult = translate(originalMessages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      const genaiResult = translate(promptlResult.messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(genaiResult.messages).toHaveLength(2);
      expect(genaiResult.messages[0]?.role).toBe("user");
      expect(genaiResult.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
      expect(genaiResult.messages[1]?.role).toBe("assistant");
      expect(genaiResult.messages[1]?.parts[0]).toEqual({ type: "text", content: "Hi there!" });
    });

    it("should preserve tool calls through GenAI -> Promptl -> GenAI", () => {
      const originalMessages: GenAIMessage[] = [
        {
          role: "assistant",
          parts: [
            {
              type: "tool_call",
              id: "call_123",
              name: "get_weather",
              arguments: { city: "NYC" },
            },
          ],
        },
      ];

      const promptlResult = translate(originalMessages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      const genaiResult = translate(promptlResult.messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(genaiResult.messages).toHaveLength(1);
      expect(genaiResult.messages[0]?.role).toBe("assistant");
      expect(genaiResult.messages[0]?.parts[0]).toMatchObject({
        type: "tool_call",
        id: "call_123",
        name: "get_weather",
        arguments: { city: "NYC" },
      });
    });
  });
});

describe("edge cases", () => {
  it("should handle empty messages array", () => {
    const result = translate([], {
      from: Provider.GenAI,
      to: Provider.GenAI,
    });

    expect(result.messages).toHaveLength(0);
  });

  it("should handle messages with empty parts", () => {
    const messages: GenAIMessage[] = [{ role: "user", parts: [] }];

    const result = translate(messages, {
      from: Provider.GenAI,
      to: Provider.GenAI,
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.parts).toHaveLength(0);
  });

  it("should handle messages with multiple parts", () => {
    const messages: GenAIMessage[] = [
      {
        role: "user",
        parts: [
          { type: "text", content: "Part 1" },
          { type: "text", content: "Part 2" },
          { type: "text", content: "Part 3" },
        ],
      },
    ];

    const result = translate(messages, {
      from: Provider.GenAI,
      to: Provider.GenAI,
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.parts).toHaveLength(3);
  });

  it("should preserve custom roles through GenAI passthrough", () => {
    const messages: GenAIMessage[] = [{ role: "developer", parts: [{ type: "text", content: "Custom role" }] }];

    const result = translate(messages, {
      from: Provider.GenAI,
      to: Provider.GenAI,
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.role).toBe("developer");
  });

  it("should preserve _provider_metadata through translation", () => {
    const messages: GenAIMessage[] = [
      {
        role: "user",
        parts: [
          {
            type: "text",
            content: "Hello",
            _provider_metadata: { field: "value" },
          },
        ],
        _provider_metadata: { messageField: "messageValue" },
      },
    ];

    const result = translate(messages, {
      from: Provider.GenAI,
      to: Provider.GenAI,
    });

    // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
    expect((result.messages[0] as Record<string, unknown>)["messageField"]).toBe("messageValue");
    // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
    expect((result.messages[0]?.parts[0] as Record<string, unknown>)["field"]).toBe("value");
  });

  describe("filterEmptyMessages option", () => {
    it("should drop a message whose only part is an empty reasoning block", () => {
      const messages: GenAIMessage[] = [
        { role: "assistant", parts: [{ type: "reasoning", content: "   " }] },
        { role: "assistant", parts: [{ type: "text", content: "Done." }] },
      ];

      const result = translate(messages, { from: Provider.GenAI, filterEmptyMessages: true });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Done." });
    });

    it("should keep a message whose reasoning block has content", () => {
      const messages: GenAIMessage[] = [{ role: "assistant", parts: [{ type: "reasoning", content: "Thinking" }] }];

      const result = translate(messages, { from: Provider.GenAI, filterEmptyMessages: true });

      expect(result.messages).toHaveLength(1);
    });

    it("should keep a message with a non-text part even when its content is empty", () => {
      // A blob's content is base64 data, not text, so emptiness is not the same question
      const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "blob", modality: "image", content: "" }] }];

      const result = translate(messages, { from: Provider.GenAI, filterEmptyMessages: true });

      expect(result.messages).toHaveLength(1);
    });

    it("should drop a message whose only part is a compaction with no summary", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "compaction", id: "cmp_1" }] },
        { role: "user", parts: [{ type: "text", content: "Keep going." }] },
      ];

      const result = translate(messages, { from: Provider.GenAI, filterEmptyMessages: true });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Keep going." });
    });

    it("should keep a message whose compaction part carries a summary", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "compaction", id: "cmp_1", content: "Summary" }] },
      ];

      const result = translate(messages, { from: Provider.GenAI, filterEmptyMessages: true });

      expect(result.messages).toHaveLength(1);
    });

    it("should NOT filter empty messages by default", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [] },
        { role: "user", parts: [] },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(3);
    });

    it("should filter empty messages when filterEmptyMessages is true", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [] },
        { role: "assistant", parts: [{ type: "text", content: "" }] },
        { role: "user", parts: [] },
        { role: "assistant", parts: [{ type: "text", content: "Real response" }] },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
        filterEmptyMessages: true,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.parts[0]).toEqual({ type: "text", content: "Real response" });
    });

    it("should keep messages with tool_call parts when filtering", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        {
          role: "assistant",
          parts: [{ type: "tool_call", id: "1", name: "test", arguments: {} }],
        },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
        filterEmptyMessages: true,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1]?.parts[0]?.type).toBe("tool_call");
    });

    it("should keep messages with tool_call_response parts when filtering", () => {
      const messages: GenAIMessage[] = [
        {
          role: "tool",
          parts: [{ type: "tool_call_response", id: "1", response: "result" }],
        },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
        filterEmptyMessages: true,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
    });

    it("should filter all roles with empty parts when filtering is enabled", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [] },
        { role: "assistant", parts: [] },
        { role: "tool", parts: [] },
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
        filterEmptyMessages: true,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
    });

    it("should filter messages with whitespace-only text when filtering is enabled", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "   " }] },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
        filterEmptyMessages: true,
      });

      expect(result.messages).toHaveLength(1);
    });
  });

  describe("providerMetadata passthrough preserves extra fields across translations", () => {
    it("should produce same result: direct Promptl→VercelAI vs Promptl→GenAI→VercelAI", () => {
      const promptlMessages = [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "Hello" }],
          providerOptions: {
            anthropic: {
              cacheControl: {
                type: "ephemeral",
              },
            },
          },
        },
      ];

      const directResult = translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
        providerMetadata: "passthrough",
      });

      const genaiResult = translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
        providerMetadata: "preserve",
      });

      expect(genaiResult.messages[0]?._provider_metadata).toBeDefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(genaiResult.messages[0]?._provider_metadata?.["providerOptions"]).toEqual({
        anthropic: { cacheControl: { type: "ephemeral" } },
      });

      const twoStepResult = translate(genaiResult.messages, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
        providerMetadata: "passthrough",
      });

      const directMessage = directResult.messages[0] as Record<string, unknown>;
      const twoStepMessage = twoStepResult.messages[0] as Record<string, unknown>;

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(directMessage["providerOptions"]).toEqual({
        anthropic: { cacheControl: { type: "ephemeral" } },
      });
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(twoStepMessage["providerOptions"]).toEqual({
        anthropic: { cacheControl: { type: "ephemeral" } },
      });

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(directMessage["providerOptions"]).toEqual(twoStepMessage["providerOptions"]);
    });

    it("should preserve providerOptions through preserve mode for later passthrough", () => {
      const promptlMessages = [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "What's the weather?" }],
          providerOptions: {
            openai: { user: "test-user-id" },
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        },
      ];

      const storedMessages = translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
        providerMetadata: "preserve",
      });

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(storedMessages.messages[0]?._provider_metadata?.["providerOptions"]).toEqual({
        openai: { user: "test-user-id" },
        anthropic: { cacheControl: { type: "ephemeral" } },
      });

      const vercelMessages = translate(storedMessages.messages, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
        providerMetadata: "passthrough",
      });

      const vercelMessage = vercelMessages.messages[0] as Record<string, unknown>;
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(vercelMessage["providerOptions"]).toEqual({
        openai: { user: "test-user-id" },
        anthropic: { cacheControl: { type: "ephemeral" } },
      });
    });

    it("should strip existing _provider_metadata when mode is 'strip'", () => {
      const messagesWithMetadata: GenAIMessage[] = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
          _provider_metadata: {
            providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
            customField: "someValue",
            _known_fields: { toolName: "test" },
          },
        },
      ];

      const result = translate(messagesWithMetadata, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
        providerMetadata: "strip",
      });

      const message = result.messages[0] as Record<string, unknown>;

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_provider_metadata"]).toBeUndefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_providerMetadata"]).toBeUndefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["providerOptions"]).toBeUndefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["customField"]).toBeUndefined();
    });

    it("should not nest _provider_metadata when input already has it (preserve mode)", () => {
      const messagesWithMetadata: GenAIMessage[] = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
          _provider_metadata: {
            providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
            customField: "someValue",
          },
        },
      ];

      const result = translate(messagesWithMetadata, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
        providerMetadata: "preserve",
      });

      const message = result.messages[0] as Record<string, unknown>;

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_providerMetadata"]).toBeDefined();

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      const metadata = message["_providerMetadata"] as Record<string, unknown>;

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(metadata["providerOptions"]).toEqual({
        anthropic: { cacheControl: { type: "ephemeral" } },
      });
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(metadata["customField"]).toBe("someValue");
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(metadata["_provider_metadata"]).toBeUndefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(metadata["_providerMetadata"]).toBeUndefined();
    });
  });

  describe("providerMetadata casing (snake_case vs camelCase)", () => {
    it("should read camelCase _providerMetadata from input (previously translated by VercelAI target)", () => {
      const messagesWithCamelCase = [
        {
          role: "user" as const,
          content: "Hello",
          _providerMetadata: {
            customField: "value",
            _knownFields: { toolName: "test_tool" },
          },
        },
      ];

      const result = translate(messagesWithCamelCase, {
        from: Provider.VercelAI,
        to: Provider.GenAI,
        providerMetadata: "preserve",
      });

      expect(result.messages[0]?._provider_metadata).toBeDefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(result.messages[0]?._provider_metadata?.["customField"]).toBe("value");
      expect(result.messages[0]?._provider_metadata?._known_fields?.toolName).toBe("test_tool");
    });

    it("should read snake_case _provider_metadata from input (previously translated by GenAI target)", () => {
      const messagesWithSnakeCase: GenAIMessage[] = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
          _provider_metadata: {
            customField: "value",
            _known_fields: { toolName: "test_tool" },
          },
        },
      ];

      const result = translate(messagesWithSnakeCase, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
        providerMetadata: "preserve",
      });

      const message = result.messages[0] as Record<string, unknown>;

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_providerMetadata"]).toBeDefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_provider_metadata"]).toBeUndefined();

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      const metadata = message["_providerMetadata"] as Record<string, unknown>;
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(metadata["customField"]).toBe("value");
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(metadata["_knownFields"]).toBeDefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect((metadata["_knownFields"] as Record<string, unknown>)?.["toolName"]).toBe("test_tool");
    });

    it("should output snake_case for GenAI target", () => {
      const promptlMessages = [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "Hello" }],
          extraField: "extra",
        },
      ];

      const result = translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
        providerMetadata: "preserve",
      });

      expect(result.messages[0]?._provider_metadata).toBeDefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(result.messages[0]?._provider_metadata?.["extraField"]).toBe("extra");
    });

    it("should output camelCase for VercelAI target", () => {
      const genaiMessages: GenAIMessage[] = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
          _provider_metadata: {
            extraField: "extra",
          },
        },
      ];

      const result = translate(genaiMessages, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
        providerMetadata: "preserve",
      });

      const message = result.messages[0] as Record<string, unknown>;

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_providerMetadata"]).toBeDefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_provider_metadata"]).toBeUndefined();
    });

    it("should read _knownFields (camelCase) from input and use for translation", () => {
      const messagesWithCamelCaseKnown: GenAIMessage[] = [
        {
          role: "tool",
          parts: [
            {
              type: "tool_call_response",
              id: "call-123",
              response: "Success",
              _provider_metadata: {
                _knownFields: { toolName: "get_weather", isError: false },
              },
            },
          ],
        },
      ];

      const result = translate(messagesWithCamelCaseKnown, {
        from: Provider.GenAI,
        to: Provider.Promptl,
        providerMetadata: "passthrough",
      });

      const message = result.messages[0] as Record<string, unknown>;
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["toolName"]).toBe("get_weather");
    });
  });
});
