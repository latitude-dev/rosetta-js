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
 * Mode for handling provider metadata during translation.
 * - "strip": No extra fields or metadata field in output. Known fields are still used internally.
 * - "preserve" (default): Add metadata field to output entities. Fields stay inside the metadata field.
 * - "passthrough": Spread all extra fields as direct properties on output entities.
 */
export type ProviderMetadataMode = "strip" | "preserve" | "passthrough";

/**
 * Known fields stored in `_known_fields` for building correct translations.
 * These are used internally regardless of the metadata mode.
 */
export type KnownFields = {
  /** Tool name for tool_call_response parts (GenAI schema doesn't include it) */
  toolName?: string;
  /** Error indicator for tool results or other error states */
  isError?: boolean;
  /** Refusal indicator for assistant refusal content */
  isRefusal?: boolean;
  /** Original type when mapping to a different GenAI type (for lossy conversions) */
  originalType?: string;
  /** Original message index for system parts extracted into a separate system array */
  messageIndex?: number;
};

/**
 * Reads metadata from an entity, checking both casings (snake_case and camelCase).
 * This is necessary because messages may have been previously translated by Rosetta
 * with different target providers (GenAI uses snake_case, VercelAI uses camelCase).
 * Returns undefined if metadata is not present or is an empty object.
 */
export function readMetadata(entity: Record<string, unknown>): Record<string, unknown> | undefined {
  // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
  const metadata = (entity["_provider_metadata"] ?? entity["_providerMetadata"]) as Record<string, unknown> | undefined;
  // Return undefined for empty objects to prevent empty metadata from propagating
  if (!metadata || Object.keys(metadata).length === 0) return undefined;
  return metadata;
}

/**
 * Extracts known fields from metadata, checking both casings.
 * Returns an object with typed known fields for building correct translations.
 */
export function getKnownFields(metadata: Record<string, unknown> | undefined): KnownFields {
  if (!metadata) return {};
  // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
  const known = (metadata["_known_fields"] ?? metadata["_knownFields"]) as KnownFields | undefined;
  return {
    toolName: known?.toolName,
    isError: known?.isError,
    isRefusal: known?.isRefusal,
    originalType: known?.originalType,
    messageIndex: known?.messageIndex,
  };
}

/**
 * Extracts parts metadata from message metadata, checking both casings.
 * Parts metadata is used to preserve part-level metadata when converting to providers
 * that require string content (e.g., VercelAI system messages).
 *
 * @param metadata - The message metadata to extract from
 * @returns The parts metadata object, or undefined if not present
 */
export function getPartsMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
  return (metadata["_parts_metadata"] ?? metadata["_partsMetadata"]) as Record<string, unknown> | undefined;
}

/**
 * Stores metadata on a GenAI entity, merging with any existing metadata.
 * This is used in toGenAI to build the _provider_metadata field.
 *
 * @param existingMetadata - Existing metadata from the entity (from readMetadata)
 * @param extraFields - Extra fields from the source provider to preserve
 * @param knownFields - Known fields for cross-provider translation
 * @returns The merged metadata object, or undefined if empty
 */
