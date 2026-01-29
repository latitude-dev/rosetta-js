/**
 * Google Gemini Provider
 *
 * Provider for the Google Gemini GenerateContent API format.
 * This is a source-only provider (no fromGenAI).
 *
 * Key features:
 * - Handles both input and output Content format (same structure)
 * - Supports system instructions as a separate parameter
 * - Supports inline data (images, audio, video)
 * - Supports file data references by URI
 * - Supports function calls and function responses
 * - Supports executable code and code execution results
 * - Supports thought/reasoning content
 */

import type { GenAIMessage, GenAIPart } from "$package/core/genai";
import {
  type GoogleContent,
  GoogleContentSchema,
  type GooglePart,
  GoogleSystemSchema,
} from "$package/providers/google/schema";
import { Provider, type ProviderSpecification, type ProviderToGenAIArgs } from "$package/providers/provider";
import { extractExtraFields, inferModality, withMetadata } from "$package/utils";

export const GoogleSpecification = {
  provider: Provider.Google,
  name: "Google Gemini",
  messageSchema: GoogleContentSchema,
  systemSchema: GoogleSystemSchema,

  toGenAI({ messages, system, direction }: ProviderToGenAIArgs) {
    // Handle string input
    if (typeof messages === "string") {
      const role = direction === "input" ? "user" : "model";
      return {
        messages: [{ role, parts: [{ type: "text" as const, content: messages }] }],
      };
    }

    // Validate with schema
    const parsedMessages = GoogleContentSchema.array().parse(messages);

    // Convert each message
    const converted: GenAIMessage[] = [];

    // Handle system instructions - convert to a system message
    if (system !== undefined) {
      converted.push(convertSystemToGenAI(system));
    }

    for (const message of parsedMessages) {
      converted.push(googleContentToGenAI(message, direction));
    }

    return { messages: converted };
  },
} as const satisfies ProviderSpecification<Provider.Google>;

/** Message-level keys that are handled explicitly during conversion. */
const KNOWN_CONTENT_KEYS = ["role", "parts"];

/** Converts Google system instructions to a GenAI system message. */
function convertSystemToGenAI(system: unknown): GenAIMessage {
  // String system instruction
  if (typeof system === "string") {
    return { role: "system", parts: [{ type: "text", content: system }] };
  }

  // Content object with parts
  if (typeof system === "object" && system !== null) {
    // Check if it's a Content object (has parts array)
    if ("parts" in system && Array.isArray((system as { parts?: unknown }).parts)) {
      const content = system as GoogleContent;
      const parts: GenAIPart[] = [];
      for (const part of content.parts ?? []) {
        parts.push(...convertPart(part));
      }
      return { role: "system", parts };
    }

    // Array of parts
    if (Array.isArray(system)) {
      const parts: GenAIPart[] = [];
      for (const part of system) {
        parts.push(...convertPart(part as GooglePart));
      }
      return { role: "system", parts };
    }

    // Single part object
    const parts = convertPart(system as GooglePart);
    return { role: "system", parts };
  }

  return { role: "system", parts: [] };
}

/** Converts a Google Content to a GenAI message. */
function googleContentToGenAI(content: GoogleContent, direction: "input" | "output"): GenAIMessage {
  const extraFields = extractExtraFields(content, KNOWN_CONTENT_KEYS as (keyof GoogleContent)[]);
  const parts: GenAIPart[] = [];

  // Convert each part
  for (const part of content.parts ?? []) {
    parts.push(...convertPart(part));
  }

  // Map role: 'model' -> 'assistant', otherwise keep as-is
  const role = mapRole(content.role, direction);

  return {
    role,
    parts,
    ...(Object.keys(extraFields).length > 0 ? { _provider_metadata: { google: extraFields } } : {}),
  };
}

/** Maps Google role to GenAI role. */
function mapRole(role: string | undefined, direction: "input" | "output"): string {
  if (role === "model") return "assistant";
  if (role === "user") return "user";
  if (role === "system") return "system";
  // Default based on direction
  return direction === "input" ? "user" : "assistant";
}

