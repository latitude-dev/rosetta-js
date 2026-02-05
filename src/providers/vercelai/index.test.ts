/**
 * VercelAI Provider Tests
 */

import { describe, expect, it } from "vitest";
import type { GenAIMessage } from "$package/core/genai";
import { VercelAISpecification } from "$package/providers/vercelai";
import type { VercelAIMessage } from "$package/providers/vercelai/schema";

describe("VercelAISpecification", () => {
  describe("toGenAI", () => {
    describe("string messages", () => {
      it("should convert a string message to GenAI format with user role for input direction", () => {
        const result = VercelAISpecification.toGenAI({
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
        const result = VercelAISpecification.toGenAI({
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

    describe("system messages", () => {
      it("should convert system message with string content", () => {
        const messages: VercelAIMessage[] = [{ role: "system", content: "You are helpful." }];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "You are helpful.",
        });
      });
    });

    describe("text content", () => {
      it("should convert a user message with text content", () => {
        const messages: VercelAIMessage[] = [{ role: "user", content: [{ type: "text", text: "Hello" }] }];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Hello",
        });
      });

      it("should convert an assistant message with text content", () => {
        const messages: VercelAIMessage[] = [{ role: "assistant", content: [{ type: "text", text: "Hi there!" }] }];

        const result = VercelAISpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("assistant");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Hi there!",
        });
      });

      it("should convert string content in user message", () => {
        const messages: VercelAIMessage[] = [{ role: "user", content: "Hello world" }];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Hello world",
        });
      });

      it("should convert string content in assistant message", () => {
        const messages: VercelAIMessage[] = [{ role: "assistant", content: "I'm here to help" }];

        const result = VercelAISpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "I'm here to help",
        });
      });
    });

    describe("image content", () => {
      it("should convert image with URL string to uri part", () => {
        const messages: VercelAIMessage[] = [
          { role: "user", content: [{ type: "image", image: "https://example.com/image.png" }] },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "uri",
          modality: "image",
          uri: "https://example.com/image.png",
        });
      });

      it("should convert image with base64 string to blob part", () => {
        const messages: VercelAIMessage[] = [{ role: "user", content: [{ type: "image", image: "SGVsbG8gV29ybGQ=" }] }];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "blob",
          modality: "image",
          content: "SGVsbG8gV29ybGQ=",
        });
      });

      it("should convert image with mediaType", () => {
        const messages: VercelAIMessage[] = [
          {
            role: "user",
            content: [{ type: "image", image: "https://example.com/image.png", mediaType: "image/png" }],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "uri",
          modality: "image",
          uri: "https://example.com/image.png",
          mime_type: "image/png",
        });
      });

      it("should convert image with Uint8Array to blob part", () => {
        const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
        const messages: VercelAIMessage[] = [{ role: "user", content: [{ type: "image", image: bytes }] }];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]?.type).toBe("blob");
        expect((result.messages[0]?.parts[0] as { modality: string }).modality).toBe("image");
        expect((result.messages[0]?.parts[0] as { content: string }).content).toBe("SGVsbG8=");
      });

      it("should convert image with URL instance to uri part", () => {
        const messages: VercelAIMessage[] = [
          { role: "user", content: [{ type: "image", image: new URL("https://example.com/img.jpg") }] },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "uri",
          modality: "image",
          uri: "https://example.com/img.jpg",
        });
      });
    });

    describe("file content", () => {
      it("should convert file with URL string to uri part", () => {
        const messages: VercelAIMessage[] = [
          {
            role: "user",
            content: [{ type: "file", data: "https://example.com/doc.pdf", mediaType: "application/pdf" }],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "uri",
          modality: "document",
          mime_type: "application/pdf",
          uri: "https://example.com/doc.pdf",
        });
      });

      it("should convert file with base64 string to blob part", () => {
        const messages: VercelAIMessage[] = [
          { role: "user", content: [{ type: "file", data: "SGVsbG8=", mediaType: "text/plain" }] },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "blob",
          modality: "document",
          mime_type: "text/plain",
          content: "SGVsbG8=",
        });
      });

      it("should infer image modality from mediaType", () => {
        const messages: VercelAIMessage[] = [
          { role: "user", content: [{ type: "file", data: "abc", mediaType: "image/jpeg" }] },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect((result.messages[0]?.parts[0] as { modality: string }).modality).toBe("image");
      });

      it("should infer video modality from mediaType", () => {
        const messages: VercelAIMessage[] = [
          { role: "user", content: [{ type: "file", data: "abc", mediaType: "video/mp4" }] },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect((result.messages[0]?.parts[0] as { modality: string }).modality).toBe("video");
      });

      it("should infer audio modality from mediaType", () => {
        const messages: VercelAIMessage[] = [
          { role: "user", content: [{ type: "file", data: "abc", mediaType: "audio/mpeg" }] },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect((result.messages[0]?.parts[0] as { modality: string }).modality).toBe("audio");
      });
    });

    describe("reasoning content", () => {
      it("should convert reasoning content to reasoning part", () => {
        const messages: VercelAIMessage[] = [
          {
            role: "assistant",
            content: [{ type: "reasoning", text: "Let me think about this..." }],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "reasoning",
          content: "Let me think about this...",
        });
      });
    });

    describe("tool-call content", () => {
      it("should convert tool-call to tool_call part", () => {
        const messages: VercelAIMessage[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "call-123",
                toolName: "get_weather",
                input: { city: "Paris" },
              },
            ],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call",
          id: "call-123",
          name: "get_weather",
          arguments: { city: "Paris" },
        });
      });

      it("should preserve providerExecuted in metadata", () => {
        // Use type assertion because providerExecuted is a passthrough field not in the base type
        const messages = [
          {
            role: "assistant" as const,
            content: [
              {
                type: "tool-call" as const,
                toolCallId: "call-456",
                toolName: "test",
                input: {},
                providerExecuted: true,
              },
            ],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "output" });

        // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
        expect(result.messages[0]?.parts[0]?._provider_metadata?.["providerExecuted"]).toBe(true);
      });
    });

    describe("tool-result content", () => {
      it("should convert tool-result to tool_call_response part", () => {
        const messages: VercelAIMessage[] = [
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "call-123",
                toolName: "get_weather",
                output: { type: "json", value: { temp: 22 } },
              },
            ],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.role).toBe("tool");
        expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
        expect((result.messages[0]?.parts[0] as { id: string }).id).toBe("call-123");
        // toolName is stored in _known_fields for cross-provider access
        expect(
          // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
          (result.messages[0]?.parts[0]?._provider_metadata?._known_fields as Record<string, unknown>)?.["toolName"],
        ).toBe("get_weather");
      });
    });

    describe("tool-result legacy format (result + isError)", () => {
      it("should convert legacy format with result field to tool_call_response", () => {
        const messages = [
          {
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId: "call-legacy-1",
                toolName: "get_data",
                result: { data: "value" },
              },
            ],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.role).toBe("tool");
        expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
        expect((result.messages[0]?.parts[0] as { id: string }).id).toBe("call-legacy-1");
        expect((result.messages[0]?.parts[0] as { response: unknown }).response).toEqual({ data: "value" });
      });

      it("should convert legacy format with result and isError=true", () => {
        const messages = [
          {
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId: "call-legacy-2",
                toolName: "failing_tool",
                result: "Something went wrong",
                isError: true,
              },
            ],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
        expect((result.messages[0]?.parts[0] as { response: unknown }).response).toBe("Something went wrong");
        // isError should be stored in _known_fields
        expect(
          // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
          (result.messages[0]?.parts[0]?._provider_metadata?._known_fields as Record<string, unknown>)?.["isError"],
        ).toBe(true);
      });

      it("should convert legacy format with string result", () => {
        const messages = [
          {
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId: "call-legacy-3",
                toolName: "string_tool",
                result: "Success message",
              },
            ],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect((result.messages[0]?.parts[0] as { response: unknown }).response).toBe("Success message");
        // outputType should be inferred as "text" for string result
        // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
        expect(result.messages[0]?.parts[0]?._provider_metadata?.["outputType"]).toBe("text");
      });

      it("should convert legacy format with JSON result and isError=true to error-json type", () => {
        const messages = [
          {
            role: "tool" as const,
            content: [
              {
                type: "tool-result" as const,
                toolCallId: "call-legacy-4",
                toolName: "json_error_tool",
                result: { error: "details" },
                isError: true,
              },
            ],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect((result.messages[0]?.parts[0] as { response: unknown }).response).toEqual({ error: "details" });
        // outputType should be inferred as "error-json" for JSON error result
        // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
        expect(result.messages[0]?.parts[0]?._provider_metadata?.["outputType"]).toBe("error-json");
      });
    });

    describe("tool-approval-request content", () => {
      it("should convert tool-approval-request to generic part", () => {
        const messages: VercelAIMessage[] = [
          {
            role: "assistant",
            content: [
              {
                type: "tool-approval-request",
                approvalId: "approval-1",
                toolCallId: "call-123",
              },
            ],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "output" });

        expect(result.messages[0]?.parts[0]?.type).toBe("tool-approval-request");
        expect((result.messages[0]?.parts[0] as unknown as { approvalId: string }).approvalId).toBe("approval-1");
        expect((result.messages[0]?.parts[0] as unknown as { toolCallId: string }).toolCallId).toBe("call-123");
      });
    });

    describe("tool-approval-response content", () => {
      it("should convert tool-approval-response to generic part", () => {
        const messages: VercelAIMessage[] = [
          {
            role: "tool",
            content: [
              {
                type: "tool-approval-response",
                approvalId: "approval-1",
                approved: true,
                reason: "User confirmed",
              },
            ],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts[0]?.type).toBe("tool-approval-response");
        expect((result.messages[0]?.parts[0] as unknown as { approved: boolean }).approved).toBe(true);
        expect((result.messages[0]?.parts[0] as unknown as { reason: string }).reason).toBe("User confirmed");
      });
    });

    describe("extra fields preservation", () => {
      it("should preserve extra message fields in metadata", () => {
        const messages = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: "Hello" }],
            providerOptions: { custom: "value" },
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
        expect(result.messages[0]?._provider_metadata?.["providerOptions"]).toEqual({ custom: "value" });
      });

      it("should preserve extra part fields in part metadata", () => {
        const messages = [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: "Hello", providerOptions: { partMeta: 123 } }],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
        expect(result.messages[0]?.parts[0]?._provider_metadata?.["providerOptions"]).toEqual({
          partMeta: 123,
        });
      });
    });

    describe("multiple messages", () => {
      it("should convert multiple messages in order", () => {
        const messages: VercelAIMessage[] = [
          { role: "system", content: "Be helpful" },
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi!" },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages).toHaveLength(3);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[1]?.role).toBe("user");
        expect(result.messages[2]?.role).toBe("assistant");
      });

      it("should convert message with multiple content parts", () => {
        const messages: VercelAIMessage[] = [
          {
            role: "user",
            content: [
              { type: "text", text: "Check this image:" },
              { type: "image", image: "https://example.com/img.png" },
            ],
          },
        ];

        const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

        expect(result.messages[0]?.parts).toHaveLength(2);
        expect(result.messages[0]?.parts[0]?.type).toBe("text");
        expect(result.messages[0]?.parts[1]?.type).toBe("uri");
      });
    });
  });

  describe("fromGenAI", () => {
    describe("text content", () => {
      it("should convert GenAI text part to VercelAI text content", () => {
        const messages: GenAIMessage[] = [{ role: "user", parts: [{ type: "text", content: "Hello" }] }];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
        // Single text part becomes string content
        expect(result.messages[0]?.content).toBe("Hello");
      });

      it("should use array content for multiple text parts", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [
              { type: "text", content: "Hello" },
              { type: "text", content: "World" },
            ],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(Array.isArray(result.messages[0]?.content)).toBe(true);
        const content = result.messages[0]?.content as Array<{ type: string; text: string }>;
        expect(content).toHaveLength(2);
        expect(content[0]?.text).toBe("Hello");
        expect(content[1]?.text).toBe("World");
      });
    });

    describe("system messages", () => {
      it("should convert system role to VercelAI system message", () => {
        const messages: GenAIMessage[] = [{ role: "system", parts: [{ type: "text", content: "Be helpful" }] }];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[0]?.content).toBe("Be helpful");
      });

      it("should join multiple system text parts with newlines", () => {
        const messages: GenAIMessage[] = [
          {
            role: "system",
            parts: [
              { type: "text", content: "Be helpful" },
              { type: "text", content: "Be concise" },
            ],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages[0]?.content).toBe("Be helpful\nBe concise");
      });
    });

    describe("blob content", () => {
      it("should convert image blob to VercelAI image content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "blob", modality: "image", content: "SGVsbG8=" }],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{ type: string; image: string }>;
        expect(content[0]?.type).toBe("image");
        expect(content[0]?.image).toBe("SGVsbG8=");
      });

      it("should convert non-image blob to VercelAI file content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "blob", modality: "audio", mime_type: "audio/mpeg", content: "abc123" }],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{ type: string; data: string; mediaType: string }>;
        expect(content[0]?.type).toBe("file");
        expect(content[0]?.data).toBe("abc123");
        expect(content[0]?.mediaType).toBe("audio/mpeg");
      });
    });

    describe("uri content", () => {
      it("should convert image uri to VercelAI image content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "uri", modality: "image", uri: "https://example.com/img.png" }],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{ type: string; image: string }>;
        expect(content[0]?.type).toBe("image");
        expect(content[0]?.image).toBe("https://example.com/img.png");
      });

      it("should convert non-image uri to VercelAI file content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [
              { type: "uri", modality: "document", mime_type: "application/pdf", uri: "https://example.com/doc.pdf" },
            ],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{ type: string; data: string; mediaType: string }>;
        expect(content[0]?.type).toBe("file");
        expect(content[0]?.data).toBe("https://example.com/doc.pdf");
        expect(content[0]?.mediaType).toBe("application/pdf");
      });
    });

    describe("reasoning content", () => {
      it("should convert reasoning part to VercelAI reasoning content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "reasoning", content: "Let me think..." }],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{ type: string; text: string }>;
        expect(content[0]?.type).toBe("reasoning");
        expect(content[0]?.text).toBe("Let me think...");
      });

      it("should convert reasoning part (originally redacted-reasoning) to VercelAI reasoning", () => {
        // Redacted-reasoning from source providers is now converted to reasoning with metadata
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [
              {
                type: "reasoning",
                content: "hidden-data",
                _provider_metadata: { _known_fields: { originalType: "redacted-reasoning" } },
              },
            ],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        // VercelAI doesn't have redacted-reasoning, so it becomes regular reasoning
        const content = result.messages[0]?.content as Array<{ type: string; text: string }>;
        expect(content[0]?.type).toBe("reasoning");
        expect(content[0]?.text).toBe("hidden-data");
      });
    });

    describe("tool_call content", () => {
      it("should convert tool_call to VercelAI tool-call content", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "tool_call", id: "call-789", name: "search", arguments: { query: "test" } }],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{
          type: string;
          toolCallId: string;
          toolName: string;
          input: unknown;
        }>;
        expect(content[0]?.type).toBe("tool-call");
        expect(content[0]?.toolCallId).toBe("call-789");
        expect(content[0]?.toolName).toBe("search");
        expect(content[0]?.input).toEqual({ query: "test" });
      });

      it("should handle tool_call with null id", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "tool_call", id: null, name: "test_tool", arguments: {} }],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{ toolCallId: string }>;
        expect(content[0]?.toolCallId).toBe("");
      });
    });

    describe("tool_call_response and tool role", () => {
      it("should convert tool role with tool_call_response to VercelAI tool message", () => {
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

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("tool");
        const content = result.messages[0]?.content as Array<{
          type: string;
          toolCallId: string;
          toolName: string;
          output: unknown;
        }>;
        expect(content[0]?.type).toBe("tool-result");
        expect(content[0]?.toolCallId).toBe("call-123");
        expect(content[0]?.toolName).toBe("my_tool");
        // Output is now wrapped in typed ToolResultOutput structure
        expect(content[0]?.output).toEqual({ type: "text", value: "Success!" });
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

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages).toHaveLength(2);
        const toolContent = result.messages[1]?.content as Array<{ toolName: string }>;
        expect(toolContent[0]?.toolName).toBe("get_weather");
      });

      it("should use 'unknown' as default toolName when not found", () => {
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [{ type: "tool_call_response", id: "call-no-name", response: "data" }],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const toolContent = result.messages[0]?.content as Array<{ toolName: string }>;
        expect(toolContent[0]?.toolName).toBe("unknown");
      });

      it("should extract toolName from root-level metadata (cross-provider)", () => {
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [
              {
                type: "tool_call_response",
                id: "call-123",
                response: "Result",
                // toolName is stored in _known_fields for cross-provider access
                _provider_metadata: { _known_fields: { toolName: "cross_provider_tool" } },
              },
            ],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const toolContent = result.messages[0]?.content as Array<{ toolName: string }>;
        expect(toolContent[0]?.toolName).toBe("cross_provider_tool");
      });
    });

    describe("fromGenAI always uses modern output format", () => {
      it("should always output 'output' field, never 'result' + 'isError'", () => {
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [
              {
                type: "tool_call_response",
                id: "call-123",
                response: "Some result",
                _provider_metadata: { _known_fields: { toolName: "my_tool" } },
              },
            ],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{
          type: string;
          output?: unknown;
          result?: unknown;
          isError?: boolean;
        }>;
        // Should have 'output' field
        expect(content[0]?.output).toBeDefined();
        expect(content[0]?.output).toEqual({ type: "text", value: "Some result" });
        // Should NOT have 'result' or 'isError' fields
        expect(content[0]?.result).toBeUndefined();
        expect(content[0]?.isError).toBeUndefined();
      });

      it("should output error type in 'output' field for error responses", () => {
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [
              {
                type: "tool_call_response",
                id: "call-456",
                response: "Error occurred",
                _provider_metadata: { _known_fields: { toolName: "error_tool", isError: true } },
              },
            ],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{
          type: string;
          output?: { type: string; value?: unknown };
          result?: unknown;
          isError?: boolean;
        }>;
        // Should use error-text type in output
        expect(content[0]?.output).toEqual({ type: "error-text", value: "Error occurred" });
        // Should NOT have legacy fields
        expect(content[0]?.result).toBeUndefined();
        expect(content[0]?.isError).toBeUndefined();
      });

      it("should output json type in 'output' field for object responses", () => {
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [
              {
                type: "tool_call_response",
                id: "call-789",
                response: { weather: "sunny", temp: 22 },
                _provider_metadata: { _known_fields: { toolName: "weather_tool" } },
              },
            ],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{
          output?: { type: string; value?: unknown };
        }>;
        expect(content[0]?.output).toEqual({ type: "json", value: { weather: "sunny", temp: 22 } });
      });
    });

    describe("tool-approval parts", () => {
      it("should convert tool-approval-request back to VercelAI format", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [
              {
                type: "tool-approval-request",
                content: "",
                approvalId: "approval-1",
                toolCallId: "call-123",
              },
            ],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{
          type: string;
          approvalId: string;
          toolCallId: string;
        }>;
        expect(content[0]?.type).toBe("tool-approval-request");
        expect(content[0]?.approvalId).toBe("approval-1");
        expect(content[0]?.toolCallId).toBe("call-123");
      });

      it("should convert tool-approval-response back to VercelAI format", () => {
        const messages: GenAIMessage[] = [
          {
            role: "tool",
            parts: [
              {
                type: "tool-approval-response",
                content: "",
                approvalId: "approval-1",
                approved: false,
                reason: "Denied by user",
              },
            ],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{
          type: string;
          approvalId: string;
          approved: boolean;
          reason: string;
        }>;
        expect(content[0]?.type).toBe("tool-approval-response");
        expect(content[0]?.approved).toBe(false);
        expect(content[0]?.reason).toBe("Denied by user");
      });
    });

    describe("generic content", () => {
      it("should convert generic part with content to text", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [{ type: "custom_type", content: "Custom content" }],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        // Single text part becomes string content
        expect(result.messages[0]?.content).toBe("Custom content");
      });

      it("should convert generic part with content to text in array when mixed with other parts", () => {
        const messages: GenAIMessage[] = [
          {
            role: "assistant",
            parts: [
              { type: "text", content: "Hello" },
              { type: "custom_type", content: "Custom content" },
            ],
          },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        const content = result.messages[0]?.content as Array<{ type: string; text: string }>;
        expect(content[0]?.type).toBe("text");
        expect(content[0]?.text).toBe("Hello");
        expect(content[1]?.type).toBe("text");
        expect(content[1]?.text).toBe("Custom content");
      });
    });

    describe("extra fields restoration", () => {
      it("should restore extra message fields from metadata", () => {
        const messages: GenAIMessage[] = [
          {
            role: "user",
            parts: [{ type: "text", content: "Hello" }],
            _provider_metadata: { providerOptions: { custom: "value" } },
          },
        ];

        // Use passthrough mode to spread extra fields on output message
        const result = VercelAISpecification.fromGenAI({
          messages,
          direction: "output",
          providerMetadata: "passthrough",
        });

        expect((result.messages[0] as { providerOptions?: unknown }).providerOptions).toEqual({ custom: "value" });
      });
    });

    describe("multiple messages", () => {
      it("should convert multiple GenAI messages in order", () => {
        const messages: GenAIMessage[] = [
          { role: "system", parts: [{ type: "text", content: "System" }] },
          { role: "user", parts: [{ type: "text", content: "User" }] },
          { role: "assistant", parts: [{ type: "text", content: "Assistant" }] },
        ];

        const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

        expect(result.messages).toHaveLength(3);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[1]?.role).toBe("user");
        expect(result.messages[2]?.role).toBe("assistant");
      });
    });

    describe("part-level metadata handling", () => {
      const sourceMap = [{ start: 0, end: 10, identifier: "test" }];

      describe("passthrough mode", () => {
        it("should preserve part-level metadata on user message text parts", () => {
          const messages: GenAIMessage[] = [
            {
              role: "user",
              parts: [{ type: "text", content: "Hello", _provider_metadata: { _promptlSourceMap: sourceMap } }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "passthrough",
          });

          // Content should be array to preserve part metadata
          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
          const content = result.messages[0]?.content as Array<{
            type: string;
            text: string;
            _promptlSourceMap?: unknown;
          }>;
          expect(content[0]?.type).toBe("text");
          expect(content[0]?.text).toBe("Hello");
          expect(content[0]?._promptlSourceMap).toEqual(sourceMap);
        });

        it("should preserve part-level metadata on assistant message text parts", () => {
          const messages: GenAIMessage[] = [
            {
              role: "assistant",
              parts: [{ type: "text", content: "Response", _provider_metadata: { _promptlSourceMap: sourceMap } }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "passthrough",
          });

          // Content should be array to preserve part metadata
          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
          const content = result.messages[0]?.content as Array<{
            type: string;
            text: string;
            _promptlSourceMap?: unknown;
          }>;
          expect(content[0]?.type).toBe("text");
          expect(content[0]?.text).toBe("Response");
          expect(content[0]?._promptlSourceMap).toEqual(sourceMap);
        });

        it("should lose part-level metadata on system message in passthrough mode", () => {
          const messages: GenAIMessage[] = [
            {
              role: "system",
              parts: [{ type: "text", content: "Be helpful", _provider_metadata: { _promptlSourceMap: sourceMap } }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "passthrough",
          });

          // System message uses string content, part metadata is lost in passthrough mode
          // because _partsMetadata is stripped (not spread) and there's no content part to apply it to
          expect(result.messages[0]?.content).toBe("Be helpful");
          expect((result.messages[0] as { _promptlSourceMap?: unknown })._promptlSourceMap).toBeUndefined();
          expect((result.messages[0] as { _partsMetadata?: unknown })._partsMetadata).toBeUndefined();
        });

        it("should preserve multiple parts with metadata as array content", () => {
          const sourceMap2 = [{ start: 11, end: 20, identifier: "test2" }];
          const messages: GenAIMessage[] = [
            {
              role: "user",
              parts: [
                { type: "text", content: "Hello", _provider_metadata: { _promptlSourceMap: sourceMap } },
                { type: "text", content: "World", _provider_metadata: { _promptlSourceMap: sourceMap2 } },
              ],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "passthrough",
          });

          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
          const content = result.messages[0]?.content as Array<{
            type: string;
            text: string;
            _promptlSourceMap?: unknown;
          }>;
          expect(content).toHaveLength(2);
          expect(content[0]?._promptlSourceMap).toEqual(sourceMap);
          expect(content[1]?._promptlSourceMap).toEqual(sourceMap2);
        });
      });

      describe("preserve mode", () => {
        it("should preserve part-level metadata on user message text parts", () => {
          const messages: GenAIMessage[] = [
            {
              role: "user",
              parts: [{ type: "text", content: "Hello", _provider_metadata: { _promptlSourceMap: sourceMap } }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "preserve",
          });

          // Content should be array to preserve part metadata
          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
          const content = result.messages[0]?.content as Array<{
            type: string;
            text: string;
            _providerMetadata?: { _promptlSourceMap?: unknown };
          }>;
          expect(content[0]?.type).toBe("text");
          expect(content[0]?.text).toBe("Hello");
          expect(content[0]?._providerMetadata?._promptlSourceMap).toEqual(sourceMap);
        });

        it("should preserve part-level metadata on assistant message text parts", () => {
          const messages: GenAIMessage[] = [
            {
              role: "assistant",
              parts: [{ type: "text", content: "Response", _provider_metadata: { _promptlSourceMap: sourceMap } }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "preserve",
          });

          // Content should be array to preserve part metadata
          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
          const content = result.messages[0]?.content as Array<{
            type: string;
            text: string;
            _providerMetadata?: { _promptlSourceMap?: unknown };
          }>;
          expect(content[0]?.type).toBe("text");
          expect(content[0]?.text).toBe("Response");
          expect(content[0]?._providerMetadata?._promptlSourceMap).toEqual(sourceMap);
        });

        it("should merge part-level metadata into system message _providerMetadata._partsMetadata", () => {
          const messages: GenAIMessage[] = [
            {
              role: "system",
              parts: [{ type: "text", content: "Be helpful", _provider_metadata: { _promptlSourceMap: sourceMap } }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "preserve",
          });

          // System message uses string content, so part metadata is stored in _partsMetadata
          expect(result.messages[0]?.content).toBe("Be helpful");
          expect(
            (result.messages[0] as { _providerMetadata?: { _partsMetadata?: { _promptlSourceMap?: unknown } } })
              ._providerMetadata?._partsMetadata?._promptlSourceMap,
          ).toEqual(sourceMap);
        });

        it("should preserve multiple parts with metadata as array content", () => {
          const sourceMap2 = [{ start: 11, end: 20, identifier: "test2" }];
          const messages: GenAIMessage[] = [
            {
              role: "user",
              parts: [
                { type: "text", content: "Hello", _provider_metadata: { _promptlSourceMap: sourceMap } },
                { type: "text", content: "World", _provider_metadata: { _promptlSourceMap: sourceMap2 } },
              ],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "preserve",
          });

          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
          const content = result.messages[0]?.content as Array<{
            type: string;
            text: string;
            _providerMetadata?: { _promptlSourceMap?: unknown };
          }>;
          expect(content).toHaveLength(2);
          expect(content[0]?._providerMetadata?._promptlSourceMap).toEqual(sourceMap);
          expect(content[1]?._providerMetadata?._promptlSourceMap).toEqual(sourceMap2);
        });
      });

      describe("strip mode", () => {
        it("should collapse single text part to string when no metadata to preserve", () => {
          const messages: GenAIMessage[] = [
            {
              role: "user",
              parts: [{ type: "text", content: "Hello" }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "strip",
          });

          // Should collapse to string for optimization
          expect(result.messages[0]?.content).toBe("Hello");
        });

        it("should collapse single text part to string even when part has metadata in strip mode", () => {
          const messages: GenAIMessage[] = [
            {
              role: "user",
              parts: [{ type: "text", content: "Hello", _provider_metadata: { _promptlSourceMap: sourceMap } }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "strip",
          });

          // Strip mode should still collapse to string
          expect(result.messages[0]?.content).toBe("Hello");
        });
      });

      describe("_partsMetadata handling for system messages", () => {
        it("should lose system part metadata in passthrough mode (no parts to restore to)", () => {
          const messages: GenAIMessage[] = [
            {
              role: "system",
              parts: [{ type: "text", content: "Be helpful", _provider_metadata: { _promptlSourceMap: sourceMap } }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "passthrough",
          });

          // In passthrough mode, _partsMetadata is stripped (like _known_fields)
          // Since system messages use string content, there's no content part to restore metadata to
          expect(result.messages[0]?.content).toBe("Be helpful");
          expect((result.messages[0] as { _promptlSourceMap?: unknown })._promptlSourceMap).toBeUndefined();
          expect((result.messages[0] as { _partsMetadata?: unknown })._partsMetadata).toBeUndefined();
        });

        it("should store system part metadata in _partsMetadata inside _providerMetadata when mode is preserve", () => {
          const messages: GenAIMessage[] = [
            {
              role: "system",
              parts: [{ type: "text", content: "Be helpful", _provider_metadata: { _promptlSourceMap: sourceMap } }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "preserve",
          });

          // In preserve mode, _partsMetadata is stored inside _providerMetadata
          expect(result.messages[0]?.content).toBe("Be helpful");
          const msg = result.messages[0] as {
            _providerMetadata?: {
              _partsMetadata?: { _promptlSourceMap?: unknown };
            };
          };
          expect(msg._providerMetadata?._partsMetadata?._promptlSourceMap).toEqual(sourceMap);
        });

        it("should not include _partsMetadata when system message has no part metadata in passthrough mode", () => {
          const messages: GenAIMessage[] = [
            {
              role: "system",
              parts: [{ type: "text", content: "Be helpful" }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "passthrough",
          });

          expect(result.messages[0]?.content).toBe("Be helpful");
          expect((result.messages[0] as { _partsMetadata?: unknown })._partsMetadata).toBeUndefined();
        });

        it("should strip _partsMetadata in strip mode", () => {
          const messages: GenAIMessage[] = [
            {
              role: "system",
              parts: [{ type: "text", content: "Be helpful", _provider_metadata: { _promptlSourceMap: sourceMap } }],
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "strip",
          });

          expect(result.messages[0]?.content).toBe("Be helpful");
          expect((result.messages[0] as { _partsMetadata?: unknown })._partsMetadata).toBeUndefined();
          expect((result.messages[0] as { _providerMetadata?: unknown })._providerMetadata).toBeUndefined();
        });
      });

      describe("_partsMetadata restoration for user messages", () => {
        it("should apply _partsMetadata to the first user content part in passthrough mode", () => {
          const sourceMap = [{ start: 0, end: 10, identifier: "test" }];
          const messages: GenAIMessage[] = [
            {
              role: "user",
              parts: [{ type: "text", content: "Hello" }],
              _provider_metadata: { _parts_metadata: { _promptlSourceMap: sourceMap } },
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "input",
            providerMetadata: "passthrough",
          });

          // User message should have array content with metadata on the first part
          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
          const content = result.messages[0]?.content as Array<{ type: string; _promptlSourceMap?: unknown }>;
          expect(content[0]?._promptlSourceMap).toEqual(sourceMap);
        });

        it("should apply _partsMetadata to the first user content part in preserve mode", () => {
          const sourceMap = [{ start: 0, end: 10, identifier: "test" }];
          const messages: GenAIMessage[] = [
            {
              role: "user",
              parts: [{ type: "text", content: "Hello" }],
              _provider_metadata: { _partsMetadata: { _promptlSourceMap: sourceMap } },
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "input",
            providerMetadata: "preserve",
          });

          // User message should have array content with metadata nested in _providerMetadata
          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
          const content = result.messages[0]?.content as Array<{
            type: string;
            _providerMetadata?: { _promptlSourceMap?: unknown };
          }>;
          expect(content[0]?._providerMetadata?._promptlSourceMap).toEqual(sourceMap);
        });

        it("should not collapse to string when _partsMetadata exists", () => {
          const sourceMap = [{ start: 0, end: 10, identifier: "test" }];
          const messages: GenAIMessage[] = [
            {
              role: "user",
              parts: [{ type: "text", content: "Hello" }],
              _provider_metadata: { _partsMetadata: { _promptlSourceMap: sourceMap } },
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "input",
            providerMetadata: "passthrough",
          });

          // Should use array content, not string, to preserve metadata
          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
        });
      });

      describe("_partsMetadata restoration for assistant messages", () => {
        it("should apply _partsMetadata to the first assistant content part in passthrough mode", () => {
          const sourceMap = [{ start: 0, end: 10, identifier: "test" }];
          const messages: GenAIMessage[] = [
            {
              role: "assistant",
              parts: [{ type: "text", content: "Hello" }],
              _provider_metadata: { _parts_metadata: { _promptlSourceMap: sourceMap } },
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "passthrough",
          });

          // Assistant message should have array content with metadata on the first part
          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
          const content = result.messages[0]?.content as Array<{ type: string; _promptlSourceMap?: unknown }>;
          expect(content[0]?._promptlSourceMap).toEqual(sourceMap);
        });

        it("should apply _partsMetadata to the first assistant content part in preserve mode", () => {
          const sourceMap = [{ start: 0, end: 10, identifier: "test" }];
          const messages: GenAIMessage[] = [
            {
              role: "assistant",
              parts: [{ type: "text", content: "Hello" }],
              _provider_metadata: { _partsMetadata: { _promptlSourceMap: sourceMap } },
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "preserve",
          });

          // Assistant message should have array content with metadata nested in _providerMetadata
          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
          const content = result.messages[0]?.content as Array<{
            type: string;
            _providerMetadata?: { _promptlSourceMap?: unknown };
          }>;
          expect(content[0]?._providerMetadata?._promptlSourceMap).toEqual(sourceMap);
        });

        it("should not collapse to string when _partsMetadata exists", () => {
          const sourceMap = [{ start: 0, end: 10, identifier: "test" }];
          const messages: GenAIMessage[] = [
            {
              role: "assistant",
              parts: [{ type: "text", content: "Hello" }],
              _provider_metadata: { _partsMetadata: { _promptlSourceMap: sourceMap } },
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "passthrough",
          });

          // Should use array content, not string, to preserve metadata
          expect(Array.isArray(result.messages[0]?.content)).toBe(true);
        });
      });

      describe("_partsMetadata restoration for tool messages", () => {
        it("should apply _partsMetadata to the first tool content part in passthrough mode", () => {
          const sourceMap = [{ start: 0, end: 10, identifier: "test" }];
          const messages: GenAIMessage[] = [
            {
              role: "tool",
              parts: [{ type: "tool_call_response", id: "call_1", response: "Result" }],
              _provider_metadata: { _parts_metadata: { _promptlSourceMap: sourceMap } },
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "passthrough",
          });

          // Tool message should have array content with metadata on the first part
          const content = result.messages[0]?.content as Array<{ type: string; _promptlSourceMap?: unknown }>;
          expect(content[0]?._promptlSourceMap).toEqual(sourceMap);
        });

        it("should apply _partsMetadata to the first tool content part in preserve mode", () => {
          const sourceMap = [{ start: 0, end: 10, identifier: "test" }];
          const messages: GenAIMessage[] = [
            {
              role: "tool",
              parts: [{ type: "tool_call_response", id: "call_1", response: "Result" }],
              _provider_metadata: { _partsMetadata: { _promptlSourceMap: sourceMap } },
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "preserve",
          });

          // Tool message should have array content with metadata nested in _providerMetadata
          const content = result.messages[0]?.content as Array<{
            type: string;
            _providerMetadata?: { _promptlSourceMap?: unknown };
          }>;
          expect(content[0]?._providerMetadata?._promptlSourceMap).toEqual(sourceMap);
        });

        it("should not include _partsMetadata when mode is strip", () => {
          const sourceMap = [{ start: 0, end: 10, identifier: "test" }];
          const messages: GenAIMessage[] = [
            {
              role: "tool",
              parts: [{ type: "tool_call_response", id: "call_1", response: "Result" }],
              _provider_metadata: { _partsMetadata: { _promptlSourceMap: sourceMap } },
            },
          ];

          const result = VercelAISpecification.fromGenAI({
            messages,
            direction: "output",
            providerMetadata: "strip",
          });

          const content = result.messages[0]?.content as Array<{
            type: string;
            _promptlSourceMap?: unknown;
            _providerMetadata?: unknown;
          }>;
          expect(content[0]?._promptlSourceMap).toBeUndefined();
          expect(content[0]?._providerMetadata).toBeUndefined();
        });
      });
    });
  });

  describe("round-trip conversion", () => {
    it("should preserve user text message through toGenAI -> fromGenAI", () => {
      const original: VercelAIMessage[] = [{ role: "user", content: "Hello, world!" }];

      const genAI = VercelAISpecification.toGenAI({ messages: original, direction: "input" });
      const restored = VercelAISpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages[0]?.content).toBe("Hello, world!");
    });

    it("should preserve assistant text message through round-trip", () => {
      const original: VercelAIMessage[] = [{ role: "assistant", content: "I can help!" }];

      const genAI = VercelAISpecification.toGenAI({ messages: original, direction: "output" });
      const restored = VercelAISpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages[0]?.content).toBe("I can help!");
    });

    it("should preserve system message through round-trip", () => {
      const original: VercelAIMessage[] = [{ role: "system", content: "Be helpful" }];

      const genAI = VercelAISpecification.toGenAI({ messages: original, direction: "input" });
      const restored = VercelAISpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages[0]?.content).toBe("Be helpful");
    });

    it("should preserve image URL through round-trip", () => {
      const original: VercelAIMessage[] = [
        { role: "user", content: [{ type: "image", image: "https://example.com/img.png" }] },
      ];

      const genAI = VercelAISpecification.toGenAI({ messages: original, direction: "input" });
      const restored = VercelAISpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      const content = restored.messages[0]?.content as Array<{ type: string; image: string }>;
      expect(content[0]?.type).toBe("image");
      expect(content[0]?.image).toBe("https://example.com/img.png");
    });

    it("should preserve tool-call through round-trip", () => {
      const original: VercelAIMessage[] = [
        {
          role: "assistant",
          content: [{ type: "tool-call", toolCallId: "call-abc", toolName: "weather", input: { city: "NYC" } }],
        },
      ];

      const genAI = VercelAISpecification.toGenAI({ messages: original, direction: "output" });
      const restored = VercelAISpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      const content = restored.messages[0]?.content as Array<{
        type: string;
        toolCallId: string;
        toolName: string;
        input: unknown;
      }>;
      expect(content[0]?.type).toBe("tool-call");
      expect(content[0]?.toolCallId).toBe("call-abc");
      expect(content[0]?.toolName).toBe("weather");
      expect(content[0]?.input).toEqual({ city: "NYC" });
    });

    it("should preserve reasoning through round-trip", () => {
      const original: VercelAIMessage[] = [
        {
          role: "assistant",
          content: [{ type: "reasoning", text: "Let me think about this..." }],
        },
      ];

      const genAI = VercelAISpecification.toGenAI({ messages: original, direction: "output" });
      const restored = VercelAISpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      const content = restored.messages[0]?.content as Array<{ type: string; text: string }>;
      expect(content[0]?.type).toBe("reasoning");
      expect(content[0]?.text).toBe("Let me think about this...");
    });

    it("should convert legacy tool-result format to modern output format on round-trip", () => {
      // Input uses legacy format (result + isError)
      const original = [
        {
          role: "tool" as const,
          content: [
            {
              type: "tool-result" as const,
              toolCallId: "call-legacy",
              toolName: "legacy_tool",
              result: { legacy: "data" },
              isError: false,
            },
          ],
        },
      ];

      const genAI = VercelAISpecification.toGenAI({ messages: original, direction: "input" });
      const restored = VercelAISpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      // Output should use modern format (output field)
      const content = restored.messages[0]?.content as Array<{
        type: string;
        toolCallId: string;
        toolName: string;
        output: { type: string; value: unknown };
        result?: unknown;
        isError?: boolean;
      }>;
      expect(content[0]?.output).toEqual({ type: "json", value: { legacy: "data" } });
      // Legacy fields should NOT be present
      expect(content[0]?.result).toBeUndefined();
      expect(content[0]?.isError).toBeUndefined();
    });

    it("should preserve error status when converting legacy format through round-trip", () => {
      // Input uses legacy format with isError=true
      const original = [
        {
          role: "tool" as const,
          content: [
            {
              type: "tool-result" as const,
              toolCallId: "call-error",
              toolName: "error_tool",
              result: "Error message",
              isError: true,
            },
          ],
        },
      ];

      const genAI = VercelAISpecification.toGenAI({ messages: original, direction: "input" });
      const restored = VercelAISpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      // Output should use modern format with error type
      const content = restored.messages[0]?.content as Array<{
        output: { type: string; value: unknown };
      }>;
      expect(content[0]?.output).toEqual({ type: "error-text", value: "Error message" });
    });

    it("should preserve complex conversation through round-trip", () => {
      const original: VercelAIMessage[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What's the weather?" },
        {
          role: "assistant",
          content: [{ type: "tool-call", toolCallId: "call-1", toolName: "get_weather", input: { city: "Paris" } }],
        },
      ];

      const genAI = VercelAISpecification.toGenAI({ messages: original, direction: "input" });
      const restored = VercelAISpecification.fromGenAI({
        messages: genAI.messages,
        direction: "output",
        providerMetadata: "passthrough",
      });

      expect(restored.messages).toHaveLength(3);
      expect(restored.messages[0]?.role).toBe("system");
      expect(restored.messages[1]?.role).toBe("user");
      expect(restored.messages[2]?.role).toBe("assistant");
    });
  });

  describe("schema validation", () => {
    it("should have messageSchema defined", () => {
      expect(VercelAISpecification.messageSchema).toBeDefined();
    });

    it("should validate a valid user message with string content", () => {
      const message = { role: "user" as const, content: "Hello" };

      const result = VercelAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate a valid user message with array content", () => {
      const message = { role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] };

      const result = VercelAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate a valid system message", () => {
      const message = { role: "system" as const, content: "Be helpful" };

      const result = VercelAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate a valid assistant message", () => {
      const message = { role: "assistant" as const, content: "Hi!" };

      const result = VercelAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate a valid tool message", () => {
      const message = {
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: "1",
            toolName: "test",
            output: { type: "json" as const, value: {} },
          },
        ],
      };

      const result = VercelAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate tool-result with modern output format", () => {
      const message = {
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: "1",
            toolName: "test",
            output: { type: "json" as const, value: { data: "test" } },
          },
        ],
      };

      const result = VercelAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate tool-result with legacy result format", () => {
      const message = {
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: "1",
            toolName: "test",
            result: { data: "legacy" },
          },
        ],
      };

      const result = VercelAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should validate tool-result with legacy result and isError", () => {
      const message = {
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: "1",
            toolName: "test",
            result: "Error occurred",
            isError: true,
          },
        ],
      };

      const result = VercelAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should reject tool-result without output or result", () => {
      const message = {
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: "1",
            toolName: "test",
            // Neither output nor result provided
          },
        ],
      };

      const result = VercelAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject message without role", () => {
      const invalidMessage = { content: "Hello" };

      const result = VercelAISpecification.messageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it("should reject invalid role", () => {
      const invalidMessage = { role: "invalid_role", content: "Hello" };

      const result = VercelAISpecification.messageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it("should accept message with extra fields (passthrough)", () => {
      const messageWithExtra = {
        role: "user" as const,
        content: "Hello",
        providerOptions: { custom: "data" },
      };

      const result = VercelAISpecification.messageSchema.safeParse(messageWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as { providerOptions?: unknown }).providerOptions).toEqual({ custom: "data" });
      }
    });
  });

  describe("schema passthrough - unknown fields preserved during parsing", () => {
    it("should preserve unknown fields on messages during schema parsing", () => {
      const message = {
        role: "user" as const,
        content: "Hello",
        future_api_field: "preserved",
        nested_data: { key: "value" },
      };

      const result = VercelAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("future_api_field", "preserved");
        expect(result.data).toHaveProperty("nested_data", { key: "value" });
      }
    });

    it("should preserve unknown fields on content parts during schema parsing", () => {
      const message = {
        role: "user" as const,
        content: [{ type: "text" as const, text: "Hello", unknown_field: "test" }],
      };

      const result = VercelAISpecification.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = (result.data as { content: Array<{ unknown_field?: string }> }).content;
        expect(content[0]?.unknown_field).toBe("test");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty messages array", () => {
      const result = VercelAISpecification.toGenAI({ messages: [], direction: "input" });
      expect(result.messages).toEqual([]);
    });

    it("should handle fromGenAI with empty messages array", () => {
      const result = VercelAISpecification.fromGenAI({ messages: [], direction: "output", providerMetadata: "strip" });
      expect(result.messages).toEqual([]);
    });

    it("should handle user message with empty content array", () => {
      const messages: VercelAIMessage[] = [{ role: "user", content: [] }];

      const result = VercelAISpecification.toGenAI({ messages, direction: "input" });

      expect(result.messages[0]?.parts).toEqual([]);
    });

    it("should handle GenAI tool message with no tool_call_response parts", () => {
      const messages: GenAIMessage[] = [
        {
          role: "tool",
          parts: [{ type: "text", content: "Some text" }],
        },
      ];

      const result = VercelAISpecification.fromGenAI({ messages, direction: "output", providerMetadata: "strip" });

      expect(result.messages).toEqual([]);
    });
  });
});