export function storeMetadata(
  existingMetadata: Record<string, unknown> | undefined,
  extraFields: Record<string, unknown>,
  knownFields: KnownFields,
): Record<string, unknown> | undefined {
  // Filter out undefined known fields
  const validKnown = Object.fromEntries(Object.entries(knownFields).filter(([_, v]) => v !== undefined));
  const hasKnown = Object.keys(validKnown).length > 0;
  const hasExtra = Object.keys(extraFields).length > 0;

  // Extract existing metadata, checking both casings
  const { _known_fields, _knownFields, _provider_metadata, _providerMetadata, ...existingExtra } =
    existingMetadata ?? {};
  const existingKnown = (_known_fields ?? _knownFields) as Record<string, unknown> | undefined;
  const hasExistingExtra = Object.keys(existingExtra).length > 0;
  const hasExistingKnown = existingKnown && Object.keys(existingKnown).length > 0;

  if (!hasKnown && !hasExtra && !hasExistingExtra && !hasExistingKnown) return undefined;

  const merged: Record<string, unknown> = {
    ...existingExtra, // Existing extra fields
    ...extraFields, // New extra fields (may override)
  };

  // Merge known fields if any
  if (hasKnown || hasExistingKnown) {
    // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
    merged["_known_fields"] = { ...existingKnown, ...validKnown };
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Applies the metadata mode to an output entity during fromGenAI conversion.
 *
 * @param entity - The output entity being built
 * @param metadata - The metadata from the GenAI entity
 * @param mode - The metadata mode to apply
 * @param useCamelCase - Whether to use camelCase for metadata field names (true for VercelAI/Promptl)
 * @returns The entity with metadata applied according to the mode
 */
export function applyMetadataMode<T extends object>(
  entity: T,
  metadata: Record<string, unknown> | undefined,
  mode: ProviderMetadataMode,
  useCamelCase = true,
): T {
  // Return early if no metadata or empty metadata object
  if (!metadata || Object.keys(metadata).length === 0) return entity;

  switch (mode) {
    case "strip":
      // No extra fields, no metadata field
      return entity;

    case "preserve": {
      // Add metadata field with target provider's casing
      const metadataKey = useCamelCase ? "_providerMetadata" : "_provider_metadata";
      const knownFieldsKey = useCamelCase ? "_knownFields" : "_known_fields";
      const partsMetadataKey = useCamelCase ? "_partsMetadata" : "_parts_metadata";

      // Normalize the known fields and parts metadata keys in the metadata
      const { _known_fields, _knownFields, _parts_metadata, _partsMetadata, ...rest } = metadata;
      const knownFields = _known_fields ?? _knownFields;
      const partsMetadata = _parts_metadata ?? _partsMetadata;
      const hasKnownFields = knownFields && Object.keys(knownFields as object).length > 0;
      const hasPartsMetadata = partsMetadata && Object.keys(partsMetadata as object).length > 0;

      const normalizedMetadata: Record<string, unknown> = { ...rest };
      if (hasKnownFields) {
        normalizedMetadata[knownFieldsKey] = knownFields;
      }
      if (hasPartsMetadata) {
        normalizedMetadata[partsMetadataKey] = partsMetadata;
      }

      // Only add metadata field if there's something to store
      if (Object.keys(normalizedMetadata).length === 0) return entity;
      return { ...entity, [metadataKey]: normalizedMetadata };
    }

    case "passthrough": {
      // Spread all extra fields EXCEPT known fields and parts metadata (either casing)
      // _partsMetadata should be restored to parts by the provider's fromGenAI, not spread at entity level
      const { _known_fields, _knownFields, _parts_metadata, _partsMetadata, ...extraFields } = metadata;
      // Only spread if there are extra fields to add
      if (Object.keys(extraFields).length === 0) return entity;
      return { ...entity, ...extraFields };
    }
  }
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

/**
 * Adds provider metadata to a GenAI part if there's any data to store.
 * This is a simpler helper for source-only providers that just need to store extra fields and known fields.
 *
 * @param part - The GenAI part to add metadata to
 * @param extraFields - Extra fields from the source to preserve
 * @param knownFields - Known fields for cross-provider translation
 * @returns The part with `_provider_metadata` added, or the original part if no metadata
 */
export function withMetadata<T extends { type: string; _provider_metadata?: Record<string, unknown> }>(
  part: T,
  extraFields: Record<string, unknown>,
  knownFields?: KnownFields,
): T {
  const metadata = storeMetadata(
    readMetadata(part as unknown as Record<string, unknown>),
    extraFields,
    knownFields ?? {},
  );
  if (!metadata) return part;
  return { ...part, _provider_metadata: metadata };
}
