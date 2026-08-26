/**
 * Utils module tests
 */

import { describe, expect, it } from "vitest";
import type { GenAIMessage } from "$package/core/genai";
import { adaptUnsupportedParts, binaryToBase64, inferModality } from "$package/utils";

describe("binaryToBase64", () => {
  it("should convert a small Uint8Array to base64", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(binaryToBase64(bytes)).toBe("SGVsbG8=");
  });

  it("should convert an empty Uint8Array to empty string", () => {
    const bytes = new Uint8Array([]);
    expect(binaryToBase64(bytes)).toBe("");
  });

  it("should convert an ArrayBuffer to base64", () => {
    const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer;
    expect(binaryToBase64(buffer)).toBe("SGVsbG8=");
  });

  it("should convert a single byte", () => {
    const bytes = new Uint8Array([65]); // "A"
    expect(binaryToBase64(bytes)).toBe("QQ==");
  });

  it("should handle data just under one chunk (8192 bytes)", () => {
    const size = 8191;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i % 256;
    const result = binaryToBase64(bytes);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("should handle data exactly one chunk (8192 bytes)", () => {
    const size = 8192;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i % 256;
    const result = binaryToBase64(bytes);
    expect(result).toBeTruthy();
  });

  it("should handle data spanning multiple chunks", () => {
    const size = 8192 * 3 + 100;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i % 256;
    const result = binaryToBase64(bytes);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("should not crash with large binary data (1MB - simulates image)", () => {
    const size = 1_000_000;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i % 256;
    const result = binaryToBase64(bytes);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("should not crash with very large binary data (5MB - simulates high-res image)", () => {
    const size = 5_000_000;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i % 256;
    const result = binaryToBase64(bytes);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("should produce correct base64 for multi-chunk data (round-trip verification)", () => {
    const original = "The quick brown fox jumps over the lazy dog. ".repeat(500);
    const bytes = new TextEncoder().encode(original);
    const base64 = binaryToBase64(bytes);
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
    expect(decoded).toBe(original);
  });

  it("should handle ArrayBuffer larger than one chunk", () => {
    const size = 20_000;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i % 256;
    const result = binaryToBase64(bytes.buffer);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});

describe("inferModality", () => {
  it("should infer image from a full IANA image type", () => {
    expect(inferModality("image/png")).toBe("image");
  });

  it("should infer video from a full IANA video type", () => {
    expect(inferModality("video/mp4")).toBe("video");
  });

  it("should infer audio from a full IANA audio type", () => {
    expect(inferModality("audio/mpeg")).toBe("audio");
  });

  it("should infer document from a full IANA text type", () => {
    expect(inferModality("text/plain")).toBe("document");
  });

  it("should infer document from an application type", () => {
    expect(inferModality("application/pdf")).toBe("document");
  });

  it("should infer image from a bare 'image' segment (v7)", () => {
    expect(inferModality("image")).toBe("image");
  });

  it("should infer video from a bare 'video' segment (v7)", () => {
    expect(inferModality("video")).toBe("video");
  });

  it("should infer audio from a bare 'audio' segment (v7)", () => {
    expect(inferModality("audio")).toBe("audio");
  });

  it("should infer document from a bare 'text' segment (v7)", () => {
    expect(inferModality("text")).toBe("document");
  });

  it("should infer image from an 'image/*' wildcard (v7)", () => {
    expect(inferModality("image/*")).toBe("image");
  });

  it("should default to document for undefined", () => {
    expect(inferModality(undefined)).toBe("document");
  });

  it("should default to document for an unknown top-level segment", () => {
    expect(inferModality("model/gltf-binary")).toBe("document");
  });
});

describe("adaptUnsupportedParts", () => {
  it("should return the same message when it has no unsupported parts", () => {
    const message: GenAIMessage = {
      role: "assistant",
      parts: [
        { type: "text", content: "Hello" },
        { type: "tool_call", id: "call_1", name: "get_weather" },
      ],
    };

    expect(adaptUnsupportedParts(message)).toBe(message);
  });

  it("should convert a server_tool_call to a tool_call recording the source type", () => {
    const message: GenAIMessage = {
      role: "assistant",
      parts: [
        {
          type: "server_tool_call",
          id: "srv_1",
          name: "web_search",
          server_tool_call: { type: "web_search", query: "rosetta" },
        },
      ],
    };

    expect(adaptUnsupportedParts(message).parts[0]).toEqual({
      type: "tool_call",
      id: "srv_1",
      name: "web_search",
      arguments: { type: "web_search", query: "rosetta" },
      _provider_metadata: { _known_fields: { originalType: "server_tool_call" } },
    });
  });

  it("should convert a server_tool_call_response to a tool_call_response recording the source type", () => {
    const message: GenAIMessage = {
      role: "assistant",
      parts: [
        {
          type: "server_tool_call_response",
          id: "srv_1",
          server_tool_call_response: { type: "web_search_result", results: [] },
        },
      ],
    };

    expect(adaptUnsupportedParts(message).parts[0]).toEqual({
      type: "tool_call_response",
      id: "srv_1",
      response: { type: "web_search_result", results: [] },
      _provider_metadata: { _known_fields: { originalType: "server_tool_call_response" } },
    });
  });

  it("should omit the payload fields when the server-side tool details are missing", () => {
    const message: GenAIMessage = {
      role: "assistant",
      parts: [
        { type: "server_tool_call", name: "web_search" },
        { type: "server_tool_call_response", id: "srv_1" },
      ],
    };

    const parts = adaptUnsupportedParts(message).parts;
    expect(parts[0]).not.toHaveProperty("arguments");
    expect(parts[1]).not.toHaveProperty("response");
  });

  it("should keep existing part metadata when adapting server-side tool parts", () => {
    const message: GenAIMessage = {
      role: "assistant",
      parts: [
        {
          type: "server_tool_call",
          name: "web_search",
          server_tool_call: { type: "web_search" },
          _provider_metadata: { customField: "value", _known_fields: { toolName: "web_search" } },
        },
      ],
    };

    expect(adaptUnsupportedParts(message).parts[0]).toMatchObject({
      _provider_metadata: {
        customField: "value",
        _known_fields: { toolName: "web_search", originalType: "server_tool_call" },
      },
    });
  });

  it("should convert a compaction summary to a text part recording the source type", () => {
    const message: GenAIMessage = {
      role: "assistant",
      parts: [
        { type: "compaction", id: "cmp_1", content: "Summary" },
        { type: "text", content: "Hello" },
      ],
    };

    expect(adaptUnsupportedParts(message)).toEqual({
      role: "assistant",
      parts: [
        {
          type: "text",
          id: "cmp_1",
          content: "Summary",
          _provider_metadata: { _known_fields: { originalType: "compaction" } },
        },
        { type: "text", content: "Hello" },
      ],
    });
  });

  it("should convert a compaction part with no readable summary to an empty text part", () => {
    // Providers may only expose an encrypted compaction item, leaving no summary to carry
    const message = {
      role: "assistant",
      parts: [
        { type: "compaction", id: "cmp_1" },
        { type: "compaction", id: "cmp_2", content: null },
      ],
    } as unknown as GenAIMessage;

    expect(adaptUnsupportedParts(message).parts).toEqual([
      {
        type: "text",
        id: "cmp_1",
        content: "",
        _provider_metadata: { _known_fields: { originalType: "compaction" } },
      },
      {
        type: "text",
        id: "cmp_2",
        content: "",
        _provider_metadata: { _known_fields: { originalType: "compaction" } },
      },
    ]);
  });

  it("should never write message metadata", () => {
    const message: GenAIMessage = {
      role: "assistant",
      parts: [{ type: "compaction", id: "cmp_1" }],
      _provider_metadata: { customField: "value" },
    };

    const adapted = adaptUnsupportedParts(message);

    // Every part maps to something, so the message metadata is left exactly as it was
    expect(adapted._provider_metadata).toEqual({ customField: "value" });
  });
});
