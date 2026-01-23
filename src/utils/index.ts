/**
 * Utils module - Shared utility functions
 *
 * This module contains utility functions used across the library.
 */

import type { z } from "zod";

/**
 * Recursively removes index signatures from a type while preserving known properties.
 * This is useful when using Zod's `.passthrough()` for runtime behavior but wanting
 * clean TypeScript types without `[x: string]: unknown`.
 *
 * @example
 * // Zod passthrough infers: { [x: string]: unknown; type: "text"; text: string }
 * // WithoutIndexSignature gives: { type: "text"; text: string }
 */
// biome-ignore format: preserve conditional type formatting for readability
export type WithoutIndexSignature<T> =
  T extends object
    ? T extends Array<infer U>
      ? Array<WithoutIndexSignature<U>>
      : { [K in keyof T as string extends K ? never : number extends K ? never : K]: WithoutIndexSignature<T[K]> }
    : T;

/**
 * Infers a TypeScript type from a Zod schema, removing index signatures from passthrough schemas.
 * Use this instead of `z.infer<T>` when you want clean types without `[x: string]: unknown`.
 *
 * @example
 * const MySchema = z.object({ name: z.string() }).passthrough();
 * type MyType = Infer<typeof MySchema>; // { name: string } - no index signature
 */

export type Infer<T extends z.ZodType> = WithoutIndexSignature<z.infer<T>>;

/**
 * Makes all properties of a type optional with only `undefined` as the allowed value.
 * Useful for representing "cleared" or "reset" objects where all fields are explicitly undefined.
 *
 * @example
 * type User = { name: string; age: number };
 * type VoidedUser = Voided<User>;
 * // Result: { name?: undefined; age?: undefined }
 */
export type Voided<T> = { [K in keyof T]?: undefined };

/**
 * Extracts extra fields from an object, excluding known keys.
 * Useful for preserving passthrough fields in schema conversions.
 */
export function extractExtraFields<T extends object>(obj: T, knownKeys: (keyof T)[]): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!knownKeys.includes(key as keyof T)) {
      extra[key] = obj[key as keyof T];
    }
  }
  return extra;
}

/**
 * Checks if a string looks like a URL (http://, https://, or data: URI).
 */
export function isUrlString(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:");
}

/**
 * Checks if a value is a URL (URL instance or URL string).
 */
export function isUrl(value: unknown): value is URL | string {
  if (value instanceof URL) return true;
  if (typeof value === "string") return isUrlString(value);
  return false;
}

/**
 * Extracts URL string from a URL instance or string.
 */
export function getUrlString(value: URL | string): string {
  return value instanceof URL ? value.toString() : value;
}

/**
 * Converts binary data (Uint8Array or ArrayBuffer) to a base64 string.
 */
export function binaryToBase64(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Infers modality from a MIME type string.
 * Returns the modality category: image, video, audio, or document (default for text and unknown types).
 */
export function inferModality(mimeType: string | undefined): string {
  if (!mimeType) return "document";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

/** Shorthand type for a generic object with string keys */
export type Obj = Record<string, unknown>;

/**
 * Converts a key from snake_case or kebab-case to camelCase.
 * @example normalizeKey("tool_calls") => "toolCalls"
 * @example normalizeKey("image-url") => "imageUrl"
 */
export function normalizeKey(key: string): string {
  return key.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}

/**
 * Normalizes all keys in an object to camelCase (shallow).
 * Useful for handling objects from different providers with varying key conventions.
 */
export function normalizeKeys(obj: Obj): Obj {
  const normalized: Obj = {};
  for (const [key, value] of Object.entries(obj)) {
    normalized[normalizeKey(key)] = value;
  }
  return normalized;
}

/**
 * Safely gets a property value from an object.
 * Designed for use with objects that have index signatures (Record<string, unknown>).
 */
export function getProperty(obj: Obj, key: string): unknown {
  return obj[key];
}

/**
 * Gets a string property from an object, or undefined if not a string.
 */
export function getStringProperty(obj: Obj, key: string): string | undefined {
  const val = obj[key];
  return typeof val === "string" ? val : undefined;
}

/**
 * Gets an object property from an object, or undefined if not an object.
 */
export function getObjectProperty(obj: Obj, key: string): Obj | undefined {
  const val = obj[key];
  return typeof val === "object" && val !== null ? (val as Obj) : undefined;
}

/**
 * Parses a value as JSON if it's a string, otherwise returns as-is.
 * Useful for tool arguments that may be JSON strings or already-parsed objects.
 */
export function parseJsonIfString(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
