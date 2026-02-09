/**
 * Compat Provider Unit Tests
 *
 * Tests the universal fallback provider's ability to convert
 * various LLM message formats to GenAI.
 */

import { describe, expect, it } from "vitest";
import { CompatSpecification } from "./index";

describe("CompatSpecification", () => {
  describe("string messages", () => {
    it("should convert string to user message for input direction", () => {
      const result = CompatSpecification.toGenAI({ messages: "Hello", direction: "input" });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
    });

    it("should convert string to assistant message for output direction", () => {
      const result = CompatSpecification.toGenAI({ messages: "Response", direction: "output" });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Response" });
    });

    it("should include system instructions when messages is a string", () => {
      const result = CompatSpecification.toGenAI({
        messages: "Hello",
        system: "You are a pirate.",
        direction: "input",
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "You are a pirate." });
      expect(result.messages[1]?.role).toBe("user");
      expect(result.messages[1]?.parts[0]).toEqual({ type: "text", content: "Hello" });
    });
  });

  describe("role detection", () => {
    it("should detect standard roles", () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "system", content: "Instructions" },
        { role: "tool", content: "Result", tool_call_id: "123" },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[2]?.role).toBe("system");
      expect(result.messages[3]?.role).toBe("tool");
    });

    it("should map Google Gemini 'model' role to 'assistant'", () => {
      const messages = [{ role: "model", parts: [{ text: "Hello" }] }];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.role).toBe("assistant");
    });

    it("should map legacy 'function' role to 'tool'", () => {
      const messages = [{ role: "function", name: "get_weather", content: '{"temp": 20}' }];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.role).toBe("tool");
    });

    it("should use direction-based default when role is missing", () => {
      const messages = [{ content: "No role here" }];
      const inputResult = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(inputResult.messages[0]?.role).toBe("user");

      const outputResult = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(outputResult.messages[0]?.role).toBe("assistant");
    });
  });

  describe("content detection - OpenAI style", () => {
    it("should handle string content", () => {
      const messages = [{ role: "user", content: "Hello world" }];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello world" });
    });

    it("should handle array content with text parts", () => {
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: "Part 1" },
            { type: "text", text: "Part 2" },
          ],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Part 1" });
      expect(result.messages[0]?.parts[1]).toEqual({ type: "text", content: "Part 2" });
    });

    it("should handle image_url content parts", () => {
      const messages = [
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: "https://example.com/image.png" } }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "uri",
        modality: "image",
        uri: "https://example.com/image.png",
      });
    });

    it("should handle base64 data URL images", () => {
      const messages = [
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: "data:image/png;base64,abc123" } }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "blob",
        modality: "image",
        mime_type: "image/png",
        content: "abc123",
      });
    });

    it("should handle image_url as a direct data URI string", () => {
      const messages = [
        {
          role: "user",
          content: [{ type: "image_url", image_url: "data:image/jpeg;base64,/9j/4AAQ==" }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "blob",
        modality: "image",
        mime_type: "image/jpeg",
        content: "/9j/4AAQ==",
      });
    });

    it("should handle image_url as a direct URL string", () => {
      const messages = [
        {
          role: "user",
          content: [{ type: "image_url", image_url: "https://example.com/photo.jpg" }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "uri",
        modality: "image",
        uri: "https://example.com/photo.jpg",
      });
    });

    it("should handle image type with url field", () => {
      const messages = [
        {
          role: "user",
          content: [{ type: "image", url: "https://example.com/photo.png" }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "uri",
        modality: "image",
        uri: "https://example.com/photo.png",
      });
    });

    it("should handle image type with data field (base64)", () => {
      const messages = [
        {
          role: "user",
          content: [{ type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "blob",
        modality: "image",
        content: "iVBORw0KGgo=",
        mime_type: "image/png",
      });
    });

    it("should handle image type with data field as data URI", () => {
      const messages = [
        {
          role: "user",
          content: [{ type: "image", data: "data:image/webp;base64,UklGR==" }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "blob",
        modality: "image",
        mime_type: "image/webp",
        content: "UklGR==",
      });
    });

    it("should handle input_audio content parts", () => {
      const messages = [
        {
          role: "user",
          content: [{ type: "input_audio", input_audio: { data: "audiodata", format: "wav" } }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "blob",
        modality: "audio",
        mime_type: "audio/wav",
        content: "audiodata",
      });
    });
  });

  describe("file content", () => {
    it("should handle file part with data URI string", () => {
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "file",
              file: "data:text/csv;base64,bmFtZSxhZ2UsY2l0eQ==",
              mimeType: "text/csv",
            },
          ],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "blob",
        modality: "document",
        mime_type: "text/csv",
        content: "bmFtZSxhZ2UsY2l0eQ==",
      });
    });

    it("should handle file part with URL string", () => {
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "file",
              file: "https://example.com/report.pdf",
              mimeType: "application/pdf",
            },
          ],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "uri",
        modality: "document",
        uri: "https://example.com/report.pdf",
        mime_type: "application/pdf",
      });
    });

    it("should handle file part with file ID string", () => {
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "file",
              file: "file-abc123",
              mimeType: "application/pdf",
            },
          ],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "file",
        modality: "document",
        file_id: "file-abc123",
        mime_type: "application/pdf",
      });
    });

    it("should infer mime type from data URI when mimeType not provided", () => {
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "file",
              file: "data:image/png;base64,iVBORw0KGgo=",
            },
          ],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "blob",
        modality: "image",
        mime_type: "image/png",
        content: "iVBORw0KGgo=",
      });
    });

    it("should handle file part with object file field (OpenAI style)", () => {
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "file",
              file: { file_id: "file-xyz" },
              mimeType: "application/pdf",
            },
          ],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "file",
        modality: "document",
        file_id: "file-xyz",
        mime_type: "application/pdf",
      });
    });

    it("should handle document part with Anthropic base64 source", () => {
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: "pdfdata" },
            },
          ],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "blob",
        modality: "document",
        content: "pdfdata",
        mime_type: "application/pdf",
      });
    });
  });

  describe("content detection - Anthropic style", () => {
    it("should handle text blocks", () => {
      const messages = [{ role: "user", content: [{ type: "text", text: "Hello" }] }];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
    });

    it("should handle base64 image blocks", () => {
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: "imagedata" },
            },
          ],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "blob",
        modality: "image",
        content: "imagedata",
        mime_type: "image/jpeg",
      });
    });

    it("should handle URL image blocks", () => {
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: "https://example.com/image.jpg" },
            },
          ],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "uri",
        modality: "image",
        uri: "https://example.com/image.jpg",
      });
    });

    it("should handle tool_use blocks", () => {
      const messages = [
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "call_123", name: "get_weather", input: { city: "Paris" } }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "tool_call",
        id: "call_123",
        name: "get_weather",
        arguments: { city: "Paris" },
      });
    });

    it("should handle tool_result blocks", () => {
      const messages = [
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "call_123", content: '{"temp": 20}' }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "tool_call_response",
        id: "call_123",
        response: '{"temp": 20}',
      });
    });

    it("should handle thinking blocks", () => {
      const messages = [
        {
          role: "assistant",
          content: [{ type: "thinking", thinking: "Let me think about this..." }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "reasoning",
        content: "Let me think about this...",
      });
    });
  });

  describe("content detection - Google Gemini style", () => {
    it("should handle parts array with text", () => {
      const messages = [{ role: "user", parts: [{ text: "Hello from Gemini" }] }];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello from Gemini" });
    });

    it("should handle inlineData parts", () => {
      const messages = [
        {
          role: "user",
          parts: [{ inlineData: { mimeType: "image/png", data: "base64data" } }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "blob",
        modality: "image",
        content: "base64data",
        mime_type: "image/png",
      });
    });

    it("should handle fileData parts", () => {
      const messages = [
        {
          role: "user",
          parts: [{ fileData: { fileUri: "gs://bucket/file.pdf", mimeType: "application/pdf" } }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "uri",
        modality: "document",
        uri: "gs://bucket/file.pdf",
        mime_type: "application/pdf",
      });
    });

    it("should handle functionCall parts", () => {
      const messages = [
        {
          role: "model",
          parts: [{ functionCall: { name: "get_weather", args: { city: "Tokyo" } } }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "tool_call",
        id: null,
        name: "get_weather",
        arguments: { city: "Tokyo" },
      });
    });

    it("should handle functionResponse parts", () => {
      const messages = [
        {
          role: "user",
          parts: [{ functionResponse: { name: "get_weather", response: { temp: 25 } } }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      const part = result.messages[0]?.parts[0] as { type: string; id: string | null; response: unknown };
      expect(part.type).toBe("tool_call_response");
      expect(part.id).toBe(null);
      expect(part.response).toEqual({ temp: 25 });
    });

    it("should handle thought parts (reasoning)", () => {
      const messages = [
        {
          role: "model",
          parts: [{ text: "Thinking about this...", thought: true }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "reasoning",
        content: "Thinking about this...",
      });
    });
  });

  describe("tool calls at message level", () => {
    it("should handle tool_calls array (OpenAI style)", () => {
      const messages = [
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_abc",
              type: "function",
              function: { name: "get_weather", arguments: '{"city": "London"}' },
            },
          ],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "tool_call",
        id: "call_abc",
        name: "get_weather",
        arguments: { city: "London" },
      });
    });

    it("should handle toolCalls array (camelCase variant)", () => {
      const messages = [
        {
          role: "assistant",
          content: null,
          toolCalls: [{ id: "call_xyz", type: "function", function: { name: "search", arguments: '{"q": "test"}' } }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "tool_call",
        id: "call_xyz",
        name: "search",
        arguments: { q: "test" },
      });
    });

    it("should handle legacy function_call (deprecated OpenAI)", () => {
      const messages = [
        {
          role: "assistant",
          content: null,
          function_call: { name: "old_function", arguments: '{"key": "value"}' },
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "tool_call",
        id: null,
        name: "old_function",
        arguments: { key: "value" },
      });
    });
  });

  describe("tool response messages", () => {
    it("should handle OpenAI tool response", () => {
      const messages = [{ role: "tool", tool_call_id: "call_123", content: '{"result": "success"}' }];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.role).toBe("tool");
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "tool_call_response",
        id: "call_123",
        response: '{"result": "success"}',
      });
    });

    it("should handle tool response with toolId field", () => {
      const messages = [
        {
          role: "tool",
          content: [
            {
              type: "text",
              text: '{"error":"Weather API rate limit exceeded. Please try again in 60 seconds.","isError":true}',
            },
          ],
          toolId: "call_get_weather_002",
          toolName: "get_weather",
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.role).toBe("tool");
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "tool_call_response",
        id: "call_get_weather_002",
        _provider_metadata: { _known_fields: { toolName: "get_weather" } },
      });
    });

    it("should handle tool response with tool_use_id field", () => {
      const messages = [{ role: "tool", tool_use_id: "tu_456", content: "result" }];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "tool_call_response",
        id: "tu_456",
      });
    });

    it("should handle legacy function response", () => {
      const messages = [{ role: "function", name: "get_data", content: "data result" }];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.role).toBe("tool");
    });
  });

  describe("reasoning/thinking content", () => {
    it("should handle thinking field at message level (Ollama)", () => {
      const messages = [
        {
          role: "assistant",
          content: "Final answer",
          thinking: "Let me reason through this...",
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "reasoning",
        content: "Let me reason through this...",
      });
      expect(result.messages[0]?.parts[1]).toEqual({ type: "text", content: "Final answer" });
    });

    it("should handle reasoning_content field (Fireworks)", () => {
      const messages = [
        {
          role: "assistant",
          content: "Answer",
          reasoning_content: "Step by step reasoning...",
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "reasoning",
        content: "Step by step reasoning...",
      });
    });

    it("should handle reasoning type parts (VercelAI)", () => {
      const messages = [
        {
          role: "assistant",
          content: [{ type: "reasoning", text: "Thinking..." }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "reasoning",
        content: "Thinking...",
      });
    });
  });

  describe("refusal content", () => {
    it("should handle refusal field at message level", () => {
      const messages = [{ role: "assistant", refusal: "I cannot help with that" }];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      // isRefusal is stored in _known_fields for cross-provider access
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "text",
        content: "I cannot help with that",
        _provider_metadata: { _known_fields: { isRefusal: true } },
      });
    });

    it("should handle refusal type part", () => {
      const messages = [
        {
          role: "assistant",
          content: [{ type: "refusal", refusal: "Cannot do that" }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      // isRefusal is stored in _known_fields for cross-provider access
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "text",
        content: "Cannot do that",
        _provider_metadata: { _known_fields: { isRefusal: true } },
      });
    });
  });

  describe("system instructions", () => {
    it("should handle string system", () => {
      const result = CompatSpecification.toGenAI({
        messages: [],
        system: "You are a helpful assistant",
        direction: "input",
      });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "You are a helpful assistant",
      });
    });

    it("should handle object system with text field", () => {
      const result = CompatSpecification.toGenAI({
        messages: [],
        system: { text: "System instructions" },
        direction: "input",
      });
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "System instructions",
      });
    });

    it("should handle array system", () => {
      const result = CompatSpecification.toGenAI({
        messages: [],
        system: [
          { type: "text", text: "Part 1" },
          { type: "text", text: "Part 2" },
        ],
        direction: "input",
      });
      expect(result.messages[0]?.parts).toHaveLength(2);
    });
  });

  describe("field name normalization", () => {
    it("should normalize snake_case to camelCase", () => {
      const messages = [
        {
          role: "assistant",
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "test", arguments: "{}" },
            },
          ],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "tool_call",
        name: "test",
      });
    });

    it("should handle already camelCase fields", () => {
      const messages = [
        {
          role: "assistant",
          toolCalls: [{ id: "call_1", type: "function", function: { name: "test", arguments: "{}" } }],
        },
      ];
      const result = CompatSpecification.toGenAI({ messages, direction: "output" });
      expect(result.messages[0]?.parts[0]).toMatchObject({
        type: "tool_call",
        name: "test",
      });
    });
  });

  describe("fallback handling", () => {
    it("should serialize unknown objects as JSON text", () => {
      const messages = [{ role: "user", custom_field: { nested: "data" } }];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      // The content should be JSON-serialized
      const content = (result.messages[0]?.parts[0] as { content: string }).content;
      expect(JSON.parse(content)).toEqual({ role: "user", custom_field: { nested: "data" } });
    });

    it("should handle empty messages array", () => {
      const result = CompatSpecification.toGenAI({ messages: [], direction: "input" });
      expect(result.messages).toHaveLength(0);
    });

    it("should handle message with empty content array", () => {
      const messages = [{ role: "user", content: [] }];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.parts).toHaveLength(0);
    });
  });

  describe("name field preservation", () => {
    it("should preserve name field on messages", () => {
      const messages = [{ role: "user", name: "Alice", content: "Hello" }];
      const result = CompatSpecification.toGenAI({ messages, direction: "input" });
      expect(result.messages[0]?.name).toBe("Alice");
    });
  });

  describe("schema passthrough", () => {
    it("should preserve unknown fields during schema parsing", () => {
      const message = {
        role: "user",
        content: "Hello",
        custom_field: "should be preserved",
        nested: { data: "value" },
      };
      const parsed = CompatSpecification.messageSchema.safeParse(message);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toHaveProperty("custom_field", "should be preserved");
        expect(parsed.data).toHaveProperty("nested", { data: "value" });
      }
    });
  });
});
