/**
 * OpenAI Completions Provider Tests
 *
 * Comprehensive tests for the OpenAI Chat Completions message format conversion to GenAI.
 */

import { describe, expect, it } from "vitest";
import { OpenAICompletionsSpecification } from "./index";

describe("OpenAICompletionsSpecification", () => {
  describe("toGenAI", () => {
    describe("string messages", () => {
      it("should convert string to user message for input direction", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
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
        const result = OpenAICompletionsSpecification.toGenAI({
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

    describe("system messages", () => {
      it("should convert system message with string content", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [{ role: "system", content: "You are a helpful assistant." }],
          direction: "input",
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "You are a helpful assistant.",
        });
      });

      it("should convert system message with array content", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "system",
              content: [{ type: "text", text: "You are a helpful assistant." }],
            },
          ],
          direction: "input",
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "You are a helpful assistant.",
        });
      });

      it("should preserve system message name", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [{ role: "system", content: "Instructions", name: "config" }],
          direction: "input",
        });

        expect(result.messages[0]?.name).toBe("config");
      });
    });

    describe("developer messages", () => {
      it("should convert developer message", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [{ role: "developer", content: "Developer instructions" }],
          direction: "input",
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("developer");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Developer instructions",
        });
      });
    });

    describe("user messages", () => {
      it("should convert user message with string content", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
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
        const result = OpenAICompletionsSpecification.toGenAI({
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

      it("should convert user message with image URL", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [{ type: "image_url", image_url: { url: "https://example.com/image.png" } }],
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

      it("should convert user message with image URL and detail level", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [{ type: "image_url", image_url: { url: "https://example.com/image.png", detail: "high" } }],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "uri",
          modality: "image",
          uri: "https://example.com/image.png",
          _provider_metadata: { openai_completions: { detail: "high" } },
        });
      });

      it("should convert user message with base64 image data URL", () => {
        const base64Data =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [{ type: "image_url", image_url: { url: `data:image/png;base64,${base64Data}` } }],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "blob",
          modality: "image",
          mime_type: "image/png",
          content: base64Data,
        });
      });

      it("should convert user message with audio input", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [{ type: "input_audio", input_audio: { data: "base64audiodata", format: "mp3" } }],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "blob",
          modality: "audio",
          mime_type: "audio/mp3",
          content: "base64audiodata",
          _provider_metadata: { openai_completions: { format: "mp3" } },
        });
      });

      it("should convert user message with file by file_id", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [{ type: "file", file: { file_id: "file-abc123", filename: "document.pdf" } }],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "file",
          modality: "document",
          file_id: "file-abc123",
          _provider_metadata: { openai_completions: { filename: "document.pdf" } },
        });
      });

      it("should convert user message with file by file_data", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [{ type: "file", file: { file_data: "base64filedata", filename: "data.txt" } }],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "blob",
          modality: "document",
          content: "base64filedata",
          _provider_metadata: { openai_completions: { filename: "data.txt" } },
        });
      });

      it("should preserve user message name", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [{ role: "user", content: "Hello!", name: "Alice" }],
          direction: "input",
        });

        expect(result.messages[0]?.name).toBe("Alice");
      });
    });

    describe("assistant messages", () => {
      it("should convert assistant message with string content", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
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
        const result = OpenAICompletionsSpecification.toGenAI({
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

      it("should convert assistant message with refusal content part", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: [{ type: "refusal", refusal: "I cannot help with that." }],
            },
          ],
          direction: "output",
        });

        // isRefusal is stored at root level for cross-provider access
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "I cannot help with that.",
          _provider_metadata: { isRefusal: true },
        });
      });

      it("should convert assistant message with top-level refusal field", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: null,
              refusal: "I cannot assist with that request.",
            },
          ],
          direction: "output",
        });

        // isRefusal is stored at root level for cross-provider access
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "I cannot assist with that request.",
          _provider_metadata: { isRefusal: true },
        });
      });

      it("should convert assistant message with function tool calls", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_abc123",
                  type: "function",
                  function: {
                    name: "get_weather",
                    arguments: '{"location":"San Francisco"}',
                  },
                },
              ],
            },
          ],
          direction: "output",
        });

        // Function tool calls don't need extra metadata - structure is fully captured
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call",
          id: "call_abc123",
          name: "get_weather",
          arguments: { location: "San Francisco" },
        });
      });

      it("should convert assistant message with custom tool calls", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_xyz789",
                  type: "custom",
                  custom: {
                    name: "my_custom_tool",
                    input: "some input data",
                  },
                },
              ],
            },
          ],
          direction: "output",
        });

        // Custom tool calls: input becomes arguments, no redundant metadata
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call",
          id: "call_xyz789",
          name: "my_custom_tool",
          arguments: "some input data",
        });
      });

      it("should handle invalid JSON in tool call arguments gracefully", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_abc",
                  type: "function",
                  function: {
                    name: "some_func",
                    arguments: "invalid json {",
                  },
                },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call",
          id: "call_abc",
          name: "some_func",
          arguments: "invalid json {",
        });
      });

      it("should convert deprecated function_call field", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: null,
              function_call: {
                name: "legacy_function",
                arguments: '{"param":"value"}',
              },
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call",
          id: null,
          name: "legacy_function",
          arguments: { param: "value" },
        });
      });

      it("should preserve annotations in metadata", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: "Check out this link",
              annotations: [
                {
                  type: "url_citation",
                  url_citation: {
                    start_index: 0,
                    end_index: 10,
                    url: "https://example.com",
                    title: "Example",
                  },
                },
              ],
            },
          ],
          direction: "output",
        });

        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signature access
        expect(result.messages[0]?._provider_metadata?.openai_completions?.["annotations"]).toHaveLength(1);
      });

      it("should convert audio response to blob", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: "Here's the audio",
              audio: {
                id: "audio_123",
                expires_at: 1234567890,
                data: "base64audiodata",
                transcript: "Hello world",
              },
            },
          ],
          direction: "output",
        });

        const audioPart = result.messages[0]?.parts.find((p) => p.type === "blob");
        expect(audioPart).toEqual({
          type: "blob",
          modality: "audio",
          content: "base64audiodata",
          _provider_metadata: {
            openai_completions: {
              audio: {
                id: "audio_123",
                expires_at: 1234567890,
                data: "base64audiodata",
                transcript: "Hello world",
              },
            },
          },
        });
      });
    });

    describe("tool messages", () => {
      it("should convert tool message with string content", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "tool",
              content: '{"temperature": 72}',
              tool_call_id: "call_abc123",
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.role).toBe("tool");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call_response",
          id: "call_abc123",
          response: '{"temperature": 72}',
        });
      });

      it("should convert tool message with array content", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "tool",
              content: [
                { type: "text", text: "Result 1" },
                { type: "text", text: "Result 2" },
              ],
              tool_call_id: "call_xyz",
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call_response",
          id: "call_xyz",
          response: ["Result 1", "Result 2"],
        });
      });
    });

    describe("function messages (deprecated)", () => {
      it("should convert function message", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "function",
              content: "Function result here",
              name: "my_function",
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.role).toBe("tool");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "tool_call_response",
          id: null,
          response: "Function result here",
          _provider_metadata: { openai_completions: { name: "my_function" } },
        });
      });

      it("should handle null content in function message", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "function",
              content: null,
              name: "void_function",
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "tool_call_response",
          response: null,
        });
      });
    });

    describe("conversation flow", () => {
      it("should convert a complete conversation", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "What's the weather?" },
            {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "get_weather", arguments: '{"city":"NYC"}' },
                },
              ],
            },
            { role: "tool", content: '{"temp":72}', tool_call_id: "call_1" },
            { role: "assistant", content: "The weather in NYC is 72°F." },
          ],
          direction: "input",
        });

        expect(result.messages).toHaveLength(5);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[1]?.role).toBe("user");
        expect(result.messages[2]?.role).toBe("assistant");
        expect(result.messages[2]?.parts[0]?.type).toBe("tool_call");
        expect(result.messages[3]?.role).toBe("tool");
        expect(result.messages[3]?.parts[0]?.type).toBe("tool_call_response");
        expect(result.messages[4]?.role).toBe("assistant");
      });
    });

    describe("edge cases", () => {
      it("should handle empty messages array", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [],
          direction: "input",
        });

        expect(result.messages).toHaveLength(0);
      });

      it("should handle assistant message with null content", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [{ role: "assistant", content: null }],
          direction: "output",
        });

        expect(result.messages[0]?.parts).toHaveLength(0);
      });

      it("should handle mixed content types in user message", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "What's in this image?" },
                { type: "image_url", image_url: { url: "https://example.com/img.jpg" } },
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
      it("should reject invalid message structure", () => {
        expect(() => {
          OpenAICompletionsSpecification.toGenAI({
            messages: [{ role: "invalid_role", content: "test" }] as never,
            direction: "input",
          });
        }).toThrow();
      });

      it("should reject user message without content", () => {
        expect(() => {
          OpenAICompletionsSpecification.toGenAI({
            messages: [{ role: "user" }] as never,
            direction: "input",
          });
        }).toThrow();
      });
    });

    describe("passthrough - unknown fields preservation", () => {
      it("should preserve unknown fields on user messages", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
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

        expect(result.messages[0]?._provider_metadata?.openai_completions).toMatchObject({
          unknown_field: "should be preserved",
          another_field: { nested: true },
        });
      });

      it("should preserve unknown fields on assistant messages", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
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

        expect(result.messages[0]?._provider_metadata?.openai_completions).toMatchObject({
          future_field: "new API field",
          metadata: { version: 2 },
        });
      });

      it("should preserve unknown fields on system messages", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "system",
              content: "You are helpful.",
              priority: "high",
            } as never,
          ],
          direction: "input",
        });

        expect(result.messages[0]?._provider_metadata?.openai_completions).toMatchObject({
          priority: "high",
        });
      });

      it("should preserve unknown fields on tool messages in part metadata", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "tool",
              content: '{"result": "ok"}',
              tool_call_id: "call_123",
              execution_time_ms: 150,
            } as never,
          ],
          direction: "input",
        });

        // Tool message extra fields are stored in the part's metadata
        expect(result.messages[0]?.parts[0]?._provider_metadata?.openai_completions).toMatchObject({
          execution_time_ms: 150,
        });
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

        const result = OpenAICompletionsSpecification.messageSchema.safeParse(message);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveProperty("future_api_field", "preserved");
          expect(result.data).toHaveProperty("nested_data", { key: "value" });
        }
      });

      it("should preserve unknown fields on assistant messages during schema parsing", () => {
        const message = {
          role: "assistant",
          content: "Response",
          reasoning_content: "I thought carefully...",
          model_info: { version: "v2" },
        };

        const result = OpenAICompletionsSpecification.messageSchema.safeParse(message);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveProperty("reasoning_content", "I thought carefully...");
          expect(result.data).toHaveProperty("model_info", { version: "v2" });
        }
      });

      it("should preserve unknown fields on tool calls during schema parsing", () => {
        const message = {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_abc",
              type: "function",
              function: {
                name: "get_weather",
                arguments: '{"city":"NYC"}',
                extra_function_field: "preserved",
              },
              index: 0,
              new_tool_field: "also preserved",
            },
          ],
        };

        const result = OpenAICompletionsSpecification.messageSchema.safeParse(message);
        expect(result.success).toBe(true);
        if (result.success && result.data.role === "assistant" && result.data.tool_calls) {
          const toolCall = result.data.tool_calls[0];
          expect(toolCall).toHaveProperty("index", 0);
          expect(toolCall).toHaveProperty("new_tool_field", "also preserved");
          expect(toolCall?.function).toHaveProperty("extra_function_field", "preserved");
        }
      });

      it("should preserve unknown fields on text content parts during schema parsing", () => {
        const message = {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hello",
              annotations: [{ type: "highlight", start: 0, end: 5 }],
              confidence: 0.95,
            },
          ],
        };

        const result = OpenAICompletionsSpecification.messageSchema.safeParse(message);
        expect(result.success).toBe(true);
        if (result.success && Array.isArray(result.data.content)) {
          expect(result.data.content[0]).toHaveProperty("annotations", [{ type: "highlight", start: 0, end: 5 }]);
          expect(result.data.content[0]).toHaveProperty("confidence", 0.95);
        }
      });

      it("should preserve unknown fields on image URL parts during schema parsing", () => {
        const message = {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: "https://example.com/img.jpg",
                alt_text: "An example image",
                source: "user_upload",
              },
              cache_control: { type: "ephemeral" },
            },
          ],
        };

        const result = OpenAICompletionsSpecification.messageSchema.safeParse(message);
        expect(result.success).toBe(true);
        if (result.success && Array.isArray(result.data.content)) {
          const part = result.data.content[0];
          expect(part).toHaveProperty("cache_control", { type: "ephemeral" });
          if (part && "image_url" in part) {
            expect(part.image_url).toHaveProperty("alt_text", "An example image");
            expect(part.image_url).toHaveProperty("source", "user_upload");
          }
        }
      });

      it("should preserve unknown fields on tool messages during schema parsing", () => {
        const message = {
          role: "tool",
          content: '{"result": "ok"}',
          tool_call_id: "call_123",
          execution_time_ms: 150,
          cached: true,
        };

        const result = OpenAICompletionsSpecification.messageSchema.safeParse(message);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveProperty("execution_time_ms", 150);
          expect(result.data).toHaveProperty("cached", true);
        }
      });

      it("should preserve unknown fields through entire message conversion", () => {
        // Simulate a hypothetical future OpenAI API response with new fields
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "assistant",
              content: "Here's my response",
              reasoning_content: "I thought about this carefully...",
              model_version: "gpt-5",
              usage: { prompt_tokens: 10, completion_tokens: 20 },
            } as never,
          ],
          direction: "output",
        });

        const metadata = result.messages[0]?._provider_metadata?.openai_completions;
        expect(metadata).toMatchObject({
          reasoning_content: "I thought about this carefully...",
          model_version: "gpt-5",
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        });
      });
    });

    describe("content part passthrough - unknown fields preserved through full conversion", () => {
      it("should preserve unknown fields on text content parts", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Hello",
                  annotations: [{ type: "highlight" }],
                  confidence: 0.95,
                } as never,
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]?._provider_metadata?.openai_completions).toMatchObject({
          annotations: [{ type: "highlight" }],
          confidence: 0.95,
        });
      });

      it("should preserve unknown fields on image_url parts", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: "https://example.com/img.jpg",
                    detail: "high",
                    alt_text: "An example image",
                    source: "user_upload",
                  },
                  cache_control: { type: "ephemeral" },
                } as never,
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]?._provider_metadata?.openai_completions).toMatchObject({
          detail: "high",
          alt_text: "An example image",
          source: "user_upload",
          cache_control: { type: "ephemeral" },
        });
      });

      it("should preserve unknown fields on input_audio parts", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: {
                    data: "base64data",
                    format: "mp3",
                    sample_rate: 44100,
                    channels: 2,
                  },
                  duration_ms: 5000,
                } as never,
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]?._provider_metadata?.openai_completions).toMatchObject({
          format: "mp3",
          sample_rate: 44100,
          channels: 2,
          duration_ms: 5000,
        });
      });

      it("should preserve unknown fields on file parts", () => {
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "file",
                  file: {
                    file_id: "file-123",
                    filename: "doc.pdf",
                    mime_type: "application/pdf",
                    size_bytes: 1024,
                  },
                  processing_status: "complete",
                } as never,
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]?._provider_metadata?.openai_completions).toMatchObject({
          filename: "doc.pdf",
          mime_type: "application/pdf",
          size_bytes: 1024,
          processing_status: "complete",
        });
      });

      it("should preserve unknown fields on base64 image data URL parts", () => {
        const base64Data = "iVBORw0KGgo=";
        const result = OpenAICompletionsSpecification.toGenAI({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${base64Data}`,
                    detail: "auto",
                    dimensions: { width: 100, height: 100 },
                  },
                  upload_id: "upload-xyz",
                } as never,
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]?._provider_metadata?.openai_completions).toMatchObject({
          detail: "auto",
          dimensions: { width: 100, height: 100 },
          upload_id: "upload-xyz",
        });
      });
    });
  });
});
