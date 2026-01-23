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
                promptl: { toolName: "get_weather" },
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
            _provider_metadata: { promptl: { field: "value" } },
          },
        ],
        _provider_metadata: { promptl: { messageField: "messageValue" } },
      },
    ];

    const result = translator.translate(messages, {
      from: Provider.GenAI,
      to: Provider.GenAI,
    });

    expect(result.messages[0]?._provider_metadata).toEqual({ promptl: { messageField: "messageValue" } });
    expect(result.messages[0]?.parts[0]?._provider_metadata).toEqual({ promptl: { field: "value" } });
  });
});