/** Part-level keys that are handled explicitly. */
const KNOWN_PART_KEYS = [
  "text",
  "inlineData",
  "fileData",
  "functionCall",
  "functionResponse",
  "executableCode",
  "codeExecutionResult",
  "thought",
  "thoughtSignature",
  "mediaResolution",
  "videoMetadata",
];

/** Converts a Google Part to GenAI parts. */
function convertPart(part: GooglePart): GenAIPart[] {
  const extraFields = extractExtraFields(part, KNOWN_PART_KEYS as (keyof GooglePart)[]);

  // Text content
  if (part.text !== undefined) {
    // Check if this is a thought (reasoning)
    if (part.thought === true) {
      const metadata: Record<string, unknown> = { ...extraFields };
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signature access
      if (part["thoughtSignature"]) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signature access
        metadata["thoughtSignature"] = part["thoughtSignature"];
      }
      return [withMetadata({ type: "reasoning", content: part.text }, "google", metadata)];
    }
    return [withMetadata({ type: "text", content: part.text }, "google", extraFields)];
  }

  // Inline blob data (images, audio, etc.)
  if (part.inlineData !== undefined) {
    const blob = part.inlineData;
    const modality = inferModality(blob.mimeType);
    const blobExtra = extractExtraFields(blob, ["data", "mimeType"] as (keyof typeof blob)[]);
    return [
      withMetadata(
        {
          type: "blob",
          modality,
          mime_type: blob.mimeType ?? null,
          content: blob.data ?? "",
        },
        "google",
        { ...extraFields, ...blobExtra },
      ),
    ];
  }

  // File reference by URI
  if (part.fileData !== undefined) {
    const file = part.fileData;
    const modality = inferModality(file.mimeType);
    const fileExtra = extractExtraFields(file, ["fileUri", "mimeType"] as (keyof typeof file)[]);
    return [
      withMetadata(
        {
          type: "uri",
          modality,
          mime_type: file.mimeType ?? null,
          uri: file.fileUri ?? "",
        },
        "google",
        { ...extraFields, ...fileExtra },
      ),
    ];
  }

  // Function call
  if (part.functionCall !== undefined) {
    const fc = part.functionCall;
    const fcExtra = extractExtraFields(fc, ["id", "name", "args"] as (keyof typeof fc)[]);
    return [
      withMetadata(
        {
          type: "tool_call",
          id: fc.id ?? null,
          name: fc.name ?? "",
          arguments: fc.args,
        },
        "google",
        { ...extraFields, ...fcExtra },
      ),
    ];
  }

  // Function response
  if (part.functionResponse !== undefined) {
    const fr = part.functionResponse;
    const frExtra = extractExtraFields(fr, ["id", "name", "response"] as (keyof typeof fr)[]);
    const combinedMeta = { ...extraFields, ...frExtra };
    // Store toolName at root level for cross-provider access
    return [
      withMetadata(
        {
          type: "tool_call_response",
          id: fr.id ?? null,
          response: fr.response,
        },
        "google",
        combinedMeta,
        fr.name ? { toolName: fr.name } : undefined,
      ),
    ];
  }

  // Executable code
  if (part.executableCode !== undefined) {
    const code = part.executableCode;
    const codeExtra = extractExtraFields(code, ["code", "language"] as (keyof typeof code)[]);
    return [
      withMetadata(
        {
          type: "executable_code",
          code: code.code ?? "",
          language: code.language,
        },
        "google",
        { ...extraFields, ...codeExtra },
      ),
    ];
  }

  // Code execution result
  if (part.codeExecutionResult !== undefined) {
    const result = part.codeExecutionResult;
    const resultExtra = extractExtraFields(result, ["outcome", "output"] as (keyof typeof result)[]);
    return [
      withMetadata(
        {
          type: "code_execution_result",
          outcome: result.outcome,
          output: result.output ?? "",
        },
        "google",
        { ...extraFields, ...resultExtra },
      ),
    ];
  }

  // Unknown part type - convert to generic part preserving all data
  return [{ type: "unknown", ...part, _provider_metadata: { google: extraFields } }];
}
