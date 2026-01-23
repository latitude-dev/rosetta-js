/**
 * Anthropic Provider Tests
 *
 * Comprehensive tests for the Anthropic Messages API format conversion to GenAI.
 */

import { describe, expect, it } from "vitest";
import { AnthropicSpecification } from "./index";

describe("AnthropicSpecification", () => {
  describe("toGenAI", () => {
    describe("string messages", () => {
      it("should convert string to user message for input direction", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: "Hello, how are you?",
          direction: "input",
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.messages[0]?.parts).toHaveLength(1);
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Hello, how are you?",
        });
      });

      it("should convert string to assistant message for output direction", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: "I'm doing great!",
          direction: "output",
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("assistant");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "I'm doing great!",
        });
      });
    });

    describe("system instructions", () => {
      it("should convert string system to system message", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [{ role: "user", content: "Hello" }],
          system: "You are a helpful assistant.",
          direction: "input",
        });

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "You are a helpful assistant.",
        });
        expect(result.messages[1]?.role).toBe("user");
      });

      it("should convert array system to system message", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [{ role: "user", content: "Hello" }],
          system: [
            { type: "text", text: "You are a helpful assistant." },
            { type: "text", text: "Be concise." },
          ],
          direction: "input",
        });

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[0]?.parts).toHaveLength(2);
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "You are a helpful assistant.",
        });
        expect(result.messages[0]?.parts[1]).toEqual({
          type: "text",
          content: "Be concise.",
        });
      });

      it("should preserve cache_control in system text block metadata", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [{ role: "user", content: "Hello" }],
          system: [{ type: "text", text: "Instructions", cache_control: { type: "ephemeral" } }],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]?._provider_metadata?.anthropic).toMatchObject({
          cache_control: { type: "ephemeral" },
        });
      });
    });

    describe("user messages", () => {
      it("should convert user message with string content", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [{ role: "user", content: "Hello!" }],
          direction: "input",
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Hello!",
        });
      });

      it("should convert user message with text array content", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "First part" },
                { type: "text", text: "Second part" },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts).toHaveLength(2);
        expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "First part" });
        expect(result.messages[0]?.parts[1]).toEqual({ type: "text", content: "Second part" });
      });

      it("should convert user message with base64 image", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: "iVBORw0KGgoAAAANSUhEUg...",
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "blob",
          modality: "image",
          mime_type: "image/png",
          content: "iVBORw0KGgoAAAANSUhEUg...",
        });
      });

      it("should convert user message with URL image", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "url",
                    url: "https://example.com/image.png",
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "uri",
          modality: "image",
          uri: "https://example.com/image.png",
        });
      });

      it("should convert user message with base64 PDF document", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: "JVBERi0xLjQK...",
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "blob",
          modality: "document",
          mime_type: "application/pdf",
          content: "JVBERi0xLjQK...",
        });
      });

      it("should convert user message with URL PDF document", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "url",
                    url: "https://example.com/doc.pdf",
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "uri",
          modality: "document",
          uri: "https://example.com/doc.pdf",
        });
      });

      it("should convert user message with plain text document", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "text",
                    media_type: "text/plain",
                    data: "This is a plain text document.",
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "blob",
          modality: "document",
          mime_type: "text/plain",
          content: "This is a plain text document.",
        });
      });

      it("should convert user message with tool result", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "toolu_abc123",
                  content: '{"temperature": 72}',
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call_response",
          id: "toolu_abc123",
          response: '{"temperature": 72}',
        });
      });

      it("should convert tool result with is_error flag", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "toolu_abc123",
                  content: "Error: API rate limit exceeded",
                  is_error: true,
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "tool_call_response",
          id: "toolu_abc123",
          response: "Error: API rate limit exceeded",
        });
        expect(result.messages[0]?.parts[0]?._provider_metadata?.anthropic).toMatchObject({
          is_error: true,
        });
      });

      it("should convert tool result with array content", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "toolu_abc123",
                  content: [
                    { type: "text", text: "Result 1" },
                    { type: "text", text: "Result 2" },
                  ],
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "tool_call_response",
          id: "toolu_abc123",
          response: ["Result 1", "Result 2"],
        });
      });
    });

    describe("assistant messages", () => {
      it("should convert assistant message with string content", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [{ role: "assistant", content: "Hello back!" }],
          direction: "output",
        });

        expect(result.messages[0]?.role).toBe("assistant");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Hello back!",
        });
      });

      it("should convert assistant message with array content", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: [
                { type: "text", text: "Part 1" },
                { type: "text", text: "Part 2" },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts).toHaveLength(2);
        expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Part 1" });
        expect(result.messages[0]?.parts[1]).toEqual({ type: "text", content: "Part 2" });
      });

      it("should convert assistant message with tool use", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: [
                {
                  type: "tool_use",
                  id: "toolu_abc123",
                  name: "get_weather",
                  input: { location: "San Francisco" },
                },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call",
          id: "toolu_abc123",
          name: "get_weather",
          arguments: { location: "San Francisco" },
        });
      });

      it("should convert assistant message with thinking block", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: [
                {
                  type: "thinking",
                  thinking: "Let me think about this carefully...",
                  signature: "abc123signature",
                },
                { type: "text", text: "Here's my answer." },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts).toHaveLength(2);
        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "reasoning",
          content: "Let me think about this carefully...",
        });
        expect(result.messages[0]?.parts[0]?._provider_metadata?.anthropic).toMatchObject({
          signature: "abc123signature",
        });
        expect(result.messages[0]?.parts[1]).toEqual({ type: "text", content: "Here's my answer." });
      });

      it("should convert assistant message with redacted thinking block", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: [
                {
                  type: "redacted_thinking",
                  data: "encryptedthinkingdata...",
                },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "redacted_thinking",
          data: "encryptedthinkingdata...",
        });
      });

      it("should convert server tool use (web_search)", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: [
                {
                  type: "server_tool_use",
                  id: "srvtoolu_abc123",
                  name: "web_search",
                  input: { query: "latest news" },
                },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "tool_call",
          id: "srvtoolu_abc123",
          name: "web_search",
          arguments: { query: "latest news" },
        });
        expect(result.messages[0]?.parts[0]?._provider_metadata?.anthropic).toMatchObject({
          isServerTool: true,
        });
      });

      it("should convert web search tool result", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: [
                {
                  type: "web_search_tool_result",
                  tool_use_id: "srvtoolu_abc123",
                  content: [
                    {
                      type: "web_search_result",
                      url: "https://example.com",
                      title: "Example Page",
                      encrypted_content: "encryptedcontent...",
                    },
                  ],
                },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "tool_call_response",
          id: "srvtoolu_abc123",
        });
        expect(result.messages[0]?.parts[0]?._provider_metadata?.anthropic).toMatchObject({
          isWebSearchResult: true,
        });
      });
    });

    describe("output message format (Message)", () => {
      it("should convert full Message response", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              id: "msg_abc123",
              type: "message",
              role: "assistant",
              content: [{ type: "text", text: "Hello!" }],
              model: "claude-3-5-sonnet-20241022",
              stop_reason: "end_turn",
              stop_sequence: null,
              usage: { input_tokens: 10, output_tokens: 5 },
            },
          ],
          direction: "output",
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("assistant");
        expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello!" });
        expect(result.messages[0]?.finish_reason).toBe("stop");
      });

      it("should map stop_reason to finish_reason correctly", () => {
        const testCases = [
          { stop_reason: "end_turn", expected: "stop" },
          { stop_reason: "max_tokens", expected: "length" },
          { stop_reason: "stop_sequence", expected: "stop" },
          { stop_reason: "tool_use", expected: "tool_call" },
          { stop_reason: "refusal", expected: "content_filter" },
        ];

        for (const { stop_reason, expected } of testCases) {
          const result = AnthropicSpecification.toGenAI({
            messages: [
              {
                id: "msg_123",
                type: "message",
                role: "assistant",
                content: [{ type: "text", text: "Test" }],
                model: "claude-3-5-sonnet",
                stop_reason,
                stop_sequence: null,
                usage: {},
              },
            ],
            direction: "output",
          });

          expect(result.messages[0]?.finish_reason).toBe(expected);
        }
      });
    });

    describe("conversation flow", () => {
      it("should convert a complete conversation", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            { role: "user", content: "What's the weather?" },
            {
              role: "assistant",
              content: [
                {
                  type: "tool_use",
                  id: "toolu_1",
                  name: "get_weather",
                  input: { city: "NYC" },
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "toolu_1",
                  content: '{"temp": 72}',
                },
              ],
            },
            { role: "assistant", content: "The weather in NYC is 72°F." },
          ],
          system: "You are a helpful assistant.",
          direction: "input",
        });

        expect(result.messages).toHaveLength(5);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[1]?.role).toBe("user");
        expect(result.messages[2]?.role).toBe("assistant");
        expect(result.messages[2]?.parts[0]?.type).toBe("tool_call");
        expect(result.messages[3]?.role).toBe("user");
        expect(result.messages[3]?.parts[0]?.type).toBe("tool_call_response");
        expect(result.messages[4]?.role).toBe("assistant");
      });
    });

    describe("edge cases", () => {
      it("should handle empty messages array", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [],
          direction: "input",
        });

        expect(result.messages).toHaveLength(0);
      });

      it("should reject empty content array (API requires at least 1 block)", () => {
        expect(() => {
          AnthropicSpecification.toGenAI({
            messages: [{ role: "assistant", content: [] }],
            direction: "output",
          });
        }).toThrow();
      });

      it("should handle mixed content types", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "What's in this image?" },
                {
                  type: "image",
                  source: {
                    type: "url",
                    url: "https://example.com/img.jpg",
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts).toHaveLength(2);
        expect(result.messages[0]?.parts[0]?.type).toBe("text");
        expect(result.messages[0]?.parts[1]?.type).toBe("uri");
      });
    });

    describe("schema validation", () => {
      it("should validate correct messages", () => {
        const message = { role: "user", content: "Hello" };
        const result = AnthropicSpecification.messageSchema.safeParse(message);
        expect(result.success).toBe(true);
      });

      it("should validate Message output format", () => {
        const message = {
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
          model: "claude-3-5-sonnet",
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: {},
        };
        const result = AnthropicSpecification.messageSchema.safeParse(message);
        expect(result.success).toBe(true);
      });
    });

    describe("passthrough - unknown fields preservation", () => {
      it("should preserve unknown fields on user messages", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: "Hello!",
              unknown_field: "should be preserved",
              another_field: { nested: true },
            } as never,
          ],
          direction: "input",
        });

        expect(result.messages[0]?._provider_metadata?.anthropic).toMatchObject({
          unknown_field: "should be preserved",
          another_field: { nested: true },
        });
      });

      it("should preserve unknown fields on assistant messages", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: "Hi there!",
              future_field: "new API field",
              metadata: { version: 2 },
            } as never,
          ],
          direction: "output",
        });

        expect(result.messages[0]?._provider_metadata?.anthropic).toMatchObject({
          future_field: "new API field",
          metadata: { version: 2 },
        });
      });

      it("should preserve cache_control on text blocks", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Cached content",
                  cache_control: { type: "ephemeral" },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]?._provider_metadata?.anthropic).toMatchObject({
          cache_control: { type: "ephemeral" },
        });
      });

      it("should preserve citations on text blocks", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: [
                {
                  type: "text",
                  text: "According to the document...",
                  citations: [
                    {
                      type: "char_location",
                      cited_text: "source text",
                      document_index: 0,
                      start_char_index: 0,
                      end_char_index: 10,
                    },
                  ],
                },
              ],
            },
          ],
          direction: "output",
        });

        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signature access
        expect(result.messages[0]?.parts[0]?._provider_metadata?.anthropic?.["citations"]).toBeDefined();
      });
    });

    describe("schema passthrough - unknown fields preserved during parsing", () => {
      it("should preserve unknown fields on messages during schema parsing", () => {
        const message = {
          role: "user",
          content: "Hello",
          future_api_field: "preserved",
          nested_data: { key: "value" },
        };

        const result = AnthropicSpecification.messageSchema.safeParse(message);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveProperty("future_api_field", "preserved");
          expect(result.data).toHaveProperty("nested_data", { key: "value" });
        }
      });

      it("should preserve unknown fields on tool use during schema parsing", () => {
        const message = {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_abc",
              name: "get_weather",
              input: { city: "NYC" },
              extra_field: "preserved",
            },
          ],
        };

        const result = AnthropicSpecification.messageSchema.safeParse(message);
        expect(result.success).toBe(true);
        if (result.success && Array.isArray(result.data.content)) {
          expect(result.data.content[0]).toHaveProperty("extra_field", "preserved");
        }
      });

      it("should preserve unknown fields on image blocks during schema parsing", () => {
        const message = {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: "base64data",
                extra_source_field: "preserved",
              },
              cache_control: { type: "ephemeral" },
            },
          ],
        };

        const result = AnthropicSpecification.messageSchema.safeParse(message);
        expect(result.success).toBe(true);
        if (result.success && Array.isArray(result.data.content)) {
          const imagePart = result.data.content[0];
          expect(imagePart).toHaveProperty("cache_control", { type: "ephemeral" });
          if (imagePart && "source" in imagePart && typeof imagePart.source === "object") {
            expect(imagePart.source).toHaveProperty("extra_source_field", "preserved");
          }
        }
      });

      it("should preserve unknown fields through entire message conversion", () => {
        const result = AnthropicSpecification.toGenAI({
          messages: [
            {
              id: "msg_abc",
              type: "message",
              role: "assistant",
              content: [{ type: "text", text: "Response" }],
              model: "claude-3-5-sonnet",
              stop_reason: "end_turn",
              stop_sequence: null,
              usage: { input_tokens: 10, output_tokens: 5 },
              future_field: "should be preserved",
            } as never,
          ],
          direction: "output",
        });

        expect(result.messages[0]?._provider_metadata?.anthropic).toMatchObject({
          future_field: "should be preserved",
        });
      });
    });
  });
});
