/**
 * Provider Inference Tests
 *
 * Tests that inferProvider correctly identifies each provider's message format.
 * Each provider test uses a full conversation: system + user + assistant (text + tool calls) + tool response.
 */

import { describe, expect, it } from "vitest";
import { Provider } from "$package/providers";
import { DEFAULT_INFER_PRIORITY, inferProvider } from "./index";

describe("inferProvider", () => {
  describe("GenAI conversation", () => {
    const messages = [
      {
        role: "system",
        parts: [{ type: "text", content: "You are a helpful assistant." }],
      },
      {
        role: "user",
        parts: [{ type: "text", content: "What's the weather in NYC?" }],
      },
      {
        role: "assistant",
        parts: [
          { type: "text", content: "Let me check the weather for you." },
          { type: "tool_call", id: "tc_1", name: "get_weather", arguments: { city: "NYC" } },
        ],
      },
      {
        role: "tool",
        parts: [{ type: "tool_call_response", id: "tc_1", response: { temperature: "72°F", condition: "sunny" } }],
      },
    ];

    it("should infer GenAI provider", () => {
      expect(inferProvider(messages)).toBe(Provider.GenAI);
    });
  });

  describe("Promptl conversation", () => {
    // Promptl system messages support array content, unlike VercelAI (string only).
    // This distinguishes Promptl from VercelAI which is higher in inference priority.
    const messages = [
      {
        role: "system" as const,
        content: [{ type: "text" as const, text: "You are a helpful assistant." }],
      },
      {
        role: "user" as const,
        content: "What's the weather in NYC?",
      },
      {
        role: "assistant" as const,
        content: [
          { type: "text" as const, text: "Let me check the weather for you." },
          { type: "tool-call" as const, toolCallId: "tc_1", toolName: "get_weather", args: { city: "NYC" } },
        ],
      },
      {
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: "tc_1",
            toolName: "get_weather",
            result: { temperature: "72°F" },
          },
        ],
      },
    ];

    it("should infer Promptl provider", () => {
      expect(inferProvider(messages)).toBe(Provider.Promptl);
    });
  });

  describe("OpenAI Completions conversation", () => {
    const messages = [
      {
        role: "system" as const,
        content: "You are a helpful assistant.",
      },
      {
        role: "user" as const,
        content: "What's the weather in NYC?",
      },
      {
        role: "assistant" as const,
        content: "Let me check the weather for you.",
        tool_calls: [
          {
            id: "call_1",
            type: "function" as const,
            function: { name: "get_weather", arguments: '{"city":"NYC"}' },
          },
        ],
      },
      {
        role: "tool" as const,
        content: '{"temperature":"72°F","condition":"sunny"}',
        tool_call_id: "call_1",
      },
    ];

    it("should infer OpenAI Completions provider", () => {
      expect(inferProvider(messages)).toBe(Provider.OpenAICompletions);
    });
  });

  describe("OpenAI Responses conversation", () => {
    // OpenAI Responses uses flat items with a `type` field to distinguish item kinds.
    // function_call and function_call_output are top-level items, not nested in messages.
    const messages = [
      { type: "message", role: "system" as const, content: "You are a helpful assistant." },
      { type: "message", role: "user" as const, content: "What's the weather in NYC?" },
      {
        type: "message",
        role: "assistant" as const,
        content: [{ type: "output_text", text: "Let me check the weather for you." }],
      },
      { type: "function_call", call_id: "fc_1", name: "get_weather", arguments: '{"city":"NYC"}' },
      { type: "function_call_output", call_id: "fc_1", output: '{"temperature":"72°F","condition":"sunny"}' },
    ];

    it("should infer OpenAI Responses provider", () => {
      expect(inferProvider(messages)).toBe(Provider.OpenAIResponses);
    });
  });

  describe("Anthropic conversation", () => {
    // Anthropic embeds system instructions separately (not in messages array).
    // Only "user" and "assistant" roles are used in messages.
    // Tool results go inside user messages as tool_result content blocks.
    const messages = [
      {
        role: "user" as const,
        content: "What's the weather in NYC?",
      },
      {
        role: "assistant" as const,
        content: [
          { type: "text", text: "Let me check the weather for you." },
          { type: "tool_use", id: "tu_1", name: "get_weather", input: { city: "NYC" } },
        ],
      },
      {
        role: "user" as const,
        content: [
          {
            type: "tool_result",
            tool_use_id: "tu_1",
            content: '{"temperature":"72°F","condition":"sunny"}',
          },
        ],
      },
    ];

    const system = "You are a helpful assistant.";

    it("should infer Anthropic provider from messages alone", () => {
      expect(inferProvider(messages)).toBe(Provider.Anthropic);
    });

    it("should infer Anthropic provider from messages with separate system", () => {
      expect(inferProvider(messages, system)).toBe(Provider.Anthropic);
    });
  });

  describe("Google conversation", () => {
    // Google uses "model" instead of "assistant" and a flat parts structure
    // with named fields (text, functionCall, functionResponse) instead of type discriminators.
    // System instructions are separate from messages.
    const messages = [
      {
        role: "user",
        parts: [{ text: "What's the weather in NYC?" }],
      },
      {
        role: "model",
        parts: [
          { text: "Let me check the weather for you." },
          { functionCall: { name: "get_weather", args: { city: "NYC" } } },
        ],
      },
      {
        role: "user",
        parts: [{ functionResponse: { name: "get_weather", response: { temperature: "72°F", condition: "sunny" } } }],
      },
    ];

    const system = { role: "user", parts: [{ text: "You are a helpful assistant." }] };

    it("should infer Google provider from messages alone", () => {
      expect(inferProvider(messages)).toBe(Provider.Google);
    });

    it("should infer Google provider from messages with separate system", () => {
      expect(inferProvider(messages, system)).toBe(Provider.Google);
    });
  });

  describe("VercelAI conversation", () => {
    const messages = [
      {
        role: "system" as const,
        content: "You are a helpful assistant.",
      },
      {
        role: "user" as const,
        content: "What's the weather in NYC?",
      },
      {
        role: "assistant" as const,
        content: [
          { type: "text" as const, text: "Let me check the weather for you." },
          { type: "tool-call" as const, toolCallId: "tc_1", toolName: "get_weather", input: { city: "NYC" } },
        ],
      },
      {
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: "tc_1",
            toolName: "get_weather",
            result: { temperature: "72°F" },
          },
        ],
      },
    ];

    it("should infer VercelAI provider", () => {
      expect(inferProvider(messages)).toBe(Provider.VercelAI);
    });
  });

  describe("unknown message schemas (Compat fallback)", () => {
    it("should fall back to Compat for messages with no standard fields", () => {
      const messages = [
        { sender: "human", message: "Hello" },
        { sender: "bot", message: "Hi there!" },
      ];
      expect(inferProvider(messages)).toBe(Provider.Compat);
    });

    it("should fall back to Compat for messages with non-standard structure", () => {
      const messages = [
        { from: "user", text: "What's the weather?", timestamp: 1234567890 },
        { from: "assistant", text: "It's sunny!", metadata: { model: "custom-v1" } },
      ];
      expect(inferProvider(messages)).toBe(Provider.Compat);
    });

    it("should fall back to Compat for completely arbitrary objects", () => {
      const messages = [{ foo: "bar", baz: 123, nested: { deep: true } }];
      expect(inferProvider(messages)).toBe(Provider.Compat);
    });

    it("should fall back to Compat for messages with content but no role or type", () => {
      const messages = [
        { content: "System prompt", kind: "system" },
        { content: "User question", kind: "user" },
        { content: "Assistant answer", kind: "assistant" },
      ];
      expect(inferProvider(messages)).toBe(Provider.Compat);
    });

    it("should fall back to Compat for empty messages array with no system", () => {
      expect(inferProvider([])).toBe(Provider.Compat);
    });
  });

  describe("string messages", () => {
    it("should return first priority provider for string messages", () => {
      expect(inferProvider("Hello, how are you?")).toBe(Provider.OpenAICompletions);
    });

    it("should return custom first priority for string messages", () => {
      const priority = [Provider.GenAI, Provider.Promptl];
      expect(inferProvider("Hello", undefined, priority)).toBe(Provider.GenAI);
    });
  });

  describe("system-only inference", () => {
    it("should return first priority for string system with empty messages", () => {
      expect(inferProvider([], "You are helpful")).toBe(Provider.OpenAICompletions);
    });

    it("should infer from structured system when messages are empty", () => {
      const system = [{ type: "text", content: "You are a helpful assistant." }];
      expect(inferProvider([], system)).toBe(Provider.GenAI);
    });
  });

  describe("DEFAULT_INFER_PRIORITY", () => {
    it("should contain all providers", () => {
      const allProviders = Object.values(Provider);
      for (const provider of allProviders) {
        expect(DEFAULT_INFER_PRIORITY).toContain(provider);
      }
    });

    it("should have Compat as the last provider", () => {
      expect(DEFAULT_INFER_PRIORITY[DEFAULT_INFER_PRIORITY.length - 1]).toBe(Provider.Compat);
    });

    it("should check more specific providers before generic ones", () => {
      const oaiCompIdx = DEFAULT_INFER_PRIORITY.indexOf(Provider.OpenAICompletions);
      const compatIdx = DEFAULT_INFER_PRIORITY.indexOf(Provider.Compat);
      const genaiIdx = DEFAULT_INFER_PRIORITY.indexOf(Provider.GenAI);
      const promptlIdx = DEFAULT_INFER_PRIORITY.indexOf(Provider.Promptl);

      // More specific providers should come before generic ones
      expect(oaiCompIdx).toBeLessThan(compatIdx);
      expect(genaiIdx).toBeLessThan(promptlIdx);
      expect(promptlIdx).toBeLessThan(compatIdx);
    });
  });

  describe("custom priority", () => {
    it("should respect custom priority when multiple providers match", () => {
      // Simple text messages match both VercelAI and OpenAI Completions
      const messages = [
        { role: "system" as const, content: "Hello" },
        { role: "user" as const, content: "Hi" },
      ];

      // Default: OpenAI Completions wins (higher priority)
      expect(inferProvider(messages)).toBe(Provider.OpenAICompletions);

      // Custom: VercelAI first
      expect(inferProvider(messages, undefined, [Provider.VercelAI, Provider.OpenAICompletions])).toBe(
        Provider.VercelAI,
      );
    });

    it("should fall back to Compat when custom priority has no matching providers", () => {
      const messages = [{ sender: "human", text: "Hello" }];

      // Even with specific providers in priority, unknown schema falls through
      expect(inferProvider(messages, undefined, [Provider.GenAI, Provider.Anthropic, Provider.Compat])).toBe(
        Provider.Compat,
      );
    });
  });
});
