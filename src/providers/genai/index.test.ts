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
      expect(result?.system?.[0]).toMatchObject({ type: "text", content: "Be helpful" });
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
      expect(result?.system?.[0]).toMatchObject({ type: "text", content: "Be helpful" });
      expect(result?.system?.[1]).toMatchObject({ type: "text", content: "Be concise" });
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
      expect(result?.system?.[0]).toMatchObject({ type: "text", content: "Be helpful" });
      expect(result?.system?.[1]).toMatchObject({ type: "text", content: "Be concise" });
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
      // System parts now include messageIndex metadata for order preservation
      expect(fromResult?.system).toHaveLength(1);
      expect(fromResult?.system?.[0]).toMatchObject({ type: "text", content: "Be helpful" });
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

  describe("_partsMetadata restoration", () => {
    const sourceMap = [{ start: 0, end: 10, identifier: "test" }];

    it("should extract _parts_metadata and apply to first part in passthrough mode", () => {
      const messages: GenAIMessage[] = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
          _provider_metadata: { _parts_metadata: { _promptlSourceMap: sourceMap } },
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      // _parts_metadata should be extracted and applied to first part
      expect(result?.messages[0]?.parts[0]).toHaveProperty("_promptlSourceMap", sourceMap);
    });

    it("should extract _partsMetadata (camelCase) and apply to first part in passthrough mode", () => {
      const messages: GenAIMessage[] = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
          _provider_metadata: { _partsMetadata: { _promptlSourceMap: sourceMap } },
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      // Should handle camelCase version as well
      expect(result?.messages[0]?.parts[0]).toHaveProperty("_promptlSourceMap", sourceMap);
    });

    it("should extract _parts_metadata and apply to first part in preserve mode", () => {
      const messages: GenAIMessage[] = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
          _provider_metadata: { _parts_metadata: { _promptlSourceMap: sourceMap } },
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "output",
        providerMetadata: "preserve",
      });

      // _parts_metadata should be extracted and applied to first part inside _provider_metadata (snake_case)
      const partMeta = result?.messages[0]?.parts[0]?._provider_metadata as { _promptlSourceMap?: unknown } | undefined;
      expect(partMeta?._promptlSourceMap).toEqual(sourceMap);
    });

    it("should not apply _parts_metadata in strip mode", () => {
      const messages: GenAIMessage[] = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
          _provider_metadata: { _parts_metadata: { _promptlSourceMap: sourceMap } },
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "output",
        providerMetadata: "strip",
      });

      // No metadata should be applied in strip mode
      expect((result?.messages[0]?.parts[0] as { _promptlSourceMap?: unknown })._promptlSourceMap).toBeUndefined();
      expect(result?.messages[0]?.parts[0]?._provider_metadata).toBeUndefined();
    });

    it("should apply _parts_metadata only to first part when multiple parts exist", () => {
      const messages: GenAIMessage[] = [
        {
          role: "user",
          parts: [
            { type: "text", content: "Hello" },
            { type: "text", content: "World" },
          ],
          _provider_metadata: { _parts_metadata: { _promptlSourceMap: sourceMap } },
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      // Only first part should have the metadata
      expect((result?.messages[0]?.parts[0] as { _promptlSourceMap?: unknown })._promptlSourceMap).toEqual(sourceMap);
      expect((result?.messages[0]?.parts[1] as { _promptlSourceMap?: unknown })._promptlSourceMap).toBeUndefined();
    });

    it("should not fail when _parts_metadata is not present", () => {
      const messages: GenAIMessage[] = [
        {
          role: "user",
          parts: [{ type: "text", content: "Hello" }],
        },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(result?.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
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

  describe("system message order preservation", () => {
    it("should store messageIndex on system parts when extracting via fromGenAI", () => {
      const messages: GenAIMessage[] = [
        { role: "system", parts: [{ type: "text", content: "First system" }] },
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "system", parts: [{ type: "text", content: "Second system" }] },
      ];

      const result = GenAISpecification.fromGenAI?.({
        messages,
        direction: "input",
        providerMetadata: "preserve",
      });

      expect(result?.system).toHaveLength(2);

      // First system part should have messageIndex 0
      const meta0 = result?.system?.[0]?._provider_metadata as { _known_fields?: { messageIndex?: number } };
      expect(meta0?._known_fields?.messageIndex).toBe(0);

      // Second system part should have messageIndex 2
      const meta1 = result?.system?.[1]?._provider_metadata as { _known_fields?: { messageIndex?: number } };
      expect(meta1?._known_fields?.messageIndex).toBe(2);
    });

    it("should reconstruct system message positions in toGenAI using messageIndex", () => {
      const system: GenAISystem = [
        { type: "text", content: "First system", _provider_metadata: { _known_fields: { messageIndex: 0 } } },
        { type: "text", content: "Second system", _provider_metadata: { _known_fields: { messageIndex: 2 } } },
      ];
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi" }] },
      ];

      const result = GenAISpecification.toGenAI({ messages, system, direction: "input" });

      expect(result.messages).toHaveLength(4);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[0]?.parts[0]).toMatchObject({ type: "text", content: "First system" });
      expect(result.messages[1]?.role).toBe("user");
      expect(result.messages[2]?.role).toBe("system");
      expect(result.messages[2]?.parts[0]).toMatchObject({ type: "text", content: "Second system" });
      expect(result.messages[3]?.role).toBe("assistant");
    });

    it("should preserve system message order through round-trip (toGenAI -> fromGenAI -> toGenAI)", () => {
      const originalMessages: GenAIMessage[] = [
        { role: "system", parts: [{ type: "text", content: "Be helpful" }] },
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "system", parts: [{ type: "text", content: "Be concise" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi!" }] },
      ];

      // Step 1: fromGenAI extracts system with indices
      const fromResult = GenAISpecification.fromGenAI?.({
        messages: originalMessages,
        direction: "input",
        providerMetadata: "preserve",
      });

      expect(fromResult?.messages).toHaveLength(2);
      expect(fromResult?.system).toHaveLength(2);

      // Step 2: toGenAI re-inserts system at original positions
      const toResult = GenAISpecification.toGenAI({
        messages: fromResult?.messages ?? [],
        system: fromResult?.system,
        direction: "input",
      });

      expect(toResult.messages).toHaveLength(4);
      expect(toResult.messages[0]?.role).toBe("system");
      expect(toResult.messages[0]?.parts[0]).toMatchObject({ type: "text", content: "Be helpful" });
      expect(toResult.messages[1]?.role).toBe("user");
      expect(toResult.messages[2]?.role).toBe("system");
      expect(toResult.messages[2]?.parts[0]).toMatchObject({ type: "text", content: "Be concise" });
      expect(toResult.messages[3]?.role).toBe("assistant");
    });

    it("should fall back to prepend when system parts have no messageIndex", () => {
      const system: GenAISystem = [
        { type: "text", content: "System A" },
        { type: "text", content: "System B" },
      ];
      const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hello" }] }];

      const result = GenAISpecification.toGenAI({ messages, system, direction: "input" });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[1]?.role).toBe("user");
    });

    it("should clamp out-of-bounds indices to array end", () => {
      const system: GenAISystem = [
        { type: "text", content: "A", _provider_metadata: { _known_fields: { messageIndex: 5 } } },
        { type: "text", content: "B", _provider_metadata: { _known_fields: { messageIndex: 10 } } },
      ];
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi" }] },
      ];

      const result = GenAISpecification.toGenAI({ messages, system, direction: "input" });

      // Both indices are beyond array length (2), so they get clamped to end
      expect(result.messages).toHaveLength(4);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[2]?.role).toBe("system");
      expect(result.messages[3]?.role).toBe("system");
    });

    it("should keep index 0 system message at the beginning", () => {
      const system: GenAISystem = [
        { type: "text", content: "System", _provider_metadata: { _known_fields: { messageIndex: 0 } } },
      ];
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi" }] },
      ];

      const result = GenAISpecification.toGenAI({ messages, system, direction: "input" });

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[1]?.role).toBe("user");
      expect(result.messages[2]?.role).toBe("assistant");
    });

    it("should merge parts with the same messageIndex into a single system message", () => {
      const system: GenAISystem = [
        { type: "text", content: "Part A", _provider_metadata: { _known_fields: { messageIndex: 1 } } },
        { type: "text", content: "Part B", _provider_metadata: { _known_fields: { messageIndex: 1 } } },
      ];
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi" }] },
      ];

      const result = GenAISpecification.toGenAI({ messages, system, direction: "input" });

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("system");
      expect(result.messages[1]?.parts).toHaveLength(2);
      expect(result.messages[1]?.parts[0]).toMatchObject({ type: "text", content: "Part A" });
      expect(result.messages[1]?.parts[1]).toMatchObject({ type: "text", content: "Part B" });
      expect(result.messages[2]?.role).toBe("assistant");
    });

    it("should handle mixed parts with and without messageIndex (prepend those without)", () => {
      const system: GenAISystem = [
        { type: "text", content: "No index" },
        { type: "text", content: "At pos 2", _provider_metadata: { _known_fields: { messageIndex: 2 } } },
      ];
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi" }] },
      ];

      const result = GenAISpecification.toGenAI({ messages, system, direction: "input" });

      // The part without index goes to position 0 (prepended), the one with index goes to position 2
      expect(result.messages).toHaveLength(4);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[0]?.parts[0]).toMatchObject({ type: "text", content: "No index" });
      expect(result.messages[1]?.role).toBe("user");
      expect(result.messages[2]?.role).toBe("system");
      expect(result.messages[2]?.parts[0]).toMatchObject({ type: "text", content: "At pos 2" });
      expect(result.messages[3]?.role).toBe("assistant");
    });

    it("should preserve multi-part system messages through fromGenAI with correct index", () => {
      const messages: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        {
          role: "system",
          parts: [
            { type: "text", content: "Part 1" },
            { type: "text", content: "Part 2" },
          ],
        },
        { role: "assistant", parts: [{ type: "text", content: "Hi!" }] },
      ];

      const fromResult = GenAISpecification.fromGenAI?.({
        messages,
        direction: "input",
        providerMetadata: "preserve",
      });

      // Both parts should have messageIndex 1
      expect(fromResult?.system).toHaveLength(2);
      const meta0 = fromResult?.system?.[0]?._provider_metadata as { _known_fields?: { messageIndex?: number } };
      const meta1 = fromResult?.system?.[1]?._provider_metadata as { _known_fields?: { messageIndex?: number } };
      expect(meta0?._known_fields?.messageIndex).toBe(1);
      expect(meta1?._known_fields?.messageIndex).toBe(1);

      // Round-trip: toGenAI should merge them back at position 1
      const toResult = GenAISpecification.toGenAI({
        messages: fromResult?.messages ?? [],
        system: fromResult?.system,
        direction: "input",
      });

      expect(toResult.messages).toHaveLength(3);
      expect(toResult.messages[0]?.role).toBe("user");
      expect(toResult.messages[1]?.role).toBe("system");
      expect(toResult.messages[1]?.parts).toHaveLength(2);
      expect(toResult.messages[2]?.role).toBe("assistant");
    });
  });
});
