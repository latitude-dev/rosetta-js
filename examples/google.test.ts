/**
 * Google Gemini Provider E2E Tests
 *
 * Tests translating Google Gemini GenerateContent API format messages to GenAI.
 * Includes both hardcoded messages and real API calls (when GEMINI_API_KEY is set).
 * This is a source-only provider, so only toGenAI translations are tested.
 */

import { FunctionCallingConfigMode, GoogleGenAI, Type } from "@google/genai";
import { Provider, translate } from "rosetta-ai";
import { describe, expect, it } from "vitest";

const hasApiKey = !!process.env.GEMINI_API_KEY;

describe("Google Gemini E2E", () => {
  describe.skipIf(!hasApiKey)("real Gemini API calls", { timeout: 60000 }, () => {
    // biome-ignore lint/style/noNonNullAssertion: API key is checked by skipIf condition
    const getClient = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    it("should translate a real Gemini response", async () => {
      const ai = getClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "What is 2+2? Reply in one word.",
      });

      // Get the response content
      const candidate = response.candidates?.[0];
      const content = candidate?.content;

      expect(content).toBeDefined();
      if (!content) return;

      const result = translate([content], {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
    });

    it("should translate a conversation with system instruction", async () => {
      const ai = getClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        config: {
          systemInstruction: "You are a helpful assistant. Reply in exactly 3 words.",
        },
        contents: [{ role: "user", parts: [{ text: "Say hello" }] }],
      });

      const candidate = response.candidates?.[0];
      const content = candidate?.content;

      expect(content).toBeDefined();
      if (!content) return;

      const result = translate([content], {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
    });

    it("should translate function calls from real API", async () => {
      const ai = getClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: "What's the weather in Paris?" }] }],
        config: {
          tools: [
            {
              functionDeclarations: [
                {
                  name: "get_weather",
                  description: "Get the current weather for a location",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      location: { type: Type.STRING, description: "The city name" },
                    },
                    required: ["location"],
                  },
                },
              ],
            },
          ],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY,
            },
          },
        },
      });

      const candidate = response.candidates?.[0];
      const content = candidate?.content;

      expect(content).toBeDefined();
      if (!content) return;

      const result = translate([content], {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");

      const toolCallPart = result.messages[0]?.parts.find((p) => p.type === "tool_call");
      expect(toolCallPart).toBeDefined();
      expect((toolCallPart as { name: string }).name).toBe("get_weather");
    });

    it("should translate a multi-turn conversation", async () => {
      const ai = getClient();
      // First turn
      const response1 = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: "My name is Alice." }] }],
      });

      const content1 = response1.candidates?.[0]?.content;
      expect(content1).toBeDefined();
      if (!content1) return;

      // Second turn
      const response2 = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { role: "user", parts: [{ text: "My name is Alice." }] },
          content1,
          { role: "user", parts: [{ text: "What is my name?" }] },
        ],
      });

      const content2 = response2.candidates?.[0]?.content;
      expect(content2).toBeDefined();
      if (!content2) return;

      // Translate the full conversation
      const fullConversation = [
        { role: "user", parts: [{ text: "My name is Alice." }] },
        content1,
        { role: "user", parts: [{ text: "What is my name?" }] },
        content2,
      ];

      const result = translate(fullConversation, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(4);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[2]?.role).toBe("user");
      expect(result.messages[3]?.role).toBe("assistant");
    });

    it("should translate real API response to Promptl format", async () => {
      const ai = getClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "Reply with exactly: Hello World",
      });

      const content = response.candidates?.[0]?.content;
      expect(content).toBeDefined();
      if (!content) return;

      const result = translate([content], {
        from: Provider.Google,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
    });
  });

  describe("hardcoded messages (no API key required)", () => {
    it("should translate simple Gemini messages to GenAI", () => {
      const geminiMessages = [
        { role: "user", parts: [{ text: "What is the capital of France?" }] },
        { role: "model", parts: [{ text: "The capital of France is Paris." }] },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should translate with system parameter", () => {
      const geminiMessages = [{ role: "user", parts: [{ text: "Hello" }] }];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
        system: "You are a helpful assistant.",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.system).toBeDefined();
      expect(result.system?.[0]).toMatchObject({ type: "text", content: "You are a helpful assistant." });
    });

    it("should translate model messages to assistant role", () => {
      const geminiMessages = [{ role: "model", parts: [{ text: "Hello! How can I help you today?" }] }];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]).toEqual({
        type: "text",
        content: "Hello! How can I help you today?",
      });
    });

    it("should translate function calls", () => {
      const geminiMessages = [
        { role: "user", parts: [{ text: "What's the weather in London?" }] },
        {
          role: "model",
          parts: [
            {
              functionCall: {
                name: "get_weather",
                args: { location: "London", unit: "celsius" },
              },
            },
          ],
        },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.parts[0]?.type).toBe("tool_call");
      const toolCallPart = result.messages[1]?.parts[0] as { name: string; arguments: unknown };
      expect(toolCallPart.name).toBe("get_weather");
      expect(toolCallPart.arguments).toEqual({ location: "London", unit: "celsius" });
    });

    it("should translate function responses", () => {
      const geminiMessages = [
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "get_weather",
                response: { temperature: 15, condition: "cloudy" },
              },
            },
          ],
        },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
      const responsePart = result.messages[0]?.parts[0] as { response: unknown };
      expect(responsePart.response).toEqual({ temperature: 15, condition: "cloudy" });
    });

    it("should translate function call and response round-trip", () => {
      const geminiMessages = [
        { role: "user", parts: [{ text: "What's the weather?" }] },
        {
          role: "model",
          parts: [{ functionCall: { name: "get_weather", args: { city: "NYC" } } }],
        },
        {
          role: "user",
          parts: [{ functionResponse: { name: "get_weather", response: { temp: 72 } } }],
        },
        { role: "model", parts: [{ text: "The temperature is 72°F." }] },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(4);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
      expect(result.messages[1]?.parts[0]?.type).toBe("tool_call");
      expect(result.messages[2]?.role).toBe("user");
      expect(result.messages[2]?.parts[0]?.type).toBe("tool_call_response");
      expect(result.messages[3]?.role).toBe("assistant");
    });

    it("should translate thinking/thought content", () => {
      const geminiMessages = [
        {
          role: "model",
          parts: [{ text: "Let me think about this...", thought: true }, { text: "Here's my answer." }],
        },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]?.type).toBe("reasoning");
      expect((result.messages[0]?.parts[0] as { content: string }).content).toBe("Let me think about this...");
      expect(result.messages[0]?.parts[1]?.type).toBe("text");
    });

    it("should translate inline image data", () => {
      const geminiMessages = [
        {
          role: "user",
          parts: [
            { text: "What's in this image?" },
            {
              inlineData: {
                mimeType: "image/png",
                data: "iVBORw0KGgoAAAANSUhEUg...",
              },
            },
          ],
        },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect(result.messages[0]?.parts[1]?.type).toBe("blob");
      expect((result.messages[0]?.parts[1] as { modality: string }).modality).toBe("image");
    });

    it("should translate file data references", () => {
      const geminiMessages = [
        {
          role: "user",
          parts: [
            { text: "Summarize this video" },
            {
              fileData: {
                mimeType: "video/mp4",
                fileUri: "gs://my-bucket/video.mp4",
              },
            },
          ],
        },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[1]?.type).toBe("uri");
      expect((result.messages[0]?.parts[1] as { modality: string }).modality).toBe("video");
      expect((result.messages[0]?.parts[1] as { uri: string }).uri).toBe("gs://my-bucket/video.mp4");
    });

    it("should translate executable code", () => {
      const geminiMessages = [
        {
          role: "model",
          parts: [
            {
              executableCode: {
                language: "PYTHON",
                code: "print('Hello, world!')",
              },
            },
          ],
        },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts[0]?.type).toBe("executable_code");
      // biome-ignore lint/suspicious/noExplicitAny: GenAI generic part types need cast
      expect((result.messages[0]?.parts[0] as any).code).toBe("print('Hello, world!')");
    });

    it("should translate code execution results", () => {
      const geminiMessages = [
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
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.parts[0]?.type).toBe("code_execution_result");
      // biome-ignore lint/suspicious/noExplicitAny: GenAI generic part types need cast
      expect((result.messages[0]?.parts[0] as any).output).toBe("Hello, world!");
    });

    it("should auto-detect Google format", () => {
      const geminiMessages = [
        { role: "user", parts: [{ text: "Hello" }] },
        { role: "model", parts: [{ text: "Hi there!" }] },
      ];

      // No explicit 'from' - should auto-infer
      const result = translate(geminiMessages);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should translate Google to Promptl via GenAI", () => {
      const geminiMessages = [
        { role: "user", parts: [{ text: "Hello!" }] },
        { role: "model", parts: [{ text: "Hi there!" }] },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.Promptl,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should preserve extra fields in metadata", () => {
      const geminiMessages = [
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
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      // Extra fields are now at root level of _provider_metadata
      expect(result.messages[0]?.parts[0]?._provider_metadata).toMatchObject({
        displayName: "test.png",
      });
    });

    it("should handle messages without role", () => {
      const geminiMessages = [{ parts: [{ text: "Hello" }] }];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
        direction: "input",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
    });

    it("should not auto-infer Google for non-Google messages (inference fix)", () => {
      // Messages without 'parts' field should NOT match Google format
      const openaiMessages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" },
      ];

      // Without specifying 'from', these should NOT be inferred as Google
      const result = translate(openaiMessages);

      // The key assertion: messages should have actual text content, not empty
      // parts with everything stuffed into _provider_metadata
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect((result.messages[0]?.parts[0] as { content: string }).content).toBe("Hello");
    });

    it("should handle multiple parts in single message", () => {
      const geminiMessages = [
        {
          role: "user",
          parts: [
            { text: "Check this image:" },
            { inlineData: { mimeType: "image/png", data: "base64data" } },
            { text: "What do you see?" },
          ],
        },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts).toHaveLength(3);
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect(result.messages[0]?.parts[1]?.type).toBe("blob");
      expect(result.messages[0]?.parts[2]?.type).toBe("text");
    });

    it("should translate string input through Google conversion pipeline", () => {
      const result = translate("Hello from Gemini", {
        from: Provider.Google,
        to: Provider.GenAI,
        direction: "input",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Hello from Gemini" });
    });

    it("should translate string output with model->assistant role mapping", () => {
      const result = translate("Model response", {
        from: Provider.Google,
        to: Provider.GenAI,
        direction: "output",
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("assistant");
      expect(result.messages[0]?.parts[0]).toEqual({ type: "text", content: "Model response" });
    });

    it("should translate function call without args", () => {
      const geminiMessages = [
        {
          role: "model",
          parts: [{ functionCall: { name: "get_status" } }],
        },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call");
      // biome-ignore lint/suspicious/noExplicitAny: testing tool_call fields
      const toolCall = result.messages[0]?.parts[0] as any;
      expect(toolCall.name).toBe("get_status");
      expect(toolCall.arguments).toBeUndefined();
    });

    it("should detect error in function response and set isError known field", () => {
      const geminiMessages = [
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "get_weather",
                response: { error: "API rate limit exceeded" },
              },
            },
          ],
        },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
      // biome-ignore lint/suspicious/noExplicitAny: checking metadata known fields
      const knownFields = (result.messages[0]?.parts[0]?._provider_metadata as any)?._known_fields;
      expect(knownFields?.isError).toBe(true);
      expect(knownFields?.toolName).toBe("get_weather");
    });

    it("should preserve FunctionResponse extra fields in metadata", () => {
      const geminiMessages = [
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: "stream_data",
                response: { status: "ok" },
                willContinue: true,
                scheduling: "WHEN_IDLE",
              },
            },
          ],
        },
      ];

      const result = translate(geminiMessages, {
        from: Provider.Google,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
      const metadata = result.messages[0]?.parts[0]?._provider_metadata;
      expect(metadata).toBeDefined();
      expect(metadata).toMatchObject({
        willContinue: true,
        scheduling: "WHEN_IDLE",
      });
    });

    it("should reject non-Google messages when from is Google", () => {
      const openaiMessages = [{ role: "user", content: "Hello" }];

      expect(() =>
        translate(openaiMessages, {
          from: Provider.Google,
          to: Provider.GenAI,
        }),
      ).toThrow();
    });
  });
});
