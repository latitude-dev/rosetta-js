/**
 * Anthropic Provider
 *
 * Provider for the Anthropic Messages API format.
 * This is a source-only provider (no fromGenAI) since Anthropic messages
 * are typically ingested but not produced by this library.
 *
 * Key features:
 * - Handles both MessageParam (input) and Message (output) formats
 * - Supports system instructions as a separate parameter
 * - Supports extended thinking (thinking/redacted_thinking blocks)
 * - Supports tool use and tool results
 * - Supports images (base64 and URL) and documents
 * - Supports web search tool results
 */

import type { GenAIMessage, GenAIPart } from "$package/core/genai";
import {
  type AnthropicContentBlock,
  type AnthropicMessage,
  AnthropicMessageSchema,
  AnthropicSystemSchema,
} from "$package/providers/anthropic/schema";
import { Provider, type ProviderSpecification, type ProviderToGenAIArgs } from "$package/providers/provider";
import { extractExtraFields } from "$package/utils";

export const AnthropicSpecification = {
  provider: Provider.Anthropic,
  name: "Anthropic",
  messageSchema: AnthropicMessageSchema,
  systemSchema: AnthropicSystemSchema,

  toGenAI({ messages, system, direction }: ProviderToGenAIArgs) {
    // Handle string input
    if (typeof messages === "string") {
      const role = direction === "input" ? "user" : "assistant";
      return {
        messages: [{ role, parts: [{ type: "text" as const, content: messages }] }],
      };
    }

    // Validate with schema
    const parsedMessages = AnthropicMessageSchema.array().parse(messages);

    // Convert each message
    const converted: GenAIMessage[] = [];

    // Handle system instructions - convert to a system message
    if (system !== undefined) {
      const parsedSystem = AnthropicSystemSchema.parse(system);
      converted.push(convertSystemToGenAI(parsedSystem));
    }

    for (const message of parsedMessages) {
      converted.push(anthropicMessageToGenAI(message));
    }

    return { messages: converted };
  },
} as const satisfies ProviderSpecification<Provider.Anthropic>;

/** Message-level keys that are handled explicitly during conversion (not stored as opaque metadata). */
const KNOWN_MESSAGE_KEYS = ["role", "content", "id", "type", "model", "stop_reason", "stop_sequence", "usage"];

/** Adds provider metadata if there's any data to store. */
function withMetadata(part: GenAIPart, metadata: Record<string, unknown>): GenAIPart {
  if (Object.keys(metadata).length === 0) return part;
  return { ...part, _provider_metadata: { anthropic: metadata } };
}

/** Converts Anthropic system instructions to a GenAI system message. */
function convertSystemToGenAI(system: string | Array<{ type: "text"; text: string }>): GenAIMessage {
  if (typeof system === "string") {
    return { role: "system", parts: [{ type: "text", content: system }] };
  }

  const parts: GenAIPart[] = [];
  for (const block of system) {
    const extraFields = extractExtraFields(block, ["type", "text"] as (keyof typeof block)[]);
    parts.push(withMetadata({ type: "text", content: block.text }, extraFields));
  }
  return { role: "system", parts };
}

/** Converts an Anthropic message to a GenAI message. */
function anthropicMessageToGenAI(message: AnthropicMessage): GenAIMessage {
  const extraFields = extractExtraFields(message, KNOWN_MESSAGE_KEYS as (keyof AnthropicMessage)[]);
  const parts: GenAIPart[] = [];

  // Handle string content (shorthand for single text block)
  if (typeof message.content === "string") {
    parts.push({ type: "text", content: message.content });
  } else {
    // Handle array of content blocks
    for (const block of message.content) {
      parts.push(...convertContentBlock(block));
    }
  }

  // Map stop_reason to finish_reason for output messages
  let finishReason: string | undefined;
  if ("stop_reason" in message && message.stop_reason) {
    finishReason = mapStopReason(message.stop_reason);
  }

  return {
    role: message.role,
    parts,
    ...(finishReason ? { finish_reason: finishReason } : {}),
    ...(Object.keys(extraFields).length > 0 ? { _provider_metadata: { anthropic: extraFields } } : {}),
  };
}

