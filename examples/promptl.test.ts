/**
 * Promptl Provider E2E Tests
 *
 * Tests translating Promptl format messages to/from GenAI using the real promptl-ai library.
 * Covers both the legacy types from the library and extended message types.
 */

import { Adapters, render } from "promptl-ai";
import { type GenAIMessage, Provider, translate } from "rosetta-ai";
import { describe, expect, it } from "vitest";

describe("Promptl E2E", () => {
  describe("real promptl library output", () => {
    it("should translate simple conversation from promptl library", async () => {
      const prompt = `
---
model: gpt-4
---

You are a helpful assistant.

<user>
  Hello!
</user>

<assistant>
  Hi there!
</assistant>
`;

      const compiled = await render({ prompt, parameters: {} });
      const result = translate(compiled.messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      // GenAI separates system messages into the `system` field
      expect(result.messages).toHaveLength(2);
      expect(result.system).toBeDefined();
      expect(Array.isArray(result.system)).toBe(true);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[1]?.role).toBe("assistant");
    });

    it("should auto-infer Promptl provider", async () => {
      const prompt = `
<user>
  Hello!
</user>
`;

      const compiled = await render({ prompt, parameters: {} });
      // No 'from' specified - should auto-detect Promptl
      const result = translate(compiled.messages);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe("user");
    });

    it("should translate dynamic prompt with variables", async () => {
      const prompt = `
---
model: gpt-4
---

You specialize in {{ region }}.

<user>
  What are the top {{ count }} places in {{ city }}?
</user>
`;

      const compiled = await render({
        prompt,
        parameters: { region: "Europe", city: "Paris", count: 3 },
      });
      const result = translate(compiled.messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.system).toBeDefined();

      const systemContent = (result.system?.[0] as { content: string })?.content;
      expect(systemContent).toContain("Europe");

      const userContent = (result.messages[0]?.parts[0] as { content: string })?.content;
      expect(userContent).toContain("Paris");
      expect(userContent).toContain("3");
    });

    it("should round-trip translate GenAI → Promptl → GenAI", () => {
      const original: GenAIMessage[] = [
        { role: "user", parts: [{ type: "text", content: "What is AI?" }] },
        { role: "assistant", parts: [{ type: "text", content: "AI is artificial intelligence." }] },
      ];

      const toPromptl = translate(original, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });
      expect(toPromptl.messages).toHaveLength(2);
      expect(toPromptl.messages[0]?.role).toBe("user");

      const backToGenAI = translate(toPromptl.messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });
      expect(backToGenAI.messages[0]?.role).toBe("user");
      expect((backToGenAI.messages[0]?.parts[0] as { content: string })?.content).toBe("What is AI?");
    });
  });

  describe("source map preservation", () => {
    it("should preserve source maps from real promptl library through round-trip", async () => {
      const prompt = `
<user>
  Hello {{ name }}, welcome to {{ city }}!
</user>
`;

      // Render with includeSourceMap and default adapter to get source maps
      const compiled = await render({
        prompt,
        parameters: { name: "Alice", city: "Paris" },
        includeSourceMap: true,
        adapter: Adapters.default,
      });

      // Verify source maps are present in the original promptl output
      const originalContent = compiled.messages[0]?.content as Array<{
        _promptlSourceMap?: Array<{ start: number; end: number; identifier?: string }>;
      }>;
      const originalWithMaps = originalContent.filter((c) => c._promptlSourceMap && c._promptlSourceMap.length > 0);
      expect(originalWithMaps.length).toBeGreaterThan(0);

      // Verify the source map structure from the library
      const originalSourceMap = originalWithMaps[0]?._promptlSourceMap;
      expect(originalSourceMap).toBeDefined();
      expect(originalSourceMap?.some((ref) => ref.identifier === "name")).toBe(true);
      expect(originalSourceMap?.some((ref) => ref.identifier === "city")).toBe(true);

      // Convert to GenAI
      const toGenAI = translate(compiled.messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      // Verify source maps are preserved in GenAI metadata
      const genAIPart = toGenAI.messages[0]?.parts.find(
        (p) => p._provider_metadata?.promptl && "_promptlSourceMap" in (p._provider_metadata.promptl as object),
      );
      expect(genAIPart).toBeDefined();

      // Convert back to Promptl
      const backToPromptl = translate(toGenAI.messages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      // Verify source maps are restored in Promptl format
      const restoredContent = backToPromptl.messages[0]?.content as Array<{
        _promptlSourceMap?: Array<{ start: number; end: number; identifier?: string }>;
      }>;
      const restoredWithMaps = restoredContent.filter((c) => c._promptlSourceMap && c._promptlSourceMap.length > 0);
      expect(restoredWithMaps.length).toBe(originalWithMaps.length);

      // The source maps should exactly match the original
      expect(restoredWithMaps[0]?._promptlSourceMap).toEqual(originalWithMaps[0]?._promptlSourceMap);
    });

    it("should preserve source maps with multiple parameters from real library", async () => {
      const prompt = `
<user>
  The {{ adjective }} {{ animal }} jumped over the {{ object }}.
</user>
`;

      const compiled = await render({
        prompt,
        parameters: { adjective: "quick", animal: "fox", object: "fence" },
        includeSourceMap: true,
        adapter: Adapters.default,
      });

      // Convert through GenAI and back
      const toGenAI = translate(compiled.messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });
      const backToPromptl = translate(toGenAI.messages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      // Extract source maps from original and restored
      const originalContent = compiled.messages[0]?.content as Array<{
        _promptlSourceMap?: Array<{ start: number; end: number; identifier?: string }>;
      }>;
      const restoredContent = backToPromptl.messages[0]?.content as Array<{
        _promptlSourceMap?: Array<{ start: number; end: number; identifier?: string }>;
      }>;

      // Get content parts with source maps
      const originalWithMaps = originalContent.filter((c) => c._promptlSourceMap && c._promptlSourceMap.length > 0);
      const restoredWithMaps = restoredContent.filter((c) => c._promptlSourceMap && c._promptlSourceMap.length > 0);

      expect(restoredWithMaps.length).toBe(originalWithMaps.length);
      expect(restoredWithMaps.length).toBeGreaterThan(0);

      // Verify all parameter identifiers are preserved
      const originalIdentifiers = originalWithMaps
        .flatMap((c) => c._promptlSourceMap ?? [])
        .map((ref) => ref.identifier)
        .filter(Boolean);
      const restoredIdentifiers = restoredWithMaps
        .flatMap((c) => c._promptlSourceMap ?? [])
        .map((ref) => ref.identifier)
        .filter(Boolean);

      expect(restoredIdentifiers).toEqual(originalIdentifiers);
      expect(originalIdentifiers).toContain("adjective");
      expect(originalIdentifiers).toContain("animal");
      expect(originalIdentifiers).toContain("object");
    });

    it("should preserve source map structure (start, end, identifier) from real library", async () => {
      const prompt = `
<user>
  Hello {{ name }}!
</user>
`;

      const compiled = await render({
        prompt,
        parameters: { name: "World" },
        includeSourceMap: true,
        adapter: Adapters.default,
      });

      // Find a content part with source map
      const originalContent = compiled.messages[0]?.content as Array<{
        _promptlSourceMap?: Array<{ start: number; end: number; identifier?: string }>;
      }>;
      const partWithMap = originalContent.find((c) => c._promptlSourceMap && c._promptlSourceMap.length > 0);
      expect(partWithMap?._promptlSourceMap).toBeDefined();

      const originalMap = partWithMap?._promptlSourceMap?.[0];
      expect(originalMap).toBeDefined();
      expect(typeof originalMap?.start).toBe("number");
      expect(typeof originalMap?.end).toBe("number");
      expect(originalMap?.identifier).toBe("name");

      // Round-trip
      const toGenAI = translate(compiled.messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });
      const backToPromptl = translate(toGenAI.messages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      // Verify structure is preserved
      const restoredContent = backToPromptl.messages[0]?.content as Array<{
        _promptlSourceMap?: Array<{ start: number; end: number; identifier?: string }>;
      }>;
      const restoredPartWithMap = restoredContent.find((c) => c._promptlSourceMap && c._promptlSourceMap.length > 0);
      expect(restoredPartWithMap?._promptlSourceMap).toBeDefined();

      const restoredMap = restoredPartWithMap?._promptlSourceMap?.[0];
      expect(restoredMap).toBeDefined();
      expect(restoredMap?.start).toBe(originalMap?.start);
      expect(restoredMap?.end).toBe(originalMap?.end);
      expect(restoredMap?.identifier).toBe(originalMap?.identifier);
    });

    it("should preserve source maps in system messages from real library", async () => {
      const prompt = `
---
model: gpt-4
---

You are a {{ role }} assistant specializing in {{ domain }}.

<user>
  Help me with something.
</user>
`;

      const compiled = await render({
        prompt,
        parameters: { role: "helpful", domain: "coding" },
        includeSourceMap: true,
        adapter: Adapters.default,
      });

      // Find system message
      const systemMessage = compiled.messages.find((m) => m.role === "system");
      expect(systemMessage).toBeDefined();

      // Handle both string and array content from promptl
      type SourceMapContent = Array<{ _promptlSourceMap?: Array<{ start: number; end: number; identifier?: string }> }>;
      const systemContent: SourceMapContent =
        typeof systemMessage?.content === "string" ? [] : ((systemMessage?.content as SourceMapContent) ?? []);

      const hasSourceMaps = systemContent.some((c) => c._promptlSourceMap && c._promptlSourceMap.length > 0);
      expect(hasSourceMaps).toBe(true);

      // Translate to GenAI - system messages are extracted to a separate field
      const toGenAI = translate(compiled.messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });
      expect(toGenAI.system).toBeDefined();

      // Verify source map is preserved in GenAI system parts
      const systemPartWithMap = toGenAI.system?.find(
        (p) => p._provider_metadata?.promptl && "_promptlSourceMap" in (p._provider_metadata.promptl as object),
      );
      expect(systemPartWithMap).toBeDefined();

      // Translate back with system included
      const backToPromptl = translate(toGenAI.messages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
        system: toGenAI.system,
      });

      // Find the restored system message
      const restoredSystemMessage = backToPromptl.messages.find((m) => m.role === "system");
      expect(restoredSystemMessage).toBeDefined();

      // Verify source maps are restored
      const restoredSystemContent = (restoredSystemMessage?.content ?? []) as SourceMapContent;
      const restoredHasSourceMaps = restoredSystemContent.some(
        (c) => c._promptlSourceMap && c._promptlSourceMap.length > 0,
      );
      expect(restoredHasSourceMaps).toBe(true);

      // Verify identifiers are preserved
      const restoredIdentifiers = restoredSystemContent
        .flatMap((c) => c._promptlSourceMap ?? [])
        .map((ref) => ref.identifier)
        .filter(Boolean);
      expect(restoredIdentifiers).toContain("role");
      expect(restoredIdentifiers).toContain("domain");
    });
  });

  describe("legacy toolArguments field", () => {
    it("should translate tool-call with legacy toolArguments field", () => {
      const messages = [
        {
          role: "assistant" as const,
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "call-123",
              toolName: "get_weather",
              toolArguments: { city: "Paris" },
            },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      const part = result.messages[0]?.parts[0];
      expect(part?.type).toBe("tool_call");
      expect((part as { name: string }).name).toBe("get_weather");
      expect((part as { arguments: Record<string, unknown> }).arguments).toEqual({ city: "Paris" });
    });
  });

  describe("new args field", () => {
    it("should translate tool-call with new args field", () => {
      const messages = [
        {
          role: "assistant" as const,
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "call-456",
              toolName: "search",
              args: { query: "test" },
            },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect((result.messages[0]?.parts[0] as { arguments: Record<string, unknown> }).arguments).toEqual({
        query: "test",
      });
    });

    it("should prefer args over toolArguments when both present", () => {
      const messages = [
        {
          role: "assistant" as const,
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "call-789",
              toolName: "test",
              args: { new: "value" },
              toolArguments: { old: "value" },
            },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect((result.messages[0]?.parts[0] as { arguments: Record<string, unknown> }).arguments).toEqual({
        new: "value",
      });
    });
  });

  describe("legacy tool message format", () => {
    it("should translate legacy tool message with toolName/toolId at message level", () => {
      const messages = [
        {
          role: "tool" as const,
          toolName: "get_weather",
          toolId: "call-123",
          content: [{ type: "text" as const, text: "Sunny, 22°C" }],
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.role).toBe("tool");
      const part = result.messages[0]?.parts[0];
      expect(part?.type).toBe("tool_call_response");
      expect((part as { id: string }).id).toBe("call-123");
      expect((part as { response: string }).response).toBe("Sunny, 22°C");
    });
  });

  describe("new tool-result content format", () => {
    it("should translate tool-result content to tool_call_response", () => {
      const messages = [
        {
          role: "tool" as const,
          content: [
            {
              type: "tool-result" as const,
              toolCallId: "call-new",
              toolName: "calculator",
              result: { answer: 42 },
              isError: false,
            },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]?.type).toBe("tool_call_response");
      expect((result.messages[0]?.parts[0] as { response: unknown }).response).toEqual({ answer: 42 });
    });
  });

  describe("reasoning content", () => {
    it("should translate reasoning content", () => {
      const messages = [
        {
          role: "assistant" as const,
          content: [
            {
              type: "reasoning" as const,
              text: "Let me think about this step by step...",
              id: "reasoning-1",
              isStreaming: false,
            },
            { type: "text" as const, text: "The answer is 42." },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts).toHaveLength(2);
      expect(result.messages[0]?.parts[0]?.type).toBe("reasoning");
      expect((result.messages[0]?.parts[0] as { content: string }).content).toBe(
        "Let me think about this step by step...",
      );
      expect(result.messages[0]?.parts[1]?.type).toBe("text");
    });
  });

  describe("redacted reasoning content", () => {
    it("should translate redacted-reasoning content to reasoning with originalType in metadata", () => {
      const messages = [
        {
          role: "assistant" as const,
          content: [
            {
              type: "redacted-reasoning" as const,
              data: "encrypted-reasoning-data-xyz",
            },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      // redacted-reasoning maps to reasoning (closest GenAI equivalent) with originalType at root level
      expect(result.messages[0]?.parts[0]?.type).toBe("reasoning");
      expect((result.messages[0]?.parts[0] as { content: string }).content).toBe("encrypted-reasoning-data-xyz");
      // originalType is stored at root level for cross-provider access
      expect(result.messages[0]?.parts[0]?._provider_metadata?.originalType).toBe("redacted-reasoning");
    });
  });

  describe("assistant message with string content", () => {
    it("should translate assistant message with string content", () => {
      const messages = [
        {
          role: "assistant" as const,
          content: "This is a simple string response.",
          toolCalls: null,
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect((result.messages[0]?.parts[0] as { content: string }).content).toBe("This is a simple string response.");
    });
  });

  describe("toolCalls array in assistant message", () => {
    it("should translate toolCalls array to additional tool_call parts", () => {
      const messages = [
        {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "Let me look that up." }],
          toolCalls: [
            { id: "call-a", name: "search", arguments: { q: "weather" } },
            { id: "call-b", name: "get_location", arguments: {} },
          ],
        },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages[0]?.parts).toHaveLength(3);
      expect(result.messages[0]?.parts[0]?.type).toBe("text");
      expect(result.messages[0]?.parts[1]?.type).toBe("tool_call");
      expect(result.messages[0]?.parts[2]?.type).toBe("tool_call");
      expect((result.messages[0]?.parts[1] as { id: string }).id).toBe("call-a");
      expect((result.messages[0]?.parts[2] as { id: string }).id).toBe("call-b");
    });
  });

  describe("round-trip with extended types", () => {
    it("should preserve extended types through round-trip", () => {
      const original: GenAIMessage[] = [
        {
          role: "assistant",
          parts: [
            { type: "reasoning", content: "Thinking..." },
            { type: "text", content: "Here is my answer." },
            { type: "tool_call", id: "call-rt", name: "helper", arguments: { x: 1 } },
          ],
        },
      ];

      const toPromptl = translate(original, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });
      const backToGenAI = translate(toPromptl.messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(backToGenAI.messages[0]?.parts[0]?.type).toBe("reasoning");
      expect((backToGenAI.messages[0]?.parts[0] as { content: string }).content).toBe("Thinking...");
      expect(backToGenAI.messages[0]?.parts[1]?.type).toBe("text");
      expect(backToGenAI.messages[0]?.parts[2]?.type).toBe("tool_call");
    });
  });

  describe("backwards compatibility", () => {
    it("should output both args and toolArguments when converting from GenAI", () => {
      const messages: GenAIMessage[] = [
        {
          role: "assistant",
          parts: [{ type: "tool_call", id: "call-bc", name: "test", arguments: { key: "value" } }],
        },
      ];

      const result = translate(messages, {
        from: Provider.GenAI,
        to: Provider.Promptl,
      });

      const toolCall = result.messages[0]?.content[0] as {
        args?: Record<string, unknown>;
        toolArguments?: Record<string, unknown>;
      };
      expect(toolCall.args).toEqual({ key: "value" });
      expect(toolCall.toolArguments).toEqual({ key: "value" });
    });
  });

  describe("system message handling", () => {
    it("should extract system messages to separate system field", () => {
      const messages = [
        { role: "system" as const, content: [{ type: "text" as const, text: "You are a helpful bot." }] },
        { role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] },
      ];

      const result = translate(messages, {
        from: Provider.Promptl,
        to: Provider.GenAI,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.system).toBeDefined();
      expect((result.system?.[0] as { content: string })?.content).toBe("You are a helpful bot.");
      expect(result.messages[0]?.role).toBe("user");
    });
  });
});
