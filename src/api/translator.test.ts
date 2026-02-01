/**
 * Translator Tests
 *
 * Tests for the Translator class and translate/safeTranslate functions.
 */

import { describe, expect, it } from "vitest";
import { safeTranslate, Translator, translate } from "$package/api/translator";
import type { GenAIMessage, GenAISystem } from "$package/core/genai";
import { Provider } from "$package/providers";

describe("Translator", () => {
  describe("constructor", () => {
    it("should create a translator with default config", () => {
      const translator = new Translator();
      expect(translator).toBeInstanceOf(Translator);
    });

    it("should create a translator with custom inferPriority", () => {
      const translator = new Translator({
        inferPriority: [Provider.Promptl, Provider.GenAI],
      });
      expect(translator).toBeInstanceOf(Translator);
    });

    it("should throw error when inferPriority is empty", () => {
      expect(() => new Translator({ inferPriority: [] })).toThrow("Infer priority list cannot be empty if provided");
    });
  });

  describe("translate", () => {
    const translator = new Translator();

    describe("string messages", () => {
      it("should convert string to user message for input direction", () => {
        const result = translator.translate("Hello, world!");

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.messages[0]?.parts).toHaveLength(1);
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Hello, world!",
        });
      });

      it("should convert string to assistant message for output direction", () => {
        const result = translator.translate("I can help you!", { direction: "output" });

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

        const result = translator.translate(messages, {
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

        const result = translator.translate(messages, {
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

        const result = translator.translate(messages, {
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

    describe("provider auto-inference", () => {
      it("should auto-infer GenAI format when from is not provided", () => {
        const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hello" }] }];

        const result = translator.translate(messages);

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
      });

      it("should auto-infer Promptl format when from is not provided", () => {
        const messages = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }];

        const result = translator.translate(messages);

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
      });

      it("should use custom inferPriority when auto-inferring", () => {
        const translator = new Translator({
          inferPriority: [Provider.Promptl, Provider.GenAI],
        });

        // This message format is valid for both Promptl and GenAI (after normalization)
        // but with Promptl first in priority, it should be detected as Promptl
        const messages = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }];

        const result = translator.translate(messages);

        expect(result.messages).toHaveLength(1);
      });
    });

    describe("system instructions", () => {
      it("should handle string system instruction", () => {
        const result = translator.translate("Hello", {
          from: Provider.GenAI,
          to: Provider.GenAI,
          system: "You are a helpful assistant.",
        });

        // System is extracted by fromGenAI and returned separately
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.system).toHaveLength(1);
        expect(result.system?.[0]).toEqual({
          type: "text",
          content: "You are a helpful assistant.",
        });
      });

      it("should handle array system instruction", () => {
        const system: GenAISystem = [
          { type: "text", content: "Be helpful" },
          { type: "text", content: "Be concise" },
        ];

        const result = translator.translate("Hello", {
          from: Provider.GenAI,
          to: Provider.GenAI,
          system,
        });

        // System is extracted by fromGenAI and returned separately
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.system).toHaveLength(2);
        expect(result.system).toEqual(system);
      });

      it("should extract system from GenAI when converting to GenAI", () => {
        const messages: GenAIMessage[] = [
          { role: "system", parts: [{ type: "text", content: "Be helpful" }] },
          { role: "user", parts: [{ type: "text", content: "Hello" }] },
        ];

        const result = translator.translate(messages, {
          from: Provider.GenAI,
          to: Provider.GenAI,
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.system).toHaveLength(1);
        expect(result.system?.[0]).toEqual({ type: "text", content: "Be helpful" });
      });
    });

    describe("default target", () => {
      it("should default to GenAI as target when to is not provided", () => {
        const messages = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }];

        const result = translator.translate(messages, {
          from: Provider.Promptl,
        });

        // Result should be in GenAI format (parts instead of content)
        expect(result.messages[0]?.parts).toBeDefined();
        expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
      });
    });

    describe("error handling", () => {
      it("should throw when translating to a source-only provider", () => {
        const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hello" }] }];

        expect(() =>
          translator.translate(messages, {
            from: Provider.GenAI,
            // @ts-expect-error Testing runtime error for source-only provider as target
            to: Provider.OpenAICompletions,
          }),
        ).toThrow('Translating to provider "openai_completions" is not supported');
      });

      it("should throw when system is provided for a provider that does not support it", () => {
        const messages = [{ role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] }];

        expect(() =>
          translator.translate(messages, {
            from: Provider.Promptl,
            system: "Be helpful",
          }),
        ).toThrow('Provider "promptl" does not support separated system instructions');
      });

      it("should throw on invalid message format", () => {
        const invalidMessages = [{ invalid: "format" }];

        expect(() =>
          translator.translate(invalidMessages, {
            from: Provider.GenAI,
          }),
        ).toThrow();
      });
    });
  });

  describe("safeTranslate", () => {
    const translator = new Translator();

    it("should return messages on success", () => {
      const result = translator.safeTranslate("Hello, world!");

      expect(result.error).toBeUndefined();
      if (!result.error) {
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
      }
    });

    it("should return error instead of throwing", () => {
      const invalidMessages = [{ invalid: "format" }];

      const result = translator.safeTranslate(invalidMessages, {
        from: Provider.GenAI,
      });

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it("should return error for source-only provider as target", () => {
      const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hello" }] }];

      const result = translator.safeTranslate(messages, {
        from: Provider.GenAI,
        // @ts-expect-error Testing runtime error for source-only provider as target
        to: Provider.OpenAICompletions,
      });

      expect(result.error).toBeDefined();
      if (result.error) {
        expect(result.error.message).toContain("openai_completions");
      }
    });
  });
});

describe("translate function", () => {
  it("should work with default translator instance", () => {
    const result = translate("Hello, world!");

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.role).toBe("user");
    expect(result.messages[0]?.parts[0]).toEqual({
      type: "text",
      content: "Hello, world!",
    });
  });

  it("should support all translate options", () => {
    const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hello" }] }];

    const result = translate(messages, {
      from: Provider.GenAI,
      to: Provider.Promptl,
      direction: "input",
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.role).toBe("user");
    expect(result.messages[0]?.content[0]).toEqual({ type: "text", text: "Hello" });
  });
});

describe("safeTranslate function", () => {
  it("should work with default translator instance", () => {
    const result = safeTranslate("Hello, world!");

    expect("error" in result).toBe(false);
    expect("messages" in result).toBe(true);
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
});

describe("cross-provider translation", () => {
  const translator = new Translator();

  describe("GenAI to Promptl", () => {
    it("should translate simple text messages", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi!" }] },
      ];

      const result = translator.translate(messages, {
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

      const result = translator.translate(messages, {
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

      const result = translator.translate(messages, {
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

      const result = translator.translate(messages, {
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

      const result = translator.translate(messages, {
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

      const result = translator.translate(messages, {
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

      const result = translator.translate(messages, {
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

      const result = translator.translate(messages, {
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

      const result = translator.translate(messages, {
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

      const result = translator.translate(messages, {
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

      const result = translator.translate(messages, {
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

      const result = translator.translate(messages, {
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
    it("should preserve messages through GenAI -> Promptl -> GenAI", () => {
      const originalMessages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi there!" }] },
      ];

      // GenAI -> Promptl
      const promptlResult = translator.translate(originalMessages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      // Promptl -> GenAI
      const genaiResult = translator.translate(promptlResult.messages, {
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

      // GenAI -> Promptl
      const promptlResult = translator.translate(originalMessages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      // Promptl -> GenAI
      const genaiResult = translator.translate(promptlResult.messages, {
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
  const translator = new Translator();

  it("should handle empty messages array", () => {
    const result = translator.translate([], {
      from: Provider.GenAI,
      to: Provider.GenAI,
    });

    expect(result.messages).toHaveLength(0);
  });

  it("should handle messages with empty parts", () => {
    const messages: GenAIMessage[] = [{ role: "user", parts: [] }];

    const result = translator.translate(messages, {
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

    const result = translator.translate(messages, {
      from: Provider.GenAI,
      to: Provider.GenAI,
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.parts).toHaveLength(3);
  });

  it("should preserve custom roles through GenAI passthrough", () => {
    const messages: GenAIMessage[] = [{ role: "developer", parts: [{ type: "text", content: "Custom role" }] }];

    const result = translator.translate(messages, {
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

    // GenAI to GenAI uses "passthrough" mode automatically for lossless round-trips
    // In passthrough mode, extra fields from _provider_metadata are spread directly on entities
    const result = translator.translate(messages, {
      from: Provider.GenAI,
      to: Provider.GenAI,
    });

    // In passthrough mode, extra fields are spread on the entity directly
    // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
    expect((result.messages[0] as Record<string, unknown>)["messageField"]).toBe("messageValue");
    // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
    expect((result.messages[0]?.parts[0] as Record<string, unknown>)["field"]).toBe("value");
  });

  describe("filterEmptyMessages config", () => {
    it("should NOT filter empty messages by default", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [] },
        { role: "user", parts: [] },
      ];

      // Default translator (filterEmptyMessages defaults to false)
      const result = translator.translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
      });

      // All messages should be preserved by default
      expect(result.messages).toHaveLength(3);
    });

    it("should filter empty messages when filterEmptyMessages is true in config", () => {
      const filteringTranslator = new Translator({ filterEmptyMessages: true });
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [] },
        { role: "assistant", parts: [{ type: "text", content: "" }] },
        { role: "user", parts: [] },
        { role: "assistant", parts: [{ type: "text", content: "Real response" }] },
      ];

      const result = filteringTranslator.translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.parts[0]).toEqual({ type: "text", content: "Real response" });
    });

    it("should keep messages with tool_call parts when filtering", () => {
      const filteringTranslator = new Translator({ filterEmptyMessages: true });
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        {
          role: "assistant",
          parts: [{ type: "tool_call", id: "1", name: "test", arguments: {} }],
        },
      ];

      const result = filteringTranslator.translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1]?.parts[0]?.type).toBe("tool_call");
    });

    it("should keep messages with tool_call_response parts when filtering", () => {
      const filteringTranslator = new Translator({ filterEmptyMessages: true });
      const messages: GenAIMessage[] = [
        {
          role: "tool",
          parts: [{ type: "tool_call_response", id: "1", response: "result" }],
        },
      ];

      const result = filteringTranslator.translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
    });

    it("should filter all roles with empty parts when filtering is enabled", () => {
      const filteringTranslator = new Translator({ filterEmptyMessages: true });
      const messages: GenAIMessage[] = [
        { role: "user", parts: [] },
        { role: "assistant", parts: [] },
        { role: "tool", parts: [] },
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
      ];

      const result = filteringTranslator.translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
      });

      // Only the non-empty user message should remain
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
    });

    it("should filter messages with whitespace-only text when filtering is enabled", () => {
      const filteringTranslator = new Translator({ filterEmptyMessages: true });
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "   " }] },
      ];

      const result = filteringTranslator.translate(messages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
      });

      // Whitespace-only text is treated as empty
      expect(result.messages).toHaveLength(1);
    });
  });

  describe("providerMetadata passthrough preserves extra fields across translations", () => {
    it("should produce same result: direct Promptl→VercelAI vs Promptl→GenAI→VercelAI", () => {
      // This is the original use case that motivated the metadata refactoring:
      // Promptl has a "providerOptions" field specifically for VercelAI to use
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

      // Option 1: Direct Promptl → VercelAI with passthrough
      const directTranslator = new Translator({ providerMetadata: "passthrough" });
      const directResult = directTranslator.translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.VercelAI,
      });

      // Option 2: Promptl → GenAI (preserve for storage), then GenAI → VercelAI (passthrough)
      const storageTranslator = new Translator({ providerMetadata: "preserve" });
      const genaiResult = storageTranslator.translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      // Verify GenAI has the metadata preserved
      expect(genaiResult.messages[0]?._provider_metadata).toBeDefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(genaiResult.messages[0]?._provider_metadata?.["providerOptions"]).toEqual({
        anthropic: { cacheControl: { type: "ephemeral" } },
      });

      // Now translate the stored GenAI messages to VercelAI with passthrough
      const passthroughTranslator = new Translator({ providerMetadata: "passthrough" });
      const twoStepResult = passthroughTranslator.translate(genaiResult.messages, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
      });

      // Both should have the providerOptions field directly on the message
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

      // The results should be equivalent (both have providerOptions as direct property)
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

      // Step 1: Translate to GenAI with preserve (simulating storage)
      const preserveTranslator = new Translator({ providerMetadata: "preserve" });
      const storedMessages = preserveTranslator.translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      // Verify the providerOptions are in the _provider_metadata
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(storedMessages.messages[0]?._provider_metadata?.["providerOptions"]).toEqual({
        openai: { user: "test-user-id" },
        anthropic: { cacheControl: { type: "ephemeral" } },
      });

      // Step 2: Later, translate from GenAI to VercelAI with passthrough
      const passthroughTranslator = new Translator({ providerMetadata: "passthrough" });
      const vercelMessages = passthroughTranslator.translate(storedMessages.messages, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
      });

      // The providerOptions should be a direct property on the VercelAI message
      const vercelMessage = vercelMessages.messages[0] as Record<string, unknown>;
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(vercelMessage["providerOptions"]).toEqual({
        openai: { user: "test-user-id" },
        anthropic: { cacheControl: { type: "ephemeral" } },
      });
    });

    it("should strip existing _provider_metadata when mode is 'strip'", () => {
      // Messages that already have _provider_metadata from a previous Rosetta translation
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

      // Translate with "strip" mode - should remove all metadata
      const stripTranslator = new Translator({ providerMetadata: "strip" });
      const result = stripTranslator.translate(messagesWithMetadata, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
      });

      const message = result.messages[0] as Record<string, unknown>;

      // The output should NOT have _provider_metadata or _providerMetadata
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_provider_metadata"]).toBeUndefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_providerMetadata"]).toBeUndefined();

      // The extra fields should NOT be spread on the entity either
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["providerOptions"]).toBeUndefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["customField"]).toBeUndefined();
    });

    it("should not nest _provider_metadata when input already has it (preserve mode)", () => {
      // Messages that already have _provider_metadata from a previous Rosetta translation
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

      // Translate with "preserve" mode - should keep metadata but NOT nest it
      const preserveTranslator = new Translator({ providerMetadata: "preserve" });
      const result = preserveTranslator.translate(messagesWithMetadata, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
      });

      const message = result.messages[0] as Record<string, unknown>;

      // Should have _providerMetadata (camelCase for VercelAI)
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_providerMetadata"]).toBeDefined();

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      const metadata = message["_providerMetadata"] as Record<string, unknown>;

      // The metadata should contain the original fields directly, NOT nested
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(metadata["providerOptions"]).toEqual({
        anthropic: { cacheControl: { type: "ephemeral" } },
      });
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(metadata["customField"]).toBe("someValue");

      // Should NOT have nested _provider_metadata inside
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(metadata["_provider_metadata"]).toBeUndefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(metadata["_providerMetadata"]).toBeUndefined();
    });
  });

  describe("providerMetadata casing (snake_case vs camelCase)", () => {
    it("should read camelCase _providerMetadata from input (previously translated by VercelAI target)", () => {
      // Messages with camelCase metadata (as if outputted by a previous Rosetta translation to VercelAI)
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

      // Translate to GenAI with preserve mode
      const translator = new Translator({ providerMetadata: "preserve" });
      const result = translator.translate(messagesWithCamelCase, {
        from: Provider.VercelAI,
        to: Provider.GenAI,
      });

      // GenAI uses snake_case, so output should have _provider_metadata
      expect(result.messages[0]?._provider_metadata).toBeDefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(result.messages[0]?._provider_metadata?.["customField"]).toBe("value");
      // Known fields should be preserved
      expect(result.messages[0]?._provider_metadata?._known_fields?.toolName).toBe("test_tool");
    });

    it("should read snake_case _provider_metadata from input (previously translated by GenAI target)", () => {
      // Messages with snake_case metadata (as if outputted by a previous Rosetta translation to GenAI)
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

      // Translate to VercelAI with preserve mode
      const translator = new Translator({ providerMetadata: "preserve" });
      const result = translator.translate(messagesWithSnakeCase, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
      });

      const message = result.messages[0] as Record<string, unknown>;

      // VercelAI uses camelCase, so output should have _providerMetadata
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_providerMetadata"]).toBeDefined();
      // Should NOT have snake_case version
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_provider_metadata"]).toBeUndefined();

      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      const metadata = message["_providerMetadata"] as Record<string, unknown>;
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(metadata["customField"]).toBe("value");
      // Known fields should use camelCase too
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

      const translator = new Translator({ providerMetadata: "preserve" });
      const result = translator.translate(promptlMessages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      // GenAI should use snake_case
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

      const translator = new Translator({ providerMetadata: "preserve" });
      const result = translator.translate(genaiMessages, {
        from: Provider.GenAI,
        to: Provider.VercelAI,
      });

      const message = result.messages[0] as Record<string, unknown>;

      // VercelAI should use camelCase
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_providerMetadata"]).toBeDefined();
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["_provider_metadata"]).toBeUndefined();
    });

    it("should read _knownFields (camelCase) from input and use for translation", () => {
      // GenAI messages with camelCase _knownFields (as if previously translated with VercelAI as target)
      // This simulates: source -> VercelAI (preserve) -> stored -> now translating to Promptl
      const messagesWithCamelCaseKnown: GenAIMessage[] = [
        {
          role: "tool", // Must be "tool" role for Promptl to recognize tool_call_response
          parts: [
            {
              type: "tool_call_response",
              id: "call-123",
              response: "Success",
              // Metadata has camelCase _knownFields (as if from VercelAI output)
              _provider_metadata: {
                _knownFields: { toolName: "get_weather", isError: false },
              },
            },
          ],
        },
      ];

      // Translate to Promptl with passthrough - should use the known fields from _knownFields
      const translator = new Translator({ providerMetadata: "passthrough" });
      const result = translator.translate(messagesWithCamelCaseKnown, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      // The tool name should be extracted from _knownFields and placed on the message
      const message = result.messages[0] as Record<string, unknown>;
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      expect(message["toolName"]).toBe("get_weather");
    });
  });
});