/** Maps Anthropic stop_reason to GenAI finish_reason. */
function mapStopReason(stopReason: string): string {
  switch (stopReason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "stop_sequence":
      return "stop";
    case "tool_use":
      return "tool_call";
    case "refusal":
      return "content_filter";
    default:
      return stopReason;
  }
}

/** Content block keys that are handled explicitly during conversion. */
const KNOWN_TEXT_KEYS = ["type", "text"];
const KNOWN_THINKING_KEYS = ["type", "thinking", "signature"];
const KNOWN_REDACTED_THINKING_KEYS = ["type", "data"];
const KNOWN_TOOL_USE_KEYS = ["type", "id", "name", "input"];
const KNOWN_TOOL_RESULT_KEYS = ["type", "tool_use_id", "content", "is_error"];
const KNOWN_IMAGE_KEYS = ["type", "source"];
const KNOWN_DOCUMENT_KEYS = ["type", "source"];

/** Converts a content block to GenAI parts. */
function convertContentBlock(block: AnthropicContentBlock): GenAIPart[] {
  switch (block.type) {
    case "text": {
      const extraFields = extractExtraFields(block, KNOWN_TEXT_KEYS as (keyof typeof block)[]);
      return [withMetadata({ type: "text", content: block.text }, extraFields)];
    }

    case "thinking": {
      const extraFields = extractExtraFields(block, KNOWN_THINKING_KEYS as (keyof typeof block)[]);
      // Store signature in metadata for potential round-trip
      return [
        withMetadata({ type: "reasoning", content: block.thinking }, { signature: block.signature, ...extraFields }),
      ];
    }

    case "redacted_thinking": {
      const extraFields = extractExtraFields(block, KNOWN_REDACTED_THINKING_KEYS as (keyof typeof block)[]);
      // Convert to generic part to preserve the structure
      return [withMetadata({ type: "redacted_thinking", data: block.data }, extraFields)];
    }

    case "tool_use": {
      const extraFields = extractExtraFields(block, KNOWN_TOOL_USE_KEYS as (keyof typeof block)[]);
      return [withMetadata({ type: "tool_call", id: block.id, name: block.name, arguments: block.input }, extraFields)];
    }

    case "server_tool_use": {
      // Built-in tool like web_search - convert to tool_call
      const extraFields = extractExtraFields(block, KNOWN_TOOL_USE_KEYS as (keyof typeof block)[]);
      return [
        withMetadata(
          { type: "tool_call", id: block.id, name: block.name, arguments: block.input },
          { isServerTool: true, ...extraFields },
        ),
      ];
    }

    case "tool_result": {
      const extraFields = extractExtraFields(block, KNOWN_TOOL_RESULT_KEYS as (keyof typeof block)[]);
      const response = convertToolResultContent(block.content);
      return [
        withMetadata(
          { type: "tool_call_response", id: block.tool_use_id, response },
          block.is_error ? { is_error: true, ...extraFields } : extraFields,
        ),
      ];
    }

    case "image": {
      const extraFields = extractExtraFields(block, KNOWN_IMAGE_KEYS as (keyof typeof block)[]);
      return [convertImageBlock(block.source, extraFields)];
    }

    case "document": {
      const extraFields = extractExtraFields(block, KNOWN_DOCUMENT_KEYS as (keyof typeof block)[]);
      return convertDocumentBlock(block.source, extraFields);
    }

    case "web_search_tool_result": {
      // Convert web search results to tool_call_response
      const extraFields = extractExtraFields(block, ["type", "tool_use_id", "content"] as (keyof typeof block)[]);
      return [
        withMetadata(
          { type: "tool_call_response", id: block.tool_use_id, response: block.content },
          { isWebSearchResult: true, ...extraFields },
        ),
      ];
    }

    case "search_result": {
      // RAG search result - convert to generic part
      const extraFields = extractExtraFields(block, ["type", "source", "title", "content"] as (keyof typeof block)[]);
      const textContent = block.content.map((t) => t.text).join("\n");
      return [
        withMetadata(
          { type: "search_result", source: block.source, title: block.title, content: textContent },
          extraFields,
        ),
      ];
    }

    default: {
      // Unknown block type - convert to generic part preserving all data
      const blockAny = block as Record<string, unknown>;
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signature access
      return [{ type: blockAny["type"] as string, ...blockAny, _provider_metadata: { anthropic: {} } }];
    }
  }
}

