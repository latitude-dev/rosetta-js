/**
 * GenAI Provider E2E Tests
 *
 * Tests translating GenAI format messages. Since GenAI is the intermediate
 * format, translations to other providers are tested here.
 */

import { type GenAIMessage, Provider, translate } from "rosetta-ai";
import { describe, expect, it } from "vitest";

describe("GenAI E2E", () => {
  const genAIMessages: GenAIMessage[] = [
    {
      role: "system",
      parts: [{ type: "text", content: "You are a helpful assistant." }],
    },
    {
      role: "user",
      parts: [{ type: "text", content: "Hello, how are you?" }],
    },
    {
      role: "assistant",
      parts: [{ type: "text", content: "I'm doing great, thanks for asking!" }],
    },
    {
      role: "user",
      parts: [
        { type: "text", content: "Can you help me with this image?" },
        { type: "uri", modality: "image", uri: "https://example.com/image.png" },
      ],
    },
  ];

  describe("identity translation", () => {
    it("should translate GenAI to GenAI (identity)", () => {
      const result = translate(genAIMessages, {
        from: Provider.GenAI,
        to: Provider.GenAI,
      });

      // System is extracted to separate field
      expect(result.messages).toHaveLength(3);
      expect(result.system).toBeDefined();
      expect(result.messages[0]?.role).toBe("user");
    });

    it("should auto-infer GenAI provider", () => {
      const result = translate(genAIMessages);

      expect(result.messages).toHaveLength(3);
      expect(result.system).toBeDefined();
      expect(result.messages[0]?.role).toBe("user");
    });
  });

  describe("GenAI to Promptl", () => {
    it("should translate GenAI to Promptl", () => {
      const result = translate(genAIMessages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(4);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[1]?.role).toBe("user");
      expect(result.messages[2]?.role).toBe("assistant");
    });

    it("should convert multimodal content", () => {
      const result = translate(genAIMessages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      // Last message should have image content
      const lastMessage = result.messages[3];
      expect(lastMessage?.content).toHaveLength(2);
      expect((lastMessage?.content[0] as { type: string }).type).toBe("text");
      expect((lastMessage?.content[1] as { type: string }).type).toBe("image");
    });
  });

  describe("tool calls", () => {
    const messagesWithToolCall: GenAIMessage[] = [
      {
        role: "user",
        parts: [{ type: "text", content: "What's the weather in London?" }],
      },
      {
        role: "assistant",
        parts: [
          {
            type: "tool_call",
            id: "call_123",
            name: "get_weather",
            arguments: { location: "London", unit: "celsius" },
          },
        ],
      },
      {
        role: "tool",
        parts: [
          {
            type: "tool_call_response",
            id: "call_123",
            response: { temperature: 15, condition: "cloudy" },
          },
        ],
      },
      {
        role: "assistant",
        parts: [{ type: "text", content: "The weather in London is 15°C and cloudy." }],
      },
    ];

    it("should translate tool calls to Promptl", () => {
      const result = translate(messagesWithToolCall, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(4);

      // Check tool call message
      const toolCallMsg = result.messages[1];
      expect(toolCallMsg?.role).toBe("assistant");
      expect((toolCallMsg?.content[0] as { type: string }).type).toBe("tool-call");

      // Check tool response message
      const toolResponseMsg = result.messages[2];
      expect(toolResponseMsg?.role).toBe("tool");
    });

    it("should auto-infer with tool call messages", () => {
      const result = translate(messagesWithToolCall);

      expect(result.messages).toHaveLength(4);
      expect(result.messages.map((m) => m.role)).toEqual(["user", "assistant", "tool", "assistant"]);
    });
  });

  describe("reasoning parts", () => {
    const messagesWithReasoning: GenAIMessage[] = [
      {
        role: "user",
        parts: [{ type: "text", content: "What is 2 + 2?" }],
      },
      {
        role: "assistant",
        parts: [
          { type: "reasoning", content: "The user is asking for a basic arithmetic calculation." },
          { type: "text", content: "2 + 2 equals 4." },
        ],
      },
    ];

    it("should translate reasoning parts to Promptl", () => {
      const result = translate(messagesWithReasoning, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(2);

      const assistantMsg = result.messages[1];
      expect(assistantMsg?.content).toHaveLength(2);
      expect((assistantMsg?.content[0] as { type: string }).type).toBe("reasoning");
      expect((assistantMsg?.content[1] as { type: string }).type).toBe("text");
    });
  });

  describe("string input convenience", () => {
    it("should convert string input to user message", () => {
      const result = translate("Hello, world!");

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect((result.messages[0]?.parts[0] as { content: string }).content).toBe("Hello, world!");
    });

    it("should convert string input to assistant message for output direction", () => {
      const result = translate("Hello, world!", { direction: "output" });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
    });
  });

  describe("round-trip translations", () => {
    it("should round-trip GenAI → Promptl → GenAI", () => {
      const original: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi there!" }] },
      ];

      const toPromptl = translate(original, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });
      const backToGenAI = translate(toPromptl.messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(backToGenAI.messages).toHaveLength(2);
      expect(backToGenAI.messages[0]?.role).toBe("user");
      expect((backToGenAI.messages[0]?.parts[0] as { content: string }).content).toBe("Hello");
    });
  });
});
