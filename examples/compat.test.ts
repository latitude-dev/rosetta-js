/**
 * Compat Provider E2E Tests
 *
 * Tests the Compat provider's ability to translate various LLM message formats
 * to GenAI. These tests verify the fallback behavior works correctly for
 * formats that don't match any specific provider schema.
 */

import { Provider, translate } from "rosetta-ai";
import { describe, expect, it } from "vitest";

describe("Compat E2E", () => {
  describe("auto-detection fallback", () => {
    it("should fall back to Compat for unknown message format", () => {
      // A format that doesn't match any specific provider
      const messages = [
        {
          sender: "human",
          text: "Hello there",
          timestamp: 1234567890,
        },
      ];

      // Without specifying 'from', should use Compat as fallback
      const result = translate(messages, { to: Provider.GenAI });

      expect(result.messages).toHaveLength(1);
      // Since there's no 'role' field, direction default will be used
      expect(result.messages[0]?.role).toBe("user");
    });

    it("should explicitly use Compat provider", () => {
      const messages = [{ role: "user", content: "Test message" }];

      const result = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "Test message",
      });
    });
  });

  describe("Cohere-style messages", () => {
    it("should handle Cohere message format", () => {
      // Cohere uses standard role/content format
      const messages = [
        { role: "user", content: "Tell me about LLMs" },
        {
          role: "assistant",
          content: "Large Language Models are...",
        },
      ];

      const result = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });
  });

  describe("Ollama-style messages", () => {
    it("should handle Ollama message with thinking field", () => {
      const messages = [
        {
          role: "assistant",
          content: "The answer is 42",
          thinking: "Let me calculate step by step...",
        },
      ];

      const result = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts).toHaveLength(2);
      // Reasoning should come first
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "reasoning",
        content: "Let me calculate step by step...",
      });
      expect(result.messages[0]?.parts[1]).toEqual({
        type: "text",
        content: "The answer is 42",
      });
    });
  });

  describe("AWS Bedrock Converse-style messages", () => {
    it("should handle Bedrock ContentBlock format", () => {
      const messages = [
        {
          role: "user",
          content: [{ text: "What is the weather?" }],
        },
        {
          role: "assistant",
          content: [
            {
              toolUse: {
                toolUseId: "tool_123",
                name: "get_weather",
                input: { location: "Seattle" },
              },
            },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "What is the weather?",
      });

      // The toolUse should be detected as a generic part since it's not a standard format
      const toolPart = result.messages[1]?.parts[0] as Record<string, unknown>;
      expect(toolPart.type).toBe("unknown");
    });
  });

  describe("Together AI style messages", () => {
    it("should handle Together AI response with reasoning field", () => {
      const messages = [
        {
          role: "assistant",
          content: "The result is X",
          reasoning: "First I considered A, then B...",
        },
      ];

      const result = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]).toEqual({
        type: "reasoning",
        content: "First I considered A, then B...",
      });
    });
  });

  describe("Fireworks AI style messages", () => {
    it("should handle Fireworks response with reasoning_content", () => {
      const messages = [
        {
          role: "assistant",
          content: "Here's my answer",
          reasoning_content: "Step 1: ... Step 2: ...",
        },
      ];

      const result = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]).toEqual({
        type: "reasoning",
        content: "Step 1: ... Step 2: ...",
      });
    });
  });

  describe("custom/proprietary formats", () => {
    it("should handle completely custom message format", () => {
      const messages = [
        {
          role: "user",
          payload: {
            message: "Hello",
            attachments: [],
          },
        },
      ];

      const result = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      // Should serialize the unknown structure
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
    });

    it("should handle messages with mixed known and unknown fields", () => {
      const messages = [
        {
          role: "assistant",
          content: "Response text",
          custom_metadata: { source: "api", version: "2.0" },
          internal_id: "msg_12345",
        },
      ];

      const result = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "Response text",
      });
    });
  });

  describe("mixed-provider conversations", () => {
    it("should handle conversation with various message styles", () => {
      const messages = [
        // Standard format
        { role: "system", content: "You are helpful" },
        // OpenAI style with tool call
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "search", arguments: '{"q": "weather"}' },
            },
          ],
        },
        // Tool response
        { role: "tool", tool_call_id: "call_1", content: '{"temp": 20}' },
        // Simple response
        { role: "assistant", content: "The temperature is 20°C" },
      ];

      const result = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
      });

      // GenAI's fromGenAI separates system messages into result.system
      expect(result.messages).toHaveLength(3); // Non-system messages
      expect(result.system).toBeDefined();
      expect(result.system?.[0]).toEqual({ type: "text", content: "You are helpful" });

      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call");
      expect(result.messages[1]?.parts[0]?.type).toBe("tool_call_response");
      expect(result.messages[2]?.parts[0]?.type).toBe("text");
    });
  });

  describe("system instructions", () => {
    it("should handle system instructions with Compat provider", () => {
      const result = translate([], {
        from: Provider.Compat,
        to: Provider.GenAI,
        system: "You are a helpful assistant specialized in coding.",
      });

      // GenAI's fromGenAI separates system into result.system
      expect(result.messages).toHaveLength(0);
      expect(result.system).toBeDefined();
      expect(result.system).toHaveLength(1);
      expect(result.system?.[0]).toEqual({
        type: "text",
        content: "You are a helpful assistant specialized in coding.",
      });
    });

    it("should handle object system instructions", () => {
      const result = translate([], {
        from: Provider.Compat,
        to: Provider.GenAI,
        system: { text: "System prompt here" },
      });

      // GenAI's fromGenAI separates system into result.system
      expect(result.system).toBeDefined();
      expect(result.system?.[0]).toEqual({
        type: "text",
        content: "System prompt here",
      });
    });
  });

  describe("multimodal content", () => {
    it("should handle various image formats", () => {
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image" },
            { type: "image_url", image_url: { url: "https://example.com/img.png" } },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "Describe this image",
      });
      expect(result.messages[0]?.parts[1]).toEqual({
        type: "uri",
        modality: "image",
        uri: "https://example.com/img.png",
      });
    });
  });

  describe("direction parameter", () => {
    it("should use direction for role inference when role is missing", () => {
      const messages = [{ content: "Some content without role" }];

      const inputResult = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
        direction: "input",
      });
      expect(inputResult.messages[0]?.role).toBe("user");

      const outputResult = translate(messages, {
        from: Provider.Compat,
        to: Provider.GenAI,
        direction: "output",
      });
      expect(outputResult.messages[0]?.role).toBe("assistant");
    });
  });
});