/** Converts tool result content to a response value. */
function convertToolResultContent(content: string | unknown[] | undefined): unknown {
  if (content === undefined) return null;
  if (typeof content === "string") return content;

  // Array content - could contain text, images, etc.
  const parts: unknown[] = [];
  for (const item of content) {
    if (typeof item === "object" && item !== null && "type" in item) {
      const typedItem = item as { type: string; text?: string };
      if (typedItem.type === "text" && typedItem.text) {
        parts.push(typedItem.text);
      } else {
        parts.push(item);
      }
    } else {
      parts.push(item);
    }
  }

  // If single text item, return as string
  if (parts.length === 1 && typeof parts[0] === "string") {
    return parts[0];
  }

  return parts;
}

/** Converts an image source to a GenAI part. */
function convertImageBlock(
  source: { type: string; media_type?: string; data?: string; url?: string },
  extraFields: Record<string, unknown>,
): GenAIPart {
  if (source.type === "base64") {
    const sourceExtra = extractExtraFields(source, ["type", "media_type", "data"] as (keyof typeof source)[]);
    return withMetadata(
      {
        type: "blob",
        modality: "image",
        mime_type: source.media_type || "image/png",
        content: source.data || "",
      },
      { ...extraFields, ...sourceExtra },
    );
  }
  if (source.type === "url") {
    const sourceExtra = extractExtraFields(source, ["type", "url"] as (keyof typeof source)[]);
    return withMetadata({ type: "uri", modality: "image", uri: source.url || "" }, { ...extraFields, ...sourceExtra });
  }

  // Unknown source type
  return withMetadata({ type: "image", source }, extraFields);
}

/** Converts a document source to GenAI parts. */
function convertDocumentBlock(
  source: { type: string; media_type?: string; data?: string; url?: string; content?: unknown },
  extraFields: Record<string, unknown>,
): GenAIPart[] {
  switch (source.type) {
    case "base64": {
      const sourceExtra = extractExtraFields(source, ["type", "media_type", "data"] as (keyof typeof source)[]);
      return [
        withMetadata(
          {
            type: "blob",
            modality: "document",
            mime_type: source.media_type || "application/pdf",
            content: source.data || "",
          },
          { ...extraFields, ...sourceExtra },
        ),
      ];
    }

    case "text": {
      const sourceExtra = extractExtraFields(source, ["type", "media_type", "data"] as (keyof typeof source)[]);
      return [
        withMetadata(
          {
            type: "blob",
            modality: "document",
            mime_type: source.media_type || "text/plain",
            content: source.data || "",
          },
          { ...extraFields, ...sourceExtra },
        ),
      ];
    }

    case "url": {
      const sourceExtra = extractExtraFields(source, ["type", "url"] as (keyof typeof source)[]);
      return [
        withMetadata({ type: "uri", modality: "document", uri: source.url || "" }, { ...extraFields, ...sourceExtra }),
      ];
    }

    case "content": {
      // Content block source - contains nested content blocks
      const nestedContent = source.content;
      if (typeof nestedContent === "string") {
        return [withMetadata({ type: "text", content: nestedContent }, extraFields)];
      }
      if (Array.isArray(nestedContent)) {
        const parts: GenAIPart[] = [];
        for (const item of nestedContent) {
          parts.push(...convertContentBlock(item as AnthropicContentBlock));
        }
        return parts;
      }
      return [withMetadata({ type: "document", source }, extraFields)];
    }

    default:
      return [withMetadata({ type: "document", source }, extraFields)];
  }
}
