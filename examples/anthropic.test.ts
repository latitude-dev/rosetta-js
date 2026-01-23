/**
 * Anthropic Provider E2E Tests
 *
 * Tests translating Anthropic Messages API format messages to GenAI.
 * Includes both hardcoded messages and real API calls (when ANTHROPIC_API_KEY is set).
 * This is a source-only provider, so only toGenAI translations are tested.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Provider, translate } from "rosetta-ai";
import { describe, expect, it } from "vitest";

const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

describe("Anthropic E2E", () => {
  describe.skipIf(!hasApiKey)("real Anthropic API calls", { timeout: 30000 }, () => {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    it("should translate a real Anthropic message response", async () => {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 50,
        messages: [{ role: "user", content: "What is 2+2? Reply in one word." }],
      });

      // Translate the response message (Message output format)
      const result = translate([message], {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect(result.messages[0]?.finish_reason).toBe("stop");
    });

    it("should translate a conversation with system prompt", async () => {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 50,
        system: "You are a helpful assistant. Reply in exactly 3 words.",
        messages: [{ role: "user", content: "Say hello" }],
      });

      // Build full conversation including system
      const result = translate([message], {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
    });

    it("should translate tool calls from real API", async () => {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [{ role: "user", content: "What's the weather in Paris?" }],
        tools: [
          {
            name: "get_weather",
            description: "Get the current weather for a location",
            input_schema: {
              type: "object" as const,
              properties: {
                location: { type: "string", description: "The city name" },
              },
              required: ["location"],
            },
          },
        ],
        tool_choice: { type: "any" },
      });

      expect(message.stop_reason).toBe("tool_use");

      const result = translate([message], {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.finish_reason).toBe("tool_call");

      const toolCallPart = result.messages[0]?.parts.find((p) => p.type === "tool_call");
      expect(toolCallPart).toBeDefined();
      expect((toolCallPart as { name: string }).name).toBe("get_weather");
    });

    it("should translate tool call and response round-trip", async () => {
      // Step 1: Get a tool call from Anthropic
      const message1 = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
        tools: [
          {
            name: "get_weather",
            description: "Get the current weather",
            input_schema: {
              type: "object" as const,
              properties: {
                location: { type: "string" },
              },
              required: ["location"],
            },
          },
        ],
        tool_choice: { type: "any" },
      });

      const toolUseBlock = message1.content.find((b) => b.type === "tool_use");
      expect(toolUseBlock).toBeDefined();
      if (!toolUseBlock || toolUseBlock.type !== "tool_use") throw new Error("No tool use block");

      // Step 2: Build the tool result and get final response
      const message2 = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [
          { role: "user", content: "What's the weather in Tokyo?" },
          { role: "assistant", content: message1.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUseBlock.id,
                content: JSON.stringify({ temperature: 22, condition: "sunny" }),
              },
            ],
          },
        ],
        tools: [
          {
            name: "get_weather",
            description: "Get the current weather",
            input_schema: {
              type: "object" as const,
              properties: { location: { type: "string" } },
              required: ["location"],
            },
          },
        ],
      });

      // Build full conversation
      const fullConversation = [
        { role: "user" as const, content: "What's the weather in Tokyo?" },
        { role: "assistant" as const, content: message1.content },
        {
          role: "user" as const,
          content: [
            {
              type: "tool_result" as const,
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify({ temperature: 22, condition: "sunny" }),
            },
          ],
        },
        message2,
      ];

      const result = translate(fullConversation, {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(4);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.parts.some((p) => p.type === "tool_call")).toBe(true);
      expect(result.messages[2]?.role).toBe("user");
      expect(result.messages[2]?.parts[0]?.type).toBe("tool_call_response");
      expect(result.messages[3]?.role).toBe("assistant");
    });

    it("should translate real API response to Promptl format", async () => {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "Reply with exactly: Hello World" }],
      });

      const result = translate([message], {
        from: Provider.Anthropic,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
    });
  });

  describe("hardcoded messages (no API key required)", () => {
    it("should translate simple Anthropic messages to GenAI", () => {
      const anthropicMessages = [
        { role: "user" as const, content: "What is the capital of France?" },
        { role: "assistant" as const, content: "The capital of France is Paris." },
      ];

      const result = translate(anthropicMessages, {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should translate with system parameter", () => {
      const anthropicMessages = [{ role: "user" as const, content: "Hello" }];

      const result = translate(anthropicMessages, {
        from: Provider.Anthropic,
        to: Provider.GenAI,
        system: "You are a helpful assistant.",
      });

      // System is extracted to the separate system field when translating to GenAI
      expect(result.messages).toHaveLength(1);
      expect(result.system).toBeDefined();
      expect(result.system?.[0]).toMatchObject({ type: "text", content: "You are a helpful assistant." });
      expect(result.messages[0]?.role).toBe("user");
    });

    it("should translate Message output format", () => {
      const anthropicMessage = {
        id: "msg_abc123",
        type: "message" as const,
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "Hello! How can I help you today?" }],
        model: "claude-sonnet-4-20250514",
        stop_reason: "end_turn" as const,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 12 },
      };

      const result = translate([anthropicMessage], {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "Hello! How can I help you today?",
      });
      expect(result.messages[0]?.finish_reason).toBe("stop");
    });

    it("should translate assistant message with tool use", () => {
      const anthropicMessages = [
        { role: "user" as const, content: "What's the weather in London?" },
        {
          role: "assistant" as const,
          content: [
            {
              type: "tool_use" as const,
              id: "toolu_abc123",
              name: "get_weather",
              input: { location: "London", unit: "celsius" },
            },
          ],
        },
        {
          role: "user" as const,
          content: [
            {
              type: "tool_result" as const,
              tool_use_id: "toolu_abc123",
              content: '{"temperature":15,"condition":"cloudy"}',
            },
          ],
        },
        { role: "assistant" as const, content: "The weather in London is 15°C and cloudy." },
      ];

      const result = translate(anthropicMessages, {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(4);

      // Check tool call message
      const toolCallMsg = result.messages[1];
      expect(toolCallMsg?.role).toBe("assistant");
      expect(toolCallMsg?.parts[0]?.type).toBe("tool_call");
      const toolCallPart = toolCallMsg?.parts[0] as { name: string; arguments: unknown };
      expect(toolCallPart.name).toBe("get_weather");
      expect(toolCallPart.arguments).toEqual({ location: "London", unit: "celsius" });

      // Check tool response message
      const toolResponseMsg = result.messages[2];
      expect(toolResponseMsg?.role).toBe("user");
      expect(toolResponseMsg?.parts[0]?.type).toBe("tool_call_response");
    });

    it("should translate thinking blocks (extended thinking)", () => {
      const anthropicMessages = [
        {
          role: "assistant" as const,
          content: [
            {
              type: "thinking" as const,
              thinking: "Let me think about this step by step...",
              signature: "sig_abc123",
            },
            { type: "text" as const, text: "Here's my answer." },
          ],
        },
      ];

      const result = translate(anthropicMessages, {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]?.type).toBe("reasoning");
      expect((result.messages[0]?.parts[0] as { content: string }).content).toBe(
        "Let me think about this step by step...",
      );
      expect(result.messages[0]?.parts[1]?.type).toBe("text");
    });

    it("should translate image content (base64)", () => {
      const anthropicMessages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "What's in this image?" },
            {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: "image/png" as const,
                data: "iVBORw0KGgoAAAANSUhEUg...",
              },
            },
          ],
        },
      ];

      const result = translate(anthropicMessages, {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect(result.messages[0]?.parts[1]?.type).toBe("blob");
      expect((result.messages[0]?.parts[1] as { modality: string }).modality).toBe("image");
    });

    it("should translate image content (URL)", () => {
      const anthropicMessages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "What's in this image?" },
            {
              type: "image" as const,
              source: {
                type: "url" as const,
                url: "https://example.com/cat.jpg",
              },
            },
          ],
        },
      ];

      const result = translate(anthropicMessages, {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[1]?.type).toBe("uri");
      expect((result.messages[0]?.parts[1] as { uri: string }).uri).toBe("https://example.com/cat.jpg");
    });

    it("should translate PDF document content", () => {
      const anthropicMessages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "Summarize this document" },
            {
              type: "document" as const,
              source: {
                type: "base64" as const,
                media_type: "application/pdf" as const,
                data: "JVBERi0xLjQK...",
              },
            },
          ],
        },
      ];

      const result = translate(anthropicMessages, {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[1]?.type).toBe("blob");
      expect((result.messages[0]?.parts[1] as { modality: string }).modality).toBe("document");
      expect((result.messages[0]?.parts[1] as { mime_type: string }).mime_type).toBe("application/pdf");
    });

    it("should auto-detect Anthropic format", () => {
      const anthropicMessages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" },
      ];

      // No explicit 'from' - should auto-infer
      const result = translate(anthropicMessages);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should translate Anthropic to Promptl via GenAI", () => {
      const anthropicMessages = [
        { role: "user" as const, content: "Hello!" },
        { role: "assistant" as const, content: "Hi there!" },
      ];

      const result = translate(anthropicMessages, {
        from: Provider.Anthropic,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should preserve cache_control in metadata", () => {
      const anthropicMessages = [
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: "Important context to cache",
              cache_control: { type: "ephemeral" as const },
            },
          ],
        },
      ];

      const result = translate(anthropicMessages, {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]?._provider_metadata?.anthropic).toMatchObject({
        cache_control: { type: "ephemeral" },
      });
    });

    it("should handle tool result with is_error flag", () => {
      const anthropicMessages = [
        {
          role: "user" as const,
          content: [
            {
              type: "tool_result" as const,
              tool_use_id: "toolu_abc123",
              content: "Error: API rate limit exceeded",
              is_error: true,
            },
          ],
        },
      ];

      const result = translate(anthropicMessages, {
        from: Provider.Anthropic,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]?._provider_metadata?.anthropic).toMatchObject({
        is_error: true,
      });
    });
  });
});
