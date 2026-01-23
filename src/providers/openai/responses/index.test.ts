/**
 * OpenAI Responses Provider Tests
 *
 * Unit tests for the OpenAI Responses API message format conversion.
 */

import { describe, expect, it } from "vitest";
import { OpenAIResponsesSpecification } from "$package/providers/openai/responses";

const Spec = OpenAIResponsesSpecification;

describe("OpenAIResponsesSpecification", () => {
  describe("string messages", () => {
    it("should convert string to user message for input direction", () => {
      const result = Spec.toGenAI({ messages: "Hello", direction: "input" });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
    });

    it("should convert string to assistant message for output direction", () => {
      const result = Spec.toGenAI({ messages: "Response", direction: "output" });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Response" });
    });
  });

  describe("message items with text content", () => {
    it("should convert message with string content", () => {
      const result = Spec.toGenAI({
        messages: [{ role: "user", content: "Hello world" }],
        direction: "input",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello world" });
    });

    it("should convert message with input_text content", () => {
      const result = Spec.toGenAI({
        messages: [{ role: "user", content: [{ type: "input_text", text: "Hello" }] }],
        direction: "input",
      });

      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello" });
    });

    it("should convert message with output_text content", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            type: "message",
            id: "msg_123",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: "Hello back" }],
          } as never,
        ],
        direction: "output",
      });

      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello back" });
    });

    it("should preserve output_text annotations in metadata", () => {
      const annotations = [
        { type: "url_citation", start_index: 0, end_index: 5, url: "https://example.com", title: "Example" },
      ];
      const result = Spec.toGenAI({
        messages: [
          {
            type: "message",
            id: "msg_123",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: "Hello", annotations }],
          } as never,
        ],
        direction: "output",
      });

      expect(result.messages[0]?.parts[0]?._provider_metadata?.openai_responses).toEqual({ annotations });
    });

    it("should handle all roles", () => {
      const roles = ["user", "assistant", "system", "developer"] as const;
      for (const role of roles) {
        const result = Spec.toGenAI({
          messages: [{ role, content: "Test" }],
          direction: "input",
        });
        expect(result.messages[0]?.role).toBe(role);
      }
    });
  });

  describe("message items with multimodal content", () => {
    it("should convert input_image with URL to uri part", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            role: "user",
            content: [{ type: "input_image", detail: "high", image_url: "https://example.com/image.jpg" }],
          },
        ],
        direction: "input",
      });

      const part = result.messages[0]?.parts[0];
      expect(part?.type).toBe("uri");
      expect((part as { uri: string }).uri).toBe("https://example.com/image.jpg");
      expect(part?._provider_metadata?.openai_responses).toEqual({ detail: "high" });
    });

    it("should convert input_image with base64 data URL to blob part", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            role: "user",
            content: [{ type: "input_image", detail: "auto", image_url: "data:image/png;base64,iVBORw0KGgo=" }],
          },
        ],
        direction: "input",
      });

      const part = result.messages[0]?.parts[0];
      expect(part?.type).toBe("blob");
      expect((part as { modality: string }).modality).toBe("image");
      expect((part as { mime_type: string }).mime_type).toBe("image/png");
      expect((part as { content: string }).content).toBe("iVBORw0KGgo=");
    });

    it("should convert input_image with file_id to file part", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            role: "user",
            content: [{ type: "input_image", detail: "low", file_id: "file-abc123" }],
          },
        ],
        direction: "input",
      });

      const part = result.messages[0]?.parts[0];
      expect(part?.type).toBe("file");
      expect((part as { file_id: string }).file_id).toBe("file-abc123");
    });

    it("should convert input_file with file_data to blob part", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            role: "user",
            content: [{ type: "input_file", file_data: "SGVsbG8gV29ybGQ=", filename: "hello.txt" } as never],
          },
        ],
        direction: "input",
      });

      const part = result.messages[0]?.parts[0];
      expect(part?.type).toBe("blob");
      expect((part as { modality: string }).modality).toBe("document");
      expect((part as { content: string }).content).toBe("SGVsbG8gV29ybGQ=");
      expect(part?._provider_metadata?.openai_responses).toEqual({ filename: "hello.txt" });
    });

    it("should convert input_file with file_id to file part", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            role: "user",
            content: [{ type: "input_file", file_id: "file-xyz789" }],
          },
        ],
        direction: "input",
      });

      const part = result.messages[0]?.parts[0];
      expect(part?.type).toBe("file");
      expect((part as { file_id: string }).file_id).toBe("file-xyz789");
    });

    it("should convert input_audio to blob part", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            role: "user",
            content: [{ type: "input_audio", data: "audio_base64_data", format: "wav" }],
          },
        ],
        direction: "input",
      });

      const part = result.messages[0]?.parts[0];
      expect(part?.type).toBe("blob");
      expect((part as { modality: string }).modality).toBe("audio");
      expect((part as { mime_type: string }).mime_type).toBe("audio/wav");
      expect((part as { content: string }).content).toBe("audio_base64_data");
    });

    it("should convert input_audio mp3 format", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            role: "user",
            content: [{ type: "input_audio", data: "mp3_data", format: "mp3" }],
          },
        ],
        direction: "input",
      });

      const part = result.messages[0]?.parts[0];
      expect((part as { mime_type: string }).mime_type).toBe("audio/mp3");
    });
  });

  describe("refusal handling", () => {
    it("should convert refusal to text part with isRefusal metadata", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            type: "message",
            id: "msg_123",
            role: "assistant",
            status: "completed",
            content: [{ type: "refusal", refusal: "I cannot help with that." }],
          } as never,
        ],
        direction: "output",
      });

      const part = result.messages[0]?.parts[0];
      expect(part?.type).toBe("text");
      expect((part as { content: string }).content).toBe("I cannot help with that.");
      expect(part?._provider_metadata?.openai_responses).toEqual({ isRefusal: true });
    });
  });

  describe("function_call items", () => {
    it("should convert function_call to assistant message with tool_call part", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            type: "function_call",
            call_id: "call_abc123",
            name: "get_weather",
            arguments: '{"location":"Paris"}',
          },
        ],
        direction: "output",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");

      const part = result.messages[0]?.parts[0];
      expect(part?.type).toBe("tool_call");
      expect((part as { id: string }).id).toBe("call_abc123");
      expect((part as { name: string }).name).toBe("get_weather");
      expect((part as { arguments: unknown }).arguments).toEqual({ location: "Paris" });
    });

    it("should preserve unparseable arguments as string", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            type: "function_call",
            call_id: "call_123",
            name: "test",
            arguments: "invalid json",
          },
        ],
        direction: "output",
      });

      const part = result.messages[0]?.parts[0];
      expect((part as { arguments: unknown }).arguments).toBe("invalid json");
    });

    it("should preserve extra fields in metadata", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            type: "function_call",
            call_id: "call_123",
            name: "test",
            arguments: "{}",
            id: "item_456",
            status: "completed",
            extra_field: "preserved",
          } as never,
        ],
        direction: "output",
      });

      const part = result.messages[0]?.parts[0];
      // id, status, and extra_field are all captured since only type, call_id, name, arguments are used for translation
      expect(part?._provider_metadata?.openai_responses).toEqual({
        id: "item_456",
        status: "completed",
        extra_field: "preserved",
      });
    });
  });

  describe("function_call_output items", () => {
    it("should convert function_call_output to tool message with tool_call_response part", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            type: "function_call_output",
            call_id: "call_abc123",
            output: '{"temperature":22}',
          },
        ],
        direction: "input",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("tool");

      const part = result.messages[0]?.parts[0];
      expect(part?.type).toBe("tool_call_response");
      expect((part as { id: string }).id).toBe("call_abc123");
      expect((part as { response: unknown }).response).toEqual({ temperature: 22 });
    });

    it("should preserve unparseable output as string", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            type: "function_call_output",
            call_id: "call_123",
            output: "plain text result",
          },
        ],
        direction: "input",
      });

      const part = result.messages[0]?.parts[0];
      expect((part as { response: unknown }).response).toBe("plain text result");
    });
  });

  describe("reasoning items", () => {
    it("should convert reasoning item to assistant message with reasoning parts", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            type: "reasoning",
            id: "reasoning_123",
            summary: [
              { text: "First thought", type: "summary_text" },
              { text: "Second thought", type: "summary_text" },
            ],
          } as never,
        ],
        direction: "output",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts).toHaveLength(2);

      expect(result.messages[0]?.parts[0]?.type).toBe("reasoning");
      expect((result.messages[0]?.parts[0] as { content: string }).content).toBe("First thought");
      expect(result.messages[0]?.parts[1]?.type).toBe("reasoning");
      expect((result.messages[0]?.parts[1] as { content: string }).content).toBe("Second thought");
    });

    it("should preserve encrypted_content in metadata", () => {
      const result = Spec.toGenAI({
        messages: [
          {
            type: "reasoning",
            id: "reasoning_123",
            summary: [{ text: "Thought", type: "summary_text" }],
            encrypted_content: "encrypted_data_here",
          } as never,
        ],
        direction: "output",
      });

      const part = result.messages[0]?.parts[0];
      // Both id and encrypted_content are now captured as extra fields (not in schema)
      expect(part?._provider_metadata?.openai_responses).toEqual({
        id: "reasoning_123",
        encrypted_content: "encrypted_data_here",
      });
    });
  });

  describe("passthrough items (generic parts)", () => {
    it("should convert file_search_call to generic part", () => {
      const item = {
        type: "file_search_call",
        id: "fs_123",
        queries: ["search query"],
        status: "completed",
        results: [{ file_id: "file_1", filename: "doc.pdf", text: "result text" }],
      };

      const result = Spec.toGenAI({
        messages: [item as never],
        direction: "output",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]?.type).toBe("file_search_call");
      expect(result.messages[0]?.parts[0]?._provider_metadata?.openai_responses).toEqual(item);
    });

    it("should convert web_search_call to generic part", () => {
      const item = {
        type: "web_search_call",
        id: "ws_123",
        status: "completed",
      };

      const result = Spec.toGenAI({
        messages: [item as never],
        direction: "output",
      });

      expect(result.messages[0]?.parts[0]?.type).toBe("web_search_call");
      expect(result.messages[0]?.parts[0]?._provider_metadata?.openai_responses).toEqual(item);
    });

    it("should convert computer_call to generic part with assistant role", () => {
      const item = {
        type: "computer_call",
        id: "cc_123",
        call_id: "call_456",
        action: { type: "click", x: 100, y: 200, button: "left" },
        status: "completed",
        pending_safety_checks: [],
      };

      const result = Spec.toGenAI({
        messages: [item as never],
        direction: "output",
      });

      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]?.type).toBe("computer_call");
    });

    it("should convert computer_call_output to generic part with tool role", () => {
      const item = {
        type: "computer_call_output",
        id: "cco_123",
        call_id: "call_456",
        output: { type: "computer_screenshot", image_url: "https://example.com/screenshot.png" },
      };

      const result = Spec.toGenAI({
        messages: [item as never],
        direction: "input",
      });

      expect(result.messages[0]?.role).toBe("tool");
      expect(result.messages[0]?.parts[0]?.type).toBe("computer_call_output");
    });

    it("should convert code_interpreter_call to generic part", () => {
      const item = {
        type: "code_interpreter_call",
        id: "ci_123",
        code: "print('hello')",
        results: [{ type: "logs", logs: "hello" }],
        status: "completed",
      };

      const result = Spec.toGenAI({
        messages: [item as never],
        direction: "output",
      });

      expect(result.messages[0]?.parts[0]?.type).toBe("code_interpreter_call");
    });

    it("should convert mcp_call to generic part", () => {
      const item = {
        type: "mcp_call",
        id: "mcp_123",
        name: "tool_name",
        arguments: "{}",
        server_label: "my_server",
      };

      const result = Spec.toGenAI({
        messages: [item as never],
        direction: "output",
      });

      expect(result.messages[0]?.parts[0]?.type).toBe("mcp_call");
    });
  });

  describe("mixed conversation", () => {
    it("should convert a full conversation with multiple item types", () => {
      const result = Spec.toGenAI({
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "What's the weather in Tokyo?" },
          {
            type: "function_call",
            call_id: "call_1",
            name: "get_weather",
            arguments: '{"location":"Tokyo"}',
          },
          {
            type: "function_call_output",
            call_id: "call_1",
            output: '{"temp":25,"condition":"sunny"}',
          },
          {
            type: "message",
            id: "msg_1",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: "The weather in Tokyo is 25°C and sunny." }],
          } as never,
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

  describe("schema passthrough - unknown fields preserved during parsing", () => {
    it("should preserve unknown fields on message items during schema parsing", () => {
      const message = {
        role: "user" as const,
        content: "Hello",
        future_api_field: "preserved",
        nested_data: { key: "value" },
      };

      const result = Spec.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("future_api_field", "preserved");
        expect(result.data).toHaveProperty("nested_data", { key: "value" });
      }
    });

    it("should preserve unknown fields on function_call items during schema parsing", () => {
      const item = {
        type: "function_call" as const,
        call_id: "call_123",
        name: "test",
        arguments: "{}",
        new_status_field: "pending",
      };

      const result = Spec.messageSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("new_status_field", "pending");
      }
    });

    it("should preserve unknown fields on content parts during schema parsing", () => {
      const message = {
        role: "user" as const,
        content: [
          {
            type: "input_text" as const,
            text: "Hello",
            new_field: "value",
          },
        ],
      };

      const result = Spec.messageSchema.safeParse(message);
      expect(result.success).toBe(true);
      if (result.success) {
        const parsed = result.data as { content: Array<{ new_field?: string }> };
        expect(parsed.content[0]).toHaveProperty("new_field", "value");
      }
    });

    it("should preserve unknown fields on reasoning items during schema parsing", () => {
      const item = {
        type: "reasoning" as const,
        id: "r_123",
        summary: [{ text: "thought", type: "summary_text" as const }],
        new_reasoning_field: "value",
      };

      const result = Spec.messageSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("new_reasoning_field", "value");
      }
    });
  });
});
