/**
 * Utils module tests
 */

import { describe, expect, it } from "vitest";
import { binaryToBase64 } from "$package/utils";

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
