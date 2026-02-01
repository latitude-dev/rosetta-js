/**
 * GenAI Provider Tests
 */

import { describe, expect, it } from "vitest";
import type { GenAIMessage, GenAISystem } from "$package/core/genai";
import { GenAISpecification } from "$package/providers/genai";

describe("GenAISpecification", () => {
  describe("toGenAI", () => {
    it("should convert a string message to GenAI format with user role for input direction", () => {
      const result = GenAISpecification.toGenAI({
        messages: "Hello, world!",
        direction: "input",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "Hello, world!",
      });
    });

    it("should convert a string message to GenAI format with assistant role for output direction", () => {
      const result = GenAISpecification.toGenAI({
        messages: "I can help you!",
        direction: "output",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "I can help you!",
      });
    });

    it("should pass through GenAI messages unchanged", () => {
      const messages: GenAIMessage[] = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
        },
        {
          role: "assistant",
          parts: [{ type: "text", content: "Hi there!" }],
        },
      ];

      const result = GenAISpecification.toGenAI({
        messages,
        direction: "input",
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should convert string system to system role message and prepend it", () => {
      const result = GenAISpecification.toGenAI({
        messages: "Hello",
        system: "You are a helpful assistant.",
        direction: "input",
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[0]?.parts).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "You are a helpful assistant.",
      });
      expect(result.messages[1]?.role).toBe("user");
    });

    it("should convert system parts to system role message and prepend it", () => {
      const system: GenAISystem = [
        { type: "text", content: "Be helpful" },
        { type: "text", content: "Be concise" },
      ];

      const result = GenAISpecification.toGenAI({
        messages: "Hello",
        system,
        direction: "input",
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts).toEqual(system);
    });

    it("should convert single object system to system role message and prepend it", () => {
      const system = { type: "text", content: "You are helpful" };

      const result = GenAISpecification.toGenAI({
        messages: "Hello",
        system,
        direction: "input",
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[0]?.parts).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toEqual(system);
    });

    it("should not prepend system message when system is undefined", () => {
      const result = GenAISpecification.toGenAI({
        messages: "Hello",
        system: undefined,
        direction: "input",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
    });

    it("should not prepend system message when system is empty array", () => {
      const result = GenAISpecification.toGenAI({
        messages: "Hello",
        system: [],
        direction: "input",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
    });

    it("should validate messages with provider metadata", () => {
      const messages: GenAIMessage[] = [
        {
          role: "user",
          parts: [
            {
              type: "text",
              content: "Hello",
              _provider_metadata: {},
            },
          ],
          name: null,
          _provider_metadata: {},
        },
      ];

      const result = GenAISpecification.toGenAI({
        messages,
        direction: "input",
      });

      expect(result.messages[0]?._provider_metadata).toEqual({});
      expect(result.messages[0]?.parts[0]?._provider_metadata).toEqual({});
    });

    it("should preserve message order when adding system", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "First" }] },
        { role: "assistant", parts: [{ type: "text", content: "Second" }] },
        { role: "user", parts: [{ type: "text", content: "Third" }] },
      ];

      const result = GenAISpecification.toGenAI({
        messages,
        system: "System prompt",
        direction: "input",
      });

      expect(result.messages).toHaveLength(4);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[1]?.role).toBe("user");
      expect(result.messages[2]?.role).toBe("assistant");
      expect(result.messages[3]?.role).toBe("user");
    });
  });

  describe("fromGenAI", () => {
    it("should return messages without system role unchanged", () => {
      const messages: GenAIMessage[] = [
        {
          role: "assistant",
          parts: [{ type: "text", content: "I can help you!" }],
          finish_reason: "stop",
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "output",
        providerMetadata: "strip",
      });

      expect(result?.messages).toEqual(messages);
      expect(result?.system).toBeUndefined();
    });

    it("should extract system role messages and return as system", () => {
      const messages: GenAIMessage[] = [
        {
          role: "system",
          parts: [{ type: "text", content: "Be helpful" }],
        },
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "output",
        providerMetadata: "strip",
      });

      expect(result?.messages).toHaveLength(1);
      expect(result?.messages[0]?.role).toBe("user");
      expect(result?.system).toHaveLength(1);
      expect(result?.system?.[0]).toEqual({ type: "text", content: "Be helpful" });
    });

    it("should merge multiple system messages into system array", () => {
      const messages: GenAIMessage[] = [
        {
          role: "system",
          parts: [{ type: "text", content: "Be helpful" }],
        },
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
        },
        {
          role: "system",
          parts: [{ type: "text", content: "Be concise" }],
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "output",
        providerMetadata: "strip",
      });

      expect(result?.messages).toHaveLength(1);
      expect(result?.system).toHaveLength(2);
      expect(result?.system?.[0]).toEqual({ type: "text", content: "Be helpful" });
      expect(result?.system?.[1]).toEqual({ type: "text", content: "Be concise" });
    });

    it("should return undefined system when no system messages exist", () => {
      const messages: GenAIMessage[] = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
        },
        {
          role: "assistant",
          parts: [{ type: "text", content: "Hi!" }],
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "output",
        providerMetadata: "strip",
      });

      expect(result?.messages).toHaveLength(2);
      expect(result?.system).toBeUndefined();
    });

    it("should handle system message with multiple parts", () => {
      const messages: GenAIMessage[] = [
        {
          role: "system",
          parts: [
            { type: "text", content: "Be helpful" },
            { type: "text", content: "Be concise" },
          ],
        },
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "output",
        providerMetadata: "strip",
      });

      expect(result?.messages).toHaveLength(1);
      expect(result?.system).toHaveLength(2);
      expect(result?.system).toEqual([
        { type: "text", content: "Be helpful" },
        { type: "text", content: "Be concise" },
      ]);
    });
  });

  describe("round-trip conversion", () => {
    it("should preserve messages through toGenAI -> fromGenAI", () => {
      const originalMessages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi there!" }] },
      ];
      const originalSystem: GenAISystem = [{ type: "text", content: "Be helpful" }];

      const toResult = GenAISpecification.toGenAI({
        messages: originalMessages,
        system: originalSystem,
        direction: "input",
      });

      const fromResult = GenAISpecification.fromGenAI?.({
        messages: toResult.messages,
        direction: "output",
        providerMetadata: "strip",
      });

      expect(fromResult?.messages).toEqual(originalMessages);
      expect(fromResult?.system).toEqual(originalSystem);
    });
  });

  describe("schema validation", () => {
    it("should have messageSchema defined", () => {
      expect(GenAISpecification.messageSchema).toBeDefined();
    });

    it("should have systemSchema defined", () => {
      expect(GenAISpecification.systemSchema).toBeDefined();
    });

    it("should validate a valid message", () => {
      const message: GenAIMessage = {
        role: "user",
        parts: [{ type: "text", content: "Hello" }],
      };

      const result = GenAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should reject an invalid message", () => {
      const invalidMessage = {
        role: "user",
        // missing parts
      };

      const result = GenAISpecification.messageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it("should validate a valid system", () => {
      const system: GenAISystem = [{ type: "text", content: "Be helpful" }];

      const result = GenAISpecification.systemSchema?.safeParse(system);
      expect(result?.success).toBe(true);
    });

    it("should accept custom part types via GenAIGenericPartSchema", () => {
      // The schema is extensible - unknown types fall through to GenAIGenericPartSchema
      const messageWithCustomPart = {
        role: "user",
        parts: [{ type: "custom_type", data: "some data" }],
      };

      const result = GenAISpecification.messageSchema.safeParse(messageWithCustomPart);
      expect(result.success).toBe(true);
    });

    it("should accept custom roles via union with z.string()", () => {
      // The schema is extensible - unknown roles are accepted as strings
      const messageWithCustomRole = {
        role: "custom_role",
        parts: [{ type: "text", content: "Hello" }],
      };

      const result = GenAISpecification.messageSchema.safeParse(messageWithCustomRole);
      expect(result.success).toBe(true);
    });

    it("should reject message without parts array", () => {
      const invalidMessage = {
        role: "user",
        parts: "not an array",
      };

      const result = GenAISpecification.messageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it("should reject part without type field", () => {
      const invalidMessage = {
        role: "user",
        parts: [{ content: "Hello" }], // missing type
      };

      const result = GenAISpecification.messageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it("should reject empty parts object", () => {
      const invalidMessage = {
        role: "user",
        parts: [{}], // empty object - no type field
      };

      const result = GenAISpecification.messageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });
  });

  describe("passthrough - unknown fields preservation", () => {
    it("should preserve unknown fields on messages during parsing", () => {
      const message = {
        role: "user",
        parts: [{ type: "text", content: "Hello" }],
        unknown_field: "preserved",
        metadata: { custom: true },
      };

      const result = GenAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("unknown_field", "preserved");
        expect(result.data).toHaveProperty("metadata", { custom: true });
      }
    });

    it("should preserve unknown fields on text parts during parsing", () => {
      const message = {
        role: "user",
        parts: [
          {
            type: "text",
            content: "Hello",
            custom_field: "value",
            annotations: [{ type: "highlight" }],
          },
        ],
      };

      const result = GenAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parts[0]).toHaveProperty("custom_field", "value");
        expect(result.data.parts[0]).toHaveProperty("annotations", [{ type: "highlight" }]);
      }
    });

    it("should preserve unknown fields on blob parts during parsing", () => {
      const message = {
        role: "user",
        parts: [
          {
            type: "blob",
            modality: "image",
            content: "base64data",
            original_filename: "image.png",
            uploaded_at: "2024-01-01",
          },
        ],
      };

      const result = GenAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parts[0]).toHaveProperty("original_filename", "image.png");
        expect(result.data.parts[0]).toHaveProperty("uploaded_at", "2024-01-01");
      }
    });

    it("should preserve unknown fields on uri parts during parsing", () => {
      const message = {
        role: "user",
        parts: [
          {
            type: "uri",
            modality: "image",
            uri: "https://example.com/img.jpg",
            alt_text: "An image",
            dimensions: { width: 800, height: 600 },
          },
        ],
      };

      const result = GenAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parts[0]).toHaveProperty("alt_text", "An image");
        expect(result.data.parts[0]).toHaveProperty("dimensions", { width: 800, height: 600 });
      }
    });

    it("should preserve unknown fields on tool_call parts during parsing", () => {
      const message = {
        role: "assistant",
        parts: [
          {
            type: "tool_call",
            name: "get_weather",
            arguments: { city: "NYC" },
            priority: "high",
            timeout_ms: 5000,
          },
        ],
      };

      const result = GenAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parts[0]).toHaveProperty("priority", "high");
        expect(result.data.parts[0]).toHaveProperty("timeout_ms", 5000);
      }
    });

    it("should preserve unknown fields on tool_call_response parts during parsing", () => {
      const message = {
        role: "tool",
        parts: [
          {
            type: "tool_call_response",
            id: "call_123",
            response: { result: "ok" },
            execution_time_ms: 150,
            cached: true,
          },
        ],
      };

      const result = GenAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parts[0]).toHaveProperty("execution_time_ms", 150);
        expect(result.data.parts[0]).toHaveProperty("cached", true);
      }
    });

    it("should preserve unknown fields on reasoning parts during parsing", () => {
      const message = {
        role: "assistant",
        parts: [
          {
            type: "reasoning",
            content: "Let me think...",
            thinking_time_ms: 2000,
            model_confidence: 0.95,
          },
        ],
      };

      const result = GenAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parts[0]).toHaveProperty("thinking_time_ms", 2000);
        expect(result.data.parts[0]).toHaveProperty("model_confidence", 0.95);
      }
    });

    it("should preserve unknown fields through toGenAI conversion", () => {
      const messages = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello", custom: "field" }],
          extra_message_field: "value",
        },
      ];

      const result = GenAISpecification.toGenAI({
        messages: messages as never,
        direction: "input",
      });

      expect(result.messages[0]).toHaveProperty("extra_message_field", "value");
      expect(result.messages[0]?.parts[0]).toHaveProperty("custom", "field");
    });

    it("should preserve unknown fields through fromGenAI conversion with passthrough", () => {
      const messages = [
        {
          role: "assistant",
          parts: [{ type: "text", content: "Hello", custom: "field" }],
          extra_message_field: "value",
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages: messages as never,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(result?.messages[0]).toHaveProperty("extra_message_field", "value");
      expect(result?.messages[0]?.parts[0]).toHaveProperty("custom", "field");
    });

    it("should preserve unknown fields through round-trip conversion with passthrough", () => {
      const originalMessages = [
        {
          role: "user",
          parts: [
            {
              type: "text",
              content: "Hello",
              custom_part_field: "part_value",
            },
          ],
          custom_message_field: "message_value",
        },
      ];

      const toResult = GenAISpecification.toGenAI({
        messages: originalMessages as never,
        direction: "input",
      });

      const fromResult = GenAISpecification.fromGenAI?.({
        messages: toResult.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(fromResult?.messages[0]).toHaveProperty("custom_message_field", "message_value");
      expect(fromResult?.messages[0]?.parts[0]).toHaveProperty("custom_part_field", "part_value");
    });
  });
});
