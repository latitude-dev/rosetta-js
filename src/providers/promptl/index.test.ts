/**
 * Promptl Provider Tests
 */

import { describe, expect, it } from "vitest";
import type { GenAIMessage } from "$package/core/genai";
import { PromptlSpecification } from "$package/providers/promptl";
import type { PromptlMessage } from "$package/providers/promptl/schema";

describe("PromptlSpecification", () => {
  describe("toGenAI", () => {
    describe("string messages", () => {
      it("should convert a string message to GenAI format with user role for input direction", () => {
        const result = PromptlSpecification.toGenAI({
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
        const result = PromptlSpecification.toGenAI({
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
    });

    describe("text content", () => {
      it("should convert a user message with text content", () => {
        const messages: PromptlMessage[] = [{ role: "user", content: [{ type: "text", text: "Hello" }] }];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Hello",
        });
      });

      it("should convert an assistant message with text content", () => {
        const messages: PromptlMessage[] = [{ role: "assistant", content: [{ type: "text", text: "Hi there!" }] }];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("assistant");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Hi there!",
        });
      });

      it("should handle undefined text content", () => {
        const messages: PromptlMessage[] = [{ role: "user", content: [{ type: "text", text: undefined }] }];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "",
        });
      });

      it("should preserve _promptlSourceMap in metadata", () => {
        const sourceMap = [{ line: 1, column: 0 }];
        const messages: PromptlMessage[] = [
          { role: "user", content: [{ type: "text", text: "Hello", _promptlSourceMap: sourceMap }] },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
        expect(result.messages[0]?.parts[0]?._provider_metadata?.["_promptlSourceMap"]).toEqual(sourceMap);
      });
    });

    describe("role mapping", () => {
      it("should convert system role messages", () => {
        const messages: PromptlMessage[] = [{ role: "system", content: [{ type: "text", text: "Be helpful" }] }];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.role).toBe("system");
      });

      it("should pass developer role directly to GenAI (GenAI accepts any string role)", () => {
        const messages: PromptlMessage[] = [
          { role: "developer", content: [{ type: "text", text: "Developer instructions" }] },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.role).toBe("developer");
      });

      it("should convert user role messages with name", () => {
        const messages: PromptlMessage[] = [
          { role: "user", name: "Alice", content: [{ type: "text", text: "Hello" }] },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.role).toBe("user");
        expect(result.messages[0]?.name).toBe("Alice");
      });
    });

    describe("image content", () => {
      it("should convert image with URL string to uri part", () => {
        const messages: PromptlMessage[] = [
          { role: "user", content: [{ type: "image", image: "https://example.com/image.png" }] },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "uri",
          modality: "image",
          uri: "https://example.com/image.png",
        });
      });

      it("should convert image with data URL to uri part", () => {
        const messages: PromptlMessage[] = [
          { role: "user", content: [{ type: "image", image: "data:image/png;base64,abc123" }] },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "uri",
          modality: "image",
          uri: "data:image/png;base64,abc123",
        });
      });

      it("should convert image with base64 string to blob part", () => {
        const messages: PromptlMessage[] = [{ role: "user", content: [{ type: "image", image: "SGVsbG8gV29ybGQ=" }] }];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "blob",
          modality: "image",
          content: "SGVsbG8gV29ybGQ=",
        });
      });

      it("should convert image with Uint8Array to blob part with base64", () => {
        const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
        const messages: PromptlMessage[] = [{ role: "user", content: [{ type: "image", image: bytes }] }];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]?.type).toBe("blob");
        expect((result.messages[0]?.parts[0] as { modality: string }).modality).toBe("image");
        // Base64 of "Hello"
        expect((result.messages[0]?.parts[0] as { content: string }).content).toBe("SGVsbG8=");
      });

      it("should convert image with URL instance to uri part", () => {
        const messages: PromptlMessage[] = [
          { role: "user", content: [{ type: "image", image: new URL("https://example.com/img.jpg") }] },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "uri",
          modality: "image",
          uri: "https://example.com/img.jpg",
        });
      });
    });

    describe("file content", () => {
      it("should convert file with URL string to uri part with mimeType", () => {
        const messages: PromptlMessage[] = [
          {
            role: "user",
            content: [{ type: "file", file: "https://example.com/doc.pdf", mimeType: "application/pdf" }],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "uri",
          modality: "document",
          mime_type: "application/pdf",
          uri: "https://example.com/doc.pdf",
        });
      });

      it("should convert file with base64 string to blob part", () => {
        const messages: PromptlMessage[] = [
          { role: "user", content: [{ type: "file", file: "SGVsbG8=", mimeType: "text/plain" }] },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "blob",
          modality: "document",
          mime_type: "text/plain",
          content: "SGVsbG8=",
        });
      });

      it("should infer image modality from mimeType", () => {
        const messages: PromptlMessage[] = [
          { role: "user", content: [{ type: "file", file: "abc", mimeType: "image/jpeg" }] },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect((result.messages[0]?.parts[0] as { modality: string }).modality).toBe("image");
      });

      it("should infer video modality from mimeType", () => {
        const messages: PromptlMessage[] = [
          { role: "user", content: [{ type: "file", file: "abc", mimeType: "video/mp4" }] },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect((result.messages[0]?.parts[0] as { modality: string }).modality).toBe("video");
      });

      it("should infer audio modality from mimeType", () => {
        const messages: PromptlMessage[] = [
          { role: "user", content: [{ type: "file", file: "abc", mimeType: "audio/mpeg" }] },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect((result.messages[0]?.parts[0] as { modality: string }).modality).toBe("audio");
      });
    });

    describe("reasoning content", () => {
      it("should convert reasoning content to reasoning part", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: [{ type: "reasoning", text: "Let me think about this..." }],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "reasoning",
          content: "Let me think about this...",
        });
      });

      it("should preserve reasoning metadata (id, isStreaming)", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: [{ type: "reasoning", text: "Thinking...", id: "reasoning-1", isStreaming: true }],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages[0]?.parts[0]?._provider_metadata).toMatchObject({
          id: "reasoning-1",
          isStreaming: true,
        });
      });
    });

    describe("redacted-reasoning content", () => {
      it("should convert redacted-reasoning to reasoning part with originalType metadata", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: [{ type: "redacted-reasoning", data: "encrypted-data-here" }],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        // Should be mapped to reasoning (closest GenAI equivalent) with originalType in _known_fields
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "reasoning",
          content: "encrypted-data-here",
          _provider_metadata: {
            _known_fields: { originalType: "redacted-reasoning" },
          },
        });
      });
    });

    describe("tool-call content with backwards compatibility", () => {
      it("should convert tool-call with args (new format) to tool_call part", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "call-123",
                toolName: "get_weather",
                args: { city: "Paris" },
              },
            ],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call",
          id: "call-123",
          name: "get_weather",
          arguments: { city: "Paris" },
        });
      });

      it("should convert tool-call with toolArguments (legacy format) to tool_call part", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "call-456",
                toolName: "search",
                toolArguments: { query: "test" },
              },
            ],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call",
          id: "call-456",
          name: "search",
          arguments: { query: "test" },
        });
      });

      it("should prefer args over toolArguments when both are present", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "call-789",
                toolName: "test",
                args: { new: "value" },
                toolArguments: { old: "value" },
              },
            ],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        expect((result.messages[0]?.parts[0] as { arguments: unknown }).arguments).toEqual({ new: "value" });
      });

      it("should preserve _sourceData in tool-call metadata", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "call-src",
                toolName: "test",
                args: {},
                _sourceData: { line: 10, file: "test.ts" },
              },
            ],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
        expect(result.messages[0]?.parts[0]?._provider_metadata?.["_sourceData"]).toEqual({
          line: 10,
          file: "test.ts",
        });
      });
    });

    describe("tool-result content (new format)", () => {
      it("should convert tool-result content to tool_call_response part", () => {
        const messages: PromptlMessage[] = [
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "call-123",
                toolName: "get_weather",
                result: { temp: 22, condition: "sunny" },
              },
            ],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.role).toBe("tool");
        expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
        expect((result.messages[0]?.parts[0] as { id: string }).id).toBe("call-123");
        expect((result.messages[0]?.parts[0] as { response: unknown }).response).toEqual({
          temp: 22,
          condition: "sunny",
        });
        // toolName is stored in _known_fields for cross-provider access
        expect(
          // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
          (result.messages[0]?.parts[0]?._provider_metadata?._known_fields as Record<string, unknown>)?.["toolName"],
        ).toBe("get_weather");
      });

      it("should preserve isError in tool-result metadata", () => {
        const messages: PromptlMessage[] = [
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "call-err",
                toolName: "failing_tool",
                result: "Error: Something went wrong",
                isError: true,
              },
            ],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        // isError is stored in _known_fields for cross-provider access
        expect(
          // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
          (result.messages[0]?.parts[0]?._provider_metadata?._known_fields as Record<string, unknown>)?.["isError"],
        ).toBe(true);
      });
    });

    describe("tool role messages (legacy format)", () => {
      it("should convert legacy tool message to tool_call_response part", () => {
        const messages: PromptlMessage[] = [
          {
            role: "tool",
            toolName: "get_weather",
            toolId: "call-123",
            content: [{ type: "text", text: "Sunny, 22°C" }],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.role).toBe("tool");
        expect(result.messages[0]?.parts).toHaveLength(1);
        expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
        expect((result.messages[0]?.parts[0] as { id: string }).id).toBe("call-123");
        expect((result.messages[0]?.parts[0] as { response: unknown }).response).toBe("Sunny, 22°C");
        // toolName is stored in _known_fields for cross-provider access
        expect(
          // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
          (result.messages[0]?.parts[0]?._provider_metadata?._known_fields as Record<string, unknown>)?.["toolName"],
        ).toBe("get_weather");
      });

      it("should convert legacy tool message with multiple content parts to array response", () => {
        const messages: PromptlMessage[] = [
          {
            role: "tool",
            toolName: "get_data",
            toolId: "call-456",
            content: [
              { type: "text", text: "Part 1" },
              { type: "text", text: "Part 2" },
            ],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        const response = (result.messages[0]?.parts[0] as { response: unknown }).response;
        expect(Array.isArray(response)).toBe(true);
        expect((response as unknown[]).length).toBe(2);
      });
    });

    describe("assistant message with toolCalls array", () => {
      it("should convert toolCalls array to additional tool_call parts", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: [{ type: "text", text: "Let me check the weather for you." }],
            toolCalls: [
              { id: "call-1", name: "get_weather", arguments: { city: "Paris" } },
              { id: "call-2", name: "get_weather", arguments: { city: "London" } },
            ],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages[0]?.parts).toHaveLength(3);
        expect(result.messages[0]?.parts[0]?.type).toBe("text");
        expect(result.messages[0]?.parts[1]?.type).toBe("tool_call");
        expect(result.messages[0]?.parts[2]?.type).toBe("tool_call");
        expect((result.messages[0]?.parts[1] as { id: string }).id).toBe("call-1");
        expect((result.messages[0]?.parts[2] as { id: string }).id).toBe("call-2");
      });

      it("should handle assistant message with string content", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: "Hello, I'm here to help!",
            toolCalls: null,
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages[0]?.parts).toHaveLength(1);
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Hello, I'm here to help!",
        });
      });

      it("should preserve _sourceData in toolCalls metadata", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: [],
            toolCalls: [{ id: "call-1", name: "test", arguments: {}, _sourceData: { line: 5 } }],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
        expect(result.messages[0]?.parts[0]?._provider_metadata?.["_sourceData"]).toEqual({ line: 5 });
      });

      it("should deduplicate tool calls when same id appears in both content and toolCalls", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: [{ type: "tool-call", toolCallId: "call-1", toolName: "search", args: { query: "test" } }],
            toolCalls: [
              { id: "call-1", name: "search", arguments: { query: "test" } }, // duplicate
              { id: "call-2", name: "calculator", arguments: { op: "add" } }, // new
            ],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        // Should have only 2 tool calls, not 3 (deduplicates call-1)
        expect(result.messages[0]?.parts).toHaveLength(2);
        const toolCallIds = result.messages[0]?.parts.map((p) => (p as { id: string }).id);
        expect(toolCallIds).toContain("call-1");
        expect(toolCallIds).toContain("call-2");
      });

      it("should not add tool calls from toolCalls that already exist in content", () => {
        const messages: PromptlMessage[] = [
          {
            role: "assistant",
            content: [
              { type: "text", text: "Calling tools" },
              { type: "tool-call", toolCallId: "call-a", toolName: "tool_a", args: {} },
              { type: "tool-call", toolCallId: "call-b", toolName: "tool_b", args: {} },
            ],
            toolCalls: [
              { id: "call-a", name: "tool_a", arguments: {} },
              { id: "call-b", name: "tool_b", arguments: {} },
            ],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "output" });

        // Should have 1 text + 2 tool calls = 3 parts, not 5
        expect(result.messages[0]?.parts).toHaveLength(3);
        expect(result.messages[0]?.parts[0]?.type).toBe("text");
        expect(result.messages[0]?.parts[1]?.type).toBe("tool_call");
        expect(result.messages[0]?.parts[2]?.type).toBe("tool_call");
      });
    });

    describe("extra fields preservation", () => {
      it("should preserve extra message fields in metadata", () => {
        const messages = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: "Hello" }],
            customField: "custom value",
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signature access
        expect(result.messages[0]?._provider_metadata?.["customField"]).toBe("custom value");
      });

      it("should preserve extra content fields in part metadata", () => {
        const messages = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: "Hello", customProp: 123 }],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signature access
        expect(result.messages[0]?.parts[0]?._provider_metadata?.["customProp"]).toBe(123);
      });
    });

    describe("multiple messages", () => {
      it("should convert multiple messages in order", () => {
        const messages: PromptlMessage[] = [
          { role: "system", content: [{ type: "text", text: "Be helpful" }] },
          { role: "user", content: [{ type: "text", text: "Hello" }] },
          { role: "assistant", content: [{ type: "text", text: "Hi!" }] },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages).toHaveLength(3);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[1]?.role).toBe("user");
        expect(result.messages[2]?.role).toBe("assistant");
      });

      it("should convert message with multiple content parts", () => {
        const messages: PromptlMessage[] = [
          {
            role: "user",
            content: [
              { type: "text", text: "Check this image:" },
              { type: "image", image: "https://example.com/img.png" },
            ],
          },
        ];

        const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts).toHaveLength(2);
        expect(result.messages[0]?.parts[0]?.type).toBe("text");
        expect(result.messages[0]?.parts[1]?.type).toBe("uri");
      });
    });
  });

  describe("fromGenAI", () => {
    describe("text content", () => {
      it("should convert GenAI text part to Promptl text content", () => {
        const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hello" }] }];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.messages[0]?.content[0]).toEqual({ type: "text", text: "Hello" });
      });

      it("should restore _promptlSourceMap from metadata", () => {
        const sourceMap = [{ line: 1, column: 5 }];
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "text", content: "Hello", _provider_metadata: { _promptlSourceMap: sourceMap } }],
          },
        ];

        // Use passthrough mode to spread extra fields on output content
        const result = PromptlSpecification.fromGenAI({
          messages,
          direction: "output",
          providerMetadata: "passthrough",
        });

        expect((result.messages[0]?.content[0] as { _promptlSourceMap?: unknown })._promptlSourceMap).toEqual(
          sourceMap,
        );
      });
    });

    describe("role mapping", () => {
      it("should convert system role", () => {
        const messages: GenAIMessage[] = [{ role: "system", parts: [{ type: "text", content: "Be helpful" }] }];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.role).toBe("system");
      });

      it("should convert developer role from GenAI to Promptl developer", () => {
        const messages: GenAIMessage[] = [
          {
            role: "developer",
            parts: [{ type: "text", content: "Developer message" }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.role).toBe("developer");
      });

      it("should convert user role with name", () => {
        const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hi" }], name: "Bob" }];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.role).toBe("user");
        expect((result.messages[0] as { name?: string }).name).toBe("Bob");
      });

      it("should convert assistant role", () => {
        const messages: GenAIMessage[] = [{ role: "assistant", parts: [{ type: "text", content: "Hello!" }] }];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.role).toBe("assistant");
      });

      it("should default unknown roles to user", () => {
        const messages: GenAIMessage[] = [{ role: "custom_role", parts: [{ type: "text", content: "Hello" }] }];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.role).toBe("user");
      });
    });

    describe("blob content", () => {
      it("should convert image blob to Promptl image content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "blob", modality: "image", content: "SGVsbG8=" }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.content[0]).toEqual({ type: "image", image: "SGVsbG8=" });
      });

      it("should convert non-image blob to Promptl file content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "blob", modality: "audio", mime_type: "audio/mpeg", content: "abc123" }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.content[0]).toEqual({
          type: "file",
          file: "abc123",
          mimeType: "audio/mpeg",
        });
      });

      it("should use default mimeType for blob without mime_type", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "blob", modality: "video", content: "xyz" }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect((result.messages[0]?.content[0] as { mimeType?: string }).mimeType).toBe("application/video");
      });
    });

    describe("uri content", () => {
      it("should convert image uri to Promptl image content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "uri", modality: "image", uri: "https://example.com/img.png" }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.content[0]).toEqual({
          type: "image",
          image: "https://example.com/img.png",
        });
      });

      it("should convert non-image uri to Promptl file content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [
              { type: "uri", modality: "document", mime_type: "application/pdf", uri: "https://example.com/doc.pdf" },
            ],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.content[0]).toEqual({
          type: "file",
          file: "https://example.com/doc.pdf",
          mimeType: "application/pdf",
        });
      });
    });

    describe("file content", () => {
      it("should convert GenAI file part to Promptl file content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "file", modality: "document", file_id: "file-123", mime_type: "text/plain" }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.content[0]).toEqual({
          type: "file",
          file: "file-123",
          mimeType: "text/plain",
        });
      });
    });

    describe("tool_call content with backwards compatibility", () => {
      it("should convert tool_call to Promptl tool-call with both args and toolArguments", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "tool_call", id: "call-789", name: "search", arguments: { query: "test" } }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.content[0]).toEqual({
          type: "tool-call",
          toolCallId: "call-789",
          toolName: "search",
          args: { query: "test" },
          toolArguments: { query: "test" },
        });
      });

      it("should handle tool_call with null id", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "tool_call", id: null, name: "test_tool", arguments: {} }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect((result.messages[0]?.content[0] as { toolCallId: string }).toolCallId).toBe("");
      });

      it("should handle tool_call with undefined arguments", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "tool_call", id: "call-1", name: "no_args" }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect((result.messages[0]?.content[0] as { args: unknown }).args).toEqual({});
        expect((result.messages[0]?.content[0] as { toolArguments: unknown }).toolArguments).toEqual({});
      });
    });

    describe("reasoning content", () => {
      it("should convert reasoning part to Promptl reasoning content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "reasoning", content: "Let me think about this..." }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.content[0]).toEqual({
          type: "reasoning",
          text: "Let me think about this...",
        });
      });

      it("should restore reasoning metadata from part metadata", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [
              {
                type: "reasoning",
                content: "Thinking...",
                _provider_metadata: { id: "r-1", isStreaming: false },
              },
            ],
          },
        ];

        // Use passthrough mode to spread extra fields on output content
        const result = PromptlSpecification.fromGenAI({
          messages,
          direction: "output",
          providerMetadata: "passthrough",
        });

        expect((result.messages[0]?.content[0] as { id?: string }).id).toBe("r-1");
        expect((result.messages[0]?.content[0] as { isStreaming?: boolean }).isStreaming).toBe(false);
      });
    });

    describe("redacted-reasoning content", () => {
      it("should restore redacted-reasoning from reasoning part with originalType metadata", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [
              {
                type: "reasoning",
                content: "encrypted-data",
                _provider_metadata: {
                  // originalType is in _known_fields
                  _known_fields: { originalType: "redacted-reasoning" },
                },
              },
            ],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        // Should restore the original redacted-reasoning type
        expect(result.messages[0]?.content[0]).toEqual({
          type: "redacted-reasoning",
          data: "encrypted-data",
        });
      });

      it("should convert regular reasoning to Promptl reasoning content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "reasoning", content: "thinking..." }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.content[0]).toEqual({
          type: "reasoning",
          text: "thinking...",
        });
      });
    });

    describe("tool_call_response and tool role", () => {
      it("should convert tool role with tool_call_response to Promptl tool message", () => {
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [
              {
                type: "tool_call_response",
                id: "call-123",
                response: "Success!",
                _provider_metadata: { _known_fields: { toolName: "my_tool" } },
              },
            ],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("tool");
        expect((result.messages[0] as { toolId: string }).toolId).toBe("call-123");
        expect((result.messages[0] as { toolName: string }).toolName).toBe("my_tool");
        expect(result.messages[0]?.content).toEqual([{ type: "text", text: "Success!" }]);
      });

      it("should convert multiple tool_call_response parts to multiple tool messages", () => {
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [
              {
                type: "tool_call_response",
                id: "call-1",
                response: "Result 1",
                _provider_metadata: { _known_fields: { toolName: "tool_a" } },
              },
              {
                type: "tool_call_response",
                id: "call-2",
                response: "Result 2",
                _provider_metadata: { _known_fields: { toolName: "tool_b" } },
              },
            ],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages).toHaveLength(2);
        expect((result.messages[0] as { toolName: string }).toolName).toBe("tool_a");
        expect((result.messages[1] as { toolName: string }).toolName).toBe("tool_b");
      });

      it("should handle tool_call_response with array response", () => {
        const arrayResponse = [
          { type: "text", content: "Part 1" },
          { type: "text", content: "Part 2" },
        ];
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [
              {
                type: "tool_call_response",
                id: "call-x",
                response: arrayResponse,
                _provider_metadata: { _known_fields: { toolName: "multi_part" } },
              },
            ],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.content).toHaveLength(2);
        expect(result.messages[0]?.content[0]).toEqual({ type: "text", text: "Part 1" });
        expect(result.messages[0]?.content[1]).toEqual({ type: "text", text: "Part 2" });
      });

      it("should handle tool_call_response with object response (serialize to JSON)", () => {
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [
              {
                type: "tool_call_response",
                id: "call-obj",
                response: { status: "ok", count: 5 },
                _provider_metadata: { _known_fields: { toolName: "json_tool" } },
              },
            ],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{ type: string; text: string }>;
        expect(content[0]?.type).toBe("text");
        expect(content[0]?.text).toBe('{"status":"ok","count":5}');
      });

      it("should use 'unknown' as default toolName when not in metadata and no matching tool call", () => {
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [{ type: "tool_call_response", id: "call-no-name", response: "data" }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect((result.messages[0] as { toolName: string }).toolName).toBe("unknown");
      });

      it("should infer toolName from matching tool_call when not in metadata", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "tool_call", id: "call-123", name: "get_weather", arguments: { city: "Paris" } }],
          },
          {
            role: "tool",
            parts: [{ type: "tool_call_response", id: "call-123", response: "Sunny, 22°C" }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages).toHaveLength(2);
        expect((result.messages[1] as { toolName: string }).toolName).toBe("get_weather");
      });

      it("should infer toolName for multiple tool responses from their matching tool calls", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [
              { type: "tool_call", id: "call-1", name: "search", arguments: { q: "test" } },
              { type: "tool_call", id: "call-2", name: "calculator", arguments: { expr: "1+1" } },
            ],
          },
          {
            role: "tool",
            parts: [
              { type: "tool_call_response", id: "call-1", response: "search results" },
              { type: "tool_call_response", id: "call-2", response: "2" },
            ],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        // First message is the assistant with tool calls
        expect(result.messages[0]?.role).toBe("assistant");
        // Second and third are the tool messages (each tool_call_response becomes a separate message)
        expect((result.messages[1] as { toolName: string }).toolName).toBe("search");
        expect((result.messages[2] as { toolName: string }).toolName).toBe("calculator");
      });

      it("should prefer toolName from metadata over inferred name from tool call", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "tool_call", id: "call-abc", name: "original_name", arguments: {} }],
          },
          {
            role: "tool",
            parts: [
              {
                type: "tool_call_response",
                id: "call-abc",
                response: "result",
                _provider_metadata: { _known_fields: { toolName: "metadata_name" } },
              },
            ],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        // Metadata takes precedence
        expect((result.messages[1] as { toolName: string }).toolName).toBe("metadata_name");
      });

      it("should infer toolName when tool_call appears after tool_call_response in messages array", () => {
        // Edge case: messages may not always be in chronological order
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [{ type: "tool_call_response", id: "call-xyz", response: "data" }],
          },
          {
            role: "assistant",
            parts: [{ type: "tool_call", id: "call-xyz", name: "late_tool", arguments: {} }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        // Should still find the tool name because we scan all messages first
        expect((result.messages[0] as { toolName: string }).toolName).toBe("late_tool");
      });
    });

    describe("generic content", () => {
      it("should convert generic part with content to text with type marker", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "custom_type", content: "Custom content" }],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{ type: string; text: string; _genericType?: string }>;
        expect(content[0]?.type).toBe("text");
        expect(content[0]?.text).toBe("Custom content");
        expect(content[0]?._genericType).toBe("custom_type");
      });

      it("should skip generic part without content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [
              { type: "text", content: "Hello" },
              { type: "unknown_type", data: 123 },
            ],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{ type: string }>;
        expect(content).toHaveLength(1);
        expect(content[0]?.type).toBe("text");
      });
    });

    describe("extra fields restoration", () => {
      it("should restore extra message fields from metadata", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "text", content: "Hello" }],
            _provider_metadata: { customField: "restored" },
          },
        ];

        // Use passthrough mode to spread extra fields on output message
        const result = PromptlSpecification.fromGenAI({
          messages,
          direction: "output",
          providerMetadata: "passthrough",
        });

        expect((result.messages[0] as { customField?: string }).customField).toBe("restored");
      });

      it("should restore extra content fields from part metadata", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "text", content: "Hello", _provider_metadata: { extraProp: 42 } }],
          },
        ];

        // Use passthrough mode to spread extra fields on output content
        const result = PromptlSpecification.fromGenAI({
          messages,
          direction: "output",
          providerMetadata: "passthrough",
        });

        expect((result.messages[0]?.content[0] as { extraProp?: number }).extraProp).toBe(42);
      });
    });

    describe("multiple messages", () => {
      it("should convert multiple GenAI messages in order", () => {
        const messages: GenAIMessage[] = [
          { role: "system", parts: [{ type: "text", content: "System" }] },
          { role: "user", parts: [{ type: "text", content: "User" }] },
          { role: "assistant", parts: [{ type: "text", content: "Assistant" }] },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages).toHaveLength(3);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[1]?.role).toBe("user");
        expect(result.messages[2]?.role).toBe("assistant");
      });

      it("should handle message with multiple parts", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [
              { type: "text", content: "Look at this:" },
              { type: "uri", modality: "image", uri: "https://example.com/img.png" },
            ],
          },
        ];

        const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{ type: string }>;
        expect(content).toHaveLength(2);
        expect(content[0]?.type).toBe("text");
        expect(content[1]?.type).toBe("image");
      });
    });
  });

  describe("round-trip conversion", () => {
    it("should preserve user text message through toGenAI -> fromGenAI", () => {
      const original: PromptlMessage[] = [{ role: "user", content: [{ type: "text", text: "Hello, world!" }] }];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve assistant message through round-trip", () => {
      const original: PromptlMessage[] = [{ role: "assistant", content: [{ type: "text", text: "I can help!" }] }];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "output" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve system message through round-trip", () => {
      const original: PromptlMessage[] = [{ role: "system", content: [{ type: "text", text: "Be helpful" }] }];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve developer role through round-trip", () => {
      const original: PromptlMessage[] = [
        { role: "developer", content: [{ type: "text", text: "Developer instructions" }] },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve user name through round-trip", () => {
      const original: PromptlMessage[] = [{ role: "user", name: "Alice", content: [{ type: "text", text: "Hi" }] }];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve image URL through round-trip", () => {
      const original: PromptlMessage[] = [
        { role: "user", content: [{ type: "image", image: "https://example.com/img.png" }] },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve image base64 through round-trip", () => {
      const original: PromptlMessage[] = [{ role: "user", content: [{ type: "image", image: "SGVsbG8gV29ybGQ=" }] }];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve file with mimeType through round-trip", () => {
      const original: PromptlMessage[] = [
        { role: "user", content: [{ type: "file", file: "https://example.com/doc.pdf", mimeType: "application/pdf" }] },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve tool-call with args through round-trip (with backwards compat fields)", () => {
      const original: PromptlMessage[] = [
        {
          role: "assistant",
          content: [{ type: "tool-call", toolCallId: "call-abc", toolName: "weather", args: { city: "NYC" } }],
        },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "output" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      // Should have both args and toolArguments for backwards compat
      expect(restored.messages[0]?.content[0]).toMatchObject({
        type: "tool-call",
        toolCallId: "call-abc",
        toolName: "weather",
        args: { city: "NYC" },
        toolArguments: { city: "NYC" },
      });
    });

    it("should preserve tool-call with toolArguments through round-trip (legacy)", () => {
      const original: PromptlMessage[] = [
        {
          role: "assistant",
          content: [
            { type: "tool-call", toolCallId: "call-def", toolName: "search", toolArguments: { query: "test" } },
          ],
        },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "output" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      // Should have both args and toolArguments for backwards compat
      expect(restored.messages[0]?.content[0]).toMatchObject({
        type: "tool-call",
        toolCallId: "call-def",
        toolName: "search",
        args: { query: "test" },
        toolArguments: { query: "test" },
      });
    });

    it("should preserve tool message through round-trip (legacy format)", () => {
      const original: PromptlMessage[] = [
        {
          role: "tool",
          toolName: "weather",
          toolId: "call-abc",
          content: [{ type: "text", text: "Sunny, 25°C" }],
        },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve reasoning content through round-trip", () => {
      const original: PromptlMessage[] = [
        {
          role: "assistant",
          content: [{ type: "reasoning", text: "Let me think about this..." }],
        },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "output" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve redacted-reasoning content through round-trip", () => {
      const original: PromptlMessage[] = [
        {
          role: "assistant",
          content: [{ type: "redacted-reasoning", data: "encrypted-data-123" }],
        },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "output" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve _promptlSourceMap through round-trip", () => {
      // Use the actual promptl source map structure: { start, end, identifier? }
      const sourceMap = [{ start: 10, end: 25, identifier: "name" }];
      const original: PromptlMessage[] = [
        { role: "user", content: [{ type: "text", text: "Hello", _promptlSourceMap: sourceMap }] },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve _promptlSourceMap on multiple content parts through round-trip", () => {
      const sourceMap1 = [{ start: 0, end: 10 }];
      const sourceMap2 = [{ start: 15, end: 30, identifier: "city" }];
      const original: PromptlMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello ", _promptlSourceMap: sourceMap1 },
            { type: "text", text: "Paris", _promptlSourceMap: sourceMap2 },
          ],
        },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve _promptlSourceMap with multiple refs through round-trip", () => {
      // A content part can have multiple source refs when it comes from multiple template expressions
      const sourceMap = [
        { start: 5, end: 15, identifier: "greeting" },
        { start: 20, end: 35, identifier: "name" },
      ];
      const original: PromptlMessage[] = [
        { role: "user", content: [{ type: "text", text: "Hello John", _promptlSourceMap: sourceMap }] },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve _promptlSourceMap on image content through round-trip", () => {
      const sourceMap = [{ start: 50, end: 80, identifier: "imageUrl" }];
      const original: PromptlMessage[] = [
        {
          role: "user",
          content: [{ type: "image", image: "https://example.com/img.png", _promptlSourceMap: sourceMap }],
        },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve _promptlSourceMap on reasoning content through round-trip", () => {
      const sourceMap = [{ start: 100, end: 150 }];
      const original: PromptlMessage[] = [
        {
          role: "assistant",
          content: [{ type: "reasoning", text: "Let me think...", _promptlSourceMap: sourceMap }],
        },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "output" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve extra message fields through round-trip", () => {
      const original = [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "Hello" }],
          customMeta: { key: "value" },
        },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toEqual(original);
    });

    it("should preserve complex conversation through round-trip", () => {
      const original: PromptlMessage[] = [
        { role: "system", content: [{ type: "text", text: "You are a helpful assistant." }] },
        { role: "user", name: "John", content: [{ type: "text", text: "What's the weather?" }] },
        {
          role: "assistant",
          content: [{ type: "tool-call", toolCallId: "call-1", toolName: "get_weather", args: { city: "Paris" } }],
        },
        {
          role: "tool",
          toolName: "get_weather",
          toolId: "call-1",
          content: [{ type: "text", text: "22°C, Sunny" }],
        },
        { role: "assistant", content: [{ type: "text", text: "The weather in Paris is 22°C and sunny!" }] },
      ];

      const genAI = PromptlSpecification.toGenAI({ messages: original, direction: "input" });
      const restored = PromptlSpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      // Tool-call will get toolArguments added for backwards compat
      expect(restored.messages[0]).toEqual(original[0]);
      expect(restored.messages[1]).toEqual(original[1]);
      expect(restored.messages[2]?.content[0]).toMatchObject({
        type: "tool-call",
        toolCallId: "call-1",
        toolName: "get_weather",
        args: { city: "Paris" },
      });
      expect(restored.messages[3]).toEqual(original[3]);
      expect(restored.messages[4]).toEqual(original[4]);
    });
  });

  describe("schema validation", () => {
    it("should have messageSchema defined", () => {
      expect(PromptlSpecification.messageSchema).toBeDefined();
    });

    it("should validate a valid user message", () => {
      const message: PromptlMessage = {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      };

      const result = PromptlSpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate a valid assistant message", () => {
      const message: PromptlMessage = {
        role: "assistant",
        content: [{ type: "text", text: "Hi!" }],
      };

      const result = PromptlSpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate an assistant message with string content", () => {
      const message = {
        role: "assistant" as const,
        content: "Hello, I'm an assistant!",
        toolCalls: null,
      };

      const result = PromptlSpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate an assistant message with toolCalls", () => {
      const message = {
        role: "assistant" as const,
        content: [],
        toolCalls: [{ id: "call-1", name: "test", arguments: {} }],
      };

      const result = PromptlSpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate a valid tool message (legacy format)", () => {
      const message: PromptlMessage = {
        role: "tool",
        toolName: "test_tool",
        toolId: "call-1",
        content: [{ type: "text", text: "Result" }],
      };

      const result = PromptlSpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate a valid tool message with tool-result content", () => {
      const message = {
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: "call-1",
            toolName: "test",
            result: { data: "value" },
          },
        ],
      };

      const result = PromptlSpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate reasoning content", () => {
      const message = {
        role: "assistant" as const,
        content: [{ type: "reasoning" as const, text: "Thinking..." }],
      };

      const result = PromptlSpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate redacted-reasoning content", () => {
      const message = {
        role: "assistant" as const,
        content: [{ type: "redacted-reasoning" as const, data: "encrypted" }],
      };

      const result = PromptlSpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should reject message without role", () => {
      const invalidMessage = {
        content: [{ type: "text", text: "Hello" }],
      };

      const result = PromptlSpecification.messageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it("should reject message without content", () => {
      const invalidMessage = {
        role: "user",
      };

      const result = PromptlSpecification.messageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it("should reject invalid role", () => {
      const invalidMessage = {
        role: "invalid_role",
        content: [{ type: "text", text: "Hello" }],
      };

      const result = PromptlSpecification.messageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it("should accept message with extra fields (passthrough)", () => {
      const messageWithExtra = {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
        customField: "extra data",
      };

      const result = PromptlSpecification.messageSchema.safeParse(messageWithExtra);
      expect(result.success).toBe(true);
    });

    it("should accept tool-call with args (new format)", () => {
      const message = {
        role: "assistant" as const,
        content: [{ type: "tool-call" as const, toolCallId: "1", toolName: "test", args: { key: "value" } }],
      };

      const result = PromptlSpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should accept tool-call with toolArguments (legacy format)", () => {
      const message = {
        role: "assistant" as const,
        content: [{ type: "tool-call" as const, toolCallId: "1", toolName: "test", toolArguments: { key: "value" } }],
      };

      const result = PromptlSpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should accept tool-call with both args and toolArguments", () => {
      const message = {
        role: "assistant" as const,
        content: [
          {
            type: "tool-call" as const,
            toolCallId: "1",
            toolName: "test",
            args: { new: "format" },
            toolArguments: { old: "format" },
          },
        ],
      };

      const result = PromptlSpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty content array", () => {
      const messages: PromptlMessage[] = [{ role: "user", content: [] }];

      const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

      expect(result.messages[0]?.parts).toEqual([]);
    });

    it("should handle legacy tool message with no content", () => {
      const messages: PromptlMessage[] = [{ role: "tool", toolName: "empty_tool", toolId: "call-empty", content: [] }];

      const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

      // Should still create a tool_call_response part
      expect(result.messages[0]?.parts).toHaveLength(1);
      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
    });

    it("should handle GenAI tool message with no tool_call_response parts", () => {
      const messages: GenAIMessage[] = [
        {
          role: "tool",
          parts: [{ type: "text", content: "Some text" }], // Not a tool_call_response
        },
      ];

      const result = PromptlSpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

      // Should return empty array since there are no tool_call_response parts
      expect(result.messages).toEqual([]);
    });

    it("should handle empty messages array", () => {
      const result = PromptlSpecification.toGenAI({ messages: [], direction: "input" });
      expect(result.messages).toEqual([]);
    });

    it("should handle fromGenAI with empty messages array", () => {
      const result = PromptlSpecification.fromGenAI({ messages: [], direction: "output", providerMetadata: "strip" });
      expect(result.messages).toEqual([]);
    });

    it("should handle tool message with mixed new and legacy content", () => {
      // If there's tool-result content, use new format even if legacy fields exist
      const messages: PromptlMessage[] = [
        {
          role: "tool",
          toolName: "ignored",
          toolId: "ignored",
          content: [
            {
              type: "tool-result",
              toolCallId: "call-new",
              toolName: "used_tool",
              result: "result data",
            },
          ],
        },
      ];

      const result = PromptlSpecification.toGenAI({ messages, direction: "input" });

      expect(result.messages[0]?.parts).toHaveLength(1);
      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
      expect((result.messages[0]?.parts[0] as { id: string }).id).toBe("call-new");
    });
  });
});
