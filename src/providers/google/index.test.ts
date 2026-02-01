/**
 * Google Gemini Provider Tests
 *
 * Comprehensive tests for the Google Gemini API format conversion to GenAI.
 */

import { describe, expect, it } from "vitest";
import { GoogleSpecification } from "./index";
import { GoogleContentSchema, GooglePartSchema } from "./schema";

describe("GoogleSpecification", () => {
  describe("toGenAI", () => {
    describe("string messages", () => {
      it("should convert string to user message for input direction", () => {
        const result = GoogleSpecification.toGenAI({
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

      it("should convert string to model message for output direction", () => {
        const result = GoogleSpecification.toGenAI({
          messages: "I'm doing great!",
          direction: "output",
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("model");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "I'm doing great!",
        });
      });
    });

    describe("system instructions", () => {
      it("should convert string system to system message", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [{ role: "user", parts: [{ text: "Hello" }] }],
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

      it("should convert Content system with parts to system message", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [{ role: "user", parts: [{ text: "Hello" }] }],
          system: {
            role: "system",
            parts: [{ text: "Be concise." }, { text: "Be helpful." }],
          },
          direction: "input",
        });

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[0]?.parts).toHaveLength(2);
        expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Be concise." });
        expect(result.messages[0]?.parts[1]).toEqual({ type: "text", content: "Be helpful." });
      });

      it("should convert array of parts as system to system message", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [{ role: "user", parts: [{ text: "Hello" }] }],
          system: [{ text: "First instruction." }, { text: "Second instruction." }],
          direction: "input",
        });

        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[0]?.parts).toHaveLength(2);
      });

      it("should convert single part as system to system message", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [{ role: "user", parts: [{ text: "Hello" }] }],
          system: { text: "Single instruction." },
          direction: "input",
        });

        expect(result.messages[0]?.role).toBe("system");
        expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Single instruction." });
      });
    });

    describe("user messages", () => {
      it("should convert user message with text part", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [{ role: "user", parts: [{ text: "Hello!" }] }],
          direction: "input",
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.messages[0]?.parts[0]).toEqual({
          type: "text",
          content: "Hello!",
        });
      });

      it("should convert user message with multiple text parts", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "user",
              parts: [{ text: "First part" }, { text: "Second part" }],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts).toHaveLength(2);
        expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "First part" });
        expect(result.messages[0]?.parts[1]).toEqual({ type: "text", content: "Second part" });
      });

      it("should convert user message with inline image data", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
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

      it("should convert user message with file data reference", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "user",
              parts: [
                {
                  fileData: {
                    mimeType: "video/mp4",
                    fileUri: "gs://bucket/video.mp4",
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "uri",
          modality: "video",
          mime_type: "video/mp4",
          uri: "gs://bucket/video.mp4",
        });
      });

      it("should convert user message with audio inline data", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/mp3",
                    data: "base64audiodata...",
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toEqual({
          type: "blob",
          modality: "audio",
          mime_type: "audio/mp3",
          content: "base64audiodata...",
        });
      });

      it("should convert user message with PDF document", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
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
    });

    describe("model messages", () => {
      it("should convert model role to assistant", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [{ role: "model", parts: [{ text: "Hello!" }] }],
          direction: "output",
        });

        expect(result.messages[0]?.role).toBe("assistant");
      });

      it("should handle missing role based on direction", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [{ parts: [{ text: "Hello!" }] }],
          direction: "output",
        });

        expect(result.messages[0]?.role).toBe("assistant");
      });
    });

    describe("function calls", () => {
      it("should convert function call to tool_call", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "model",
              parts: [
                {
                  functionCall: {
                    name: "get_weather",
                    args: { location: "New York" },
                  },
                },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "tool_call",
          id: null,
          name: "get_weather",
          arguments: { location: "New York" },
        });
      });

      it("should convert function call with id", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "model",
              parts: [
                {
                  functionCall: {
                    id: "call_123",
                    name: "search",
                    args: { query: "test" },
                  },
                },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "tool_call",
          id: "call_123",
          name: "search",
        });
      });
    });

    describe("function responses", () => {
      it("should convert function response to tool_call_response", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: "get_weather",
                    response: { temperature: 72, condition: "sunny" },
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "tool_call_response",
          id: null,
          response: { temperature: 72, condition: "sunny" },
        });
        // toolName is stored in _known_fields for cross-provider access
        expect(
          // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
          (result.messages[0]?.parts[0]?._provider_metadata?._known_fields as Record<string, unknown>)?.["toolName"],
        ).toBe("get_weather");
      });

      it("should convert function response with id", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    id: "call_123",
                    name: "search",
                    response: { results: ["a", "b", "c"] },
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "tool_call_response",
          id: "call_123",
        });
      });
    });

    describe("thought/reasoning content", () => {
      it("should convert thought part to reasoning", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "model",
              parts: [{ text: "Let me think about this...", thought: true }],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "reasoning",
          content: "Let me think about this...",
        });
      });

      it("should preserve thought signature in metadata", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "model",
              parts: [
                {
                  text: "Reasoning content",
                  thought: true,
                  thoughtSignature: "sig123",
                },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]?._provider_metadata).toMatchObject({
          thoughtSignature: "sig123",
        });
      });
    });

    describe("executable code", () => {
      it("should convert executable code to generic part", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "model",
              parts: [
                {
                  executableCode: {
                    code: "print('Hello, world!')",
                    language: "PYTHON",
                  },
                },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "executable_code",
          code: "print('Hello, world!')",
          language: "PYTHON",
        });
      });
    });

    describe("code execution results", () => {
      it("should convert code execution result to generic part", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "model",
              parts: [
                {
                  codeExecutionResult: {
                    outcome: "OUTCOME_OK",
                    output: "Hello, world!",
                  },
                },
              ],
            },
          ],
          direction: "output",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "code_execution_result",
          outcome: "OUTCOME_OK",
          output: "Hello, world!",
        });
      });
    });

    describe("metadata preservation", () => {
      it("should preserve extra content fields in _provider_metadata", () => {
        const messageWithExtra = { role: "user", parts: [{ text: "Hello" }], customField: "custom value" };
        const result = GoogleSpecification.toGenAI({
          messages: [messageWithExtra],
          direction: "input",
        });

        expect(result.messages[0]?._provider_metadata).toMatchObject({
          customField: "custom value",
        });
      });

      it("should preserve extra inline data fields in metadata", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: "base64data",
                    displayName: "test.png",
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]?._provider_metadata).toMatchObject({
          displayName: "test.png",
        });
      });

      it("should preserve extra file data fields in metadata", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "user",
              parts: [
                {
                  fileData: {
                    mimeType: "video/mp4",
                    fileUri: "gs://bucket/video.mp4",
                    displayName: "my-video.mp4",
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]?._provider_metadata).toMatchObject({
          displayName: "my-video.mp4",
        });
      });
    });

    describe("edge cases", () => {
      it("should handle empty messages array", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [],
          direction: "input",
        });

        expect(result.messages).toHaveLength(0);
      });

      it("should handle empty parts array", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [{ role: "user", parts: [] }],
          direction: "input",
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.parts).toHaveLength(0);
      });

      it("should handle undefined parts", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [{ role: "user" }],
          direction: "input",
        });

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]?.parts).toHaveLength(0);
      });

      it("should handle missing mimeType in inline data", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: "base64data",
                  },
                },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts[0]).toMatchObject({
          type: "blob",
          modality: "document",
          mime_type: null,
          content: "base64data",
        });
      });

      it("should reject parts without Google-specific fields", () => {
        expect(() =>
          GoogleSpecification.toGenAI({
            messages: [
              {
                role: "user",
                // biome-ignore lint/suspicious/noExplicitAny: Testing handling of unknown part types
                parts: [{ unknownField: "value" } as any],
              },
            ],
            direction: "input",
          }),
        ).toThrow("Part must have at least one Google-specific field");
      });
    });

    describe("complex conversations", () => {
      it("should handle multi-turn conversation", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            { role: "user", parts: [{ text: "What's the weather?" }] },
            {
              role: "model",
              parts: [{ functionCall: { name: "get_weather", args: { city: "NYC" } } }],
            },
            {
              role: "user",
              parts: [{ functionResponse: { name: "get_weather", response: { temp: 72 } } }],
            },
            { role: "model", parts: [{ text: "The temperature in NYC is 72°F." }] },
          ],
          direction: "input",
        });

        expect(result.messages).toHaveLength(4);
        expect(result.messages[0]?.role).toBe("user");
        expect(result.messages[1]?.role).toBe("assistant");
        expect(result.messages[2]?.role).toBe("user");
        expect(result.messages[3]?.role).toBe("assistant");
      });

      it("should handle mixed content in single message", () => {
        const result = GoogleSpecification.toGenAI({
          messages: [
            {
              role: "user",
              parts: [
                { text: "Check this image:" },
                { inlineData: { mimeType: "image/png", data: "base64data" } },
                { text: "What do you see?" },
              ],
            },
          ],
          direction: "input",
        });

        expect(result.messages[0]?.parts).toHaveLength(3);
        expect(result.messages[0]?.parts[0]?.type).toBe("text");
        expect(result.messages[0]?.parts[1]?.type).toBe("blob");
        expect(result.messages[0]?.parts[2]?.type).toBe("text");
      });
    });
  });

  describe("schema validation", () => {
    describe("GoogleContentSchema", () => {
      it("should validate correct content", () => {
        const content = {
          role: "user",
          parts: [{ text: "Hello" }],
        };

        const result = GoogleContentSchema.safeParse(content);
        expect(result.success).toBe(true);
      });

      it("should validate content with all part types", () => {
        const content = {
          role: "model",
          parts: [{ text: "Response" }, { functionCall: { name: "test", args: {} } }],
        };

        const result = GoogleContentSchema.safeParse(content);
        expect(result.success).toBe(true);
      });

      it("should validate content without role", () => {
        const content = {
          parts: [{ text: "Hello" }],
        };

        const result = GoogleContentSchema.safeParse(content);
        expect(result.success).toBe(true);
      });
    });

    describe("GooglePartSchema", () => {
      it("should validate text part", () => {
        const part = { text: "Hello" };
        const result = GooglePartSchema.safeParse(part);
        expect(result.success).toBe(true);
      });

      it("should validate inline data part", () => {
        const part = {
          inlineData: {
            mimeType: "image/png",
            data: "base64data",
          },
        };
        const result = GooglePartSchema.safeParse(part);
        expect(result.success).toBe(true);
      });

      it("should validate function call part", () => {
        const part = {
          functionCall: {
            name: "get_weather",
            args: { city: "NYC" },
          },
        };
        const result = GooglePartSchema.safeParse(part);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("schema passthrough - unknown fields preserved during parsing", () => {
    it("should preserve unknown fields on content during schema parsing", () => {
      const content = {
        role: "user",
        parts: [{ text: "Hello" }],
        future_api_field: "preserved",
        nested_data: { key: "value" },
      };

      const result = GoogleContentSchema.safeParse(content);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("future_api_field", "preserved");
        expect(result.data).toHaveProperty("nested_data", { key: "value" });
      }
    });

    it("should preserve unknown fields on parts during schema parsing", () => {
      const part = {
        text: "Hello",
        future_field: "preserved",
        annotations: [{ type: "highlight" }],
      };

      const result = GooglePartSchema.safeParse(part);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("future_field", "preserved");
        expect(result.data).toHaveProperty("annotations", [{ type: "highlight" }]);
      }
    });

    it("should preserve unknown fields on inline data during schema parsing", () => {
      const part = {
        inlineData: {
          mimeType: "image/png",
          data: "base64data",
          displayName: "test.png",
          futureField: "value",
        },
      };

      const result = GooglePartSchema.safeParse(part);
      expect(result.success).toBe(true);
      if (result.success && result.data.inlineData) {
        expect(result.data.inlineData).toHaveProperty("displayName", "test.png");
        expect(result.data.inlineData).toHaveProperty("futureField", "value");
      }
    });

    it("should preserve unknown fields on function calls during schema parsing", () => {
      const part = {
        functionCall: {
          id: "call_123",
          name: "test",
          args: { key: "value" },
          partialArgs: [{ path: "$.key" }],
          willContinue: true,
        },
      };

      const result = GooglePartSchema.safeParse(part);
      expect(result.success).toBe(true);
      if (result.success && result.data.functionCall) {
        expect(result.data.functionCall).toHaveProperty("partialArgs");
        expect(result.data.functionCall).toHaveProperty("willContinue", true);
      }
    });
  });
});
