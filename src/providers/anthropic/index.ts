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
import { extractExtraFields, readMetadata, storeMetadata, withMetadata } from "$package/utils";

export const AnthropicSpecification = {
  provider: Provider.Anthropic,
  name: "Anthropic",
  messageSchema: AnthropicMessageSchema,
  systemSchema: AnthropicSystemSchema,

  toGenAI({ messages, system, direction }: ProviderToGenAIArgs) {
    // Handle string input - wrap in Anthropic format then fall through
    // (avoids skipping system instruction handling below)
    if (typeof messages === "string") {
      const role = direction === "input" ? "user" : "assistant";
      messages = [{ role, content: messages }];
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
const KNOWN_MESSAGE_KEYS = [
  "role",
  "content",
  "id",
  "type",
  "model",
  "stop_reason",
  "stop_sequence",
  "usage",
  "_provider_metadata",
  "_providerMetadata",
];

/** Converts Anthropic system instructions to a GenAI system message. */
function convertSystemToGenAI(system: string | Array<{ type: "text"; text: string }>): GenAIMessage {
  if (typeof system === "string") {
    return { role: "system", parts: [{ type: "text", content: system }] };
  }

  const parts: GenAIPart[] = [];
  for (const block of system) {
    const extraFields = extractExtraFields(block, [
      "type",
      "text",
      "_provider_metadata",
      "_providerMetadata",
    ] as (keyof typeof block)[]);
    const existingMetadata = readMetadata(block as unknown as Record<string, unknown>);
    const metadata = storeMetadata(existingMetadata, extraFields, {});
    parts.push({
      type: "text",
      content: block.text,
      ...(metadata ? { _provider_metadata: metadata } : {}),
    });
  }
  return { role: "system", parts };
}

/** Converts an Anthropic message to a GenAI message. */
function anthropicMessageToGenAI(message: AnthropicMessage): GenAIMessage {
  const extraFields = extractExtraFields(message, KNOWN_MESSAGE_KEYS as (keyof AnthropicMessage)[]);
  const existingMetadata = readMetadata(message as unknown as Record<string, unknown>);
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

  const msgMetadata = storeMetadata(existingMetadata, extraFields, {});

  return {
    role: message.role,
    parts,
    ...(finishReason ? { finish_reason: finishReason } : {}),
    ...(msgMetadata ? { _provider_metadata: msgMetadata } : {}),
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
const KNOWN_TEXT_KEYS = ["type", "text", "_provider_metadata", "_providerMetadata"];
const KNOWN_THINKING_KEYS = ["type", "thinking", "signature", "_provider_metadata", "_providerMetadata"];
const KNOWN_REDACTED_THINKING_KEYS = ["type", "data", "_provider_metadata", "_providerMetadata"];
const KNOWN_TOOL_USE_KEYS = ["type", "id", "name", "input", "_provider_metadata", "_providerMetadata"];
const KNOWN_TOOL_RESULT_KEYS = [
  "type",
  "tool_use_id",
  "content",
  "is_error",
  "_provider_metadata",
  "_providerMetadata",
];
const KNOWN_IMAGE_KEYS = ["type", "source", "_provider_metadata", "_providerMetadata"];
const KNOWN_DOCUMENT_KEYS = ["type", "source", "_provider_metadata", "_providerMetadata"];

/** Converts a content block to GenAI parts. */
function convertContentBlock(block: AnthropicContentBlock): GenAIPart[] {
  const existingMetadata = readMetadata(block as unknown as Record<string, unknown>);

  switch (block.type) {
    case "text": {
      const extraFields = extractExtraFields(block, KNOWN_TEXT_KEYS as (keyof typeof block)[]);
      return [withMetadata({ type: "text", content: block.text }, extraFields)];
    }

    case "thinking": {
      const extraFields = extractExtraFields(block, KNOWN_THINKING_KEYS as (keyof typeof block)[]);
      // Store signature in extra fields for potential round-trip
      const metadata = storeMetadata(existingMetadata, { signature: block.signature, ...extraFields }, {});
      return [
        {
          type: "reasoning",
          content: block.thinking,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "redacted_thinking": {
      const extraFields = extractExtraFields(block, KNOWN_REDACTED_THINKING_KEYS as (keyof typeof block)[]);
      // Map to reasoning with originalType in known fields
      const metadata = storeMetadata(existingMetadata, extraFields, { originalType: "redacted_thinking" });
      return [
        {
          type: "reasoning",
          content: block.data,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "tool_use": {
      const extraFields = extractExtraFields(block, KNOWN_TOOL_USE_KEYS as (keyof typeof block)[]);
      return [withMetadata({ type: "tool_call", id: block.id, name: block.name, arguments: block.input }, extraFields)];
    }

    case "server_tool_use": {
      // Built-in tool like web_search - convert to tool_call
      const extraFields = extractExtraFields(block, KNOWN_TOOL_USE_KEYS as (keyof typeof block)[]);
      const metadata = storeMetadata(existingMetadata, { isServerTool: true, ...extraFields }, {});
      return [
        {
          type: "tool_call",
          id: block.id,
          name: block.name,
          arguments: block.input,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "tool_result": {
      const extraFields = extractExtraFields(block, KNOWN_TOOL_RESULT_KEYS as (keyof typeof block)[]);
      const response = convertToolResultContent(block.content);
      // Store isError in known fields
      const metadata = storeMetadata(existingMetadata, extraFields, block.is_error ? { isError: true } : {});
      return [
        {
          type: "tool_call_response",
          id: block.tool_use_id,
          response,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "image": {
      const extraFields = extractExtraFields(block, KNOWN_IMAGE_KEYS as (keyof typeof block)[]);
      return [convertImageBlock(block.source, extraFields, existingMetadata)];
    }

    case "document": {
      const extraFields = extractExtraFields(block, KNOWN_DOCUMENT_KEYS as (keyof typeof block)[]);
      return convertDocumentBlock(block.source, extraFields, existingMetadata);
    }

    case "web_search_tool_result": {
      // Convert web search results to tool_call_response
      const extraFields = extractExtraFields(block, [
        "type",
        "tool_use_id",
        "content",
        "_provider_metadata",
        "_providerMetadata",
      ] as (keyof typeof block)[]);
      const metadata = storeMetadata(existingMetadata, { isWebSearchResult: true, ...extraFields }, {});
      return [
        {
          type: "tool_call_response",
          id: block.tool_use_id,
          response: block.content,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "search_result": {
      // RAG search result - convert to generic part
      const extraFields = extractExtraFields(block, [
        "type",
        "source",
        "title",
        "content",
        "_provider_metadata",
        "_providerMetadata",
      ] as (keyof typeof block)[]);
      const textContent = block.content.map((t) => t.text).join("\n");
      const metadata = storeMetadata(existingMetadata, extraFields, {});
      return [
        {
          type: "search_result",
          source: block.source,
          title: block.title,
          content: textContent,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    default: {
      // Unknown block type - convert to generic part preserving all data
      const blockAny = block as Record<string, unknown>;
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signature access
      const blockType = blockAny["type"] as string;
      const { _provider_metadata, _providerMetadata, ...restBlock } = blockAny;
      const metadata = storeMetadata(existingMetadata, {}, {});
      return [{ type: blockType, ...restBlock, ...(metadata ? { _provider_metadata: metadata } : {}) } as GenAIPart];
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
  existingMetadata: Record<string, unknown> | undefined,
): GenAIPart {
  if (source.type === "base64") {
    const sourceExtra = extractExtraFields(source, ["type", "media_type", "data"] as (keyof typeof source)[]);
    const metadata = storeMetadata(existingMetadata, { ...extraFields, ...sourceExtra }, {});
    return {
      type: "blob",
      modality: "image",
      mime_type: source.media_type || "image/png",
      content: source.data || "",
      ...(metadata ? { _provider_metadata: metadata } : {}),
    };
  }
  if (source.type === "url") {
    const sourceExtra = extractExtraFields(source, ["type", "url"] as (keyof typeof source)[]);
    const metadata = storeMetadata(existingMetadata, { ...extraFields, ...sourceExtra }, {});
    return {
      type: "uri",
      modality: "image",
      uri: source.url || "",
      ...(metadata ? { _provider_metadata: metadata } : {}),
    };
  }

  // Unknown source type
  const metadata = storeMetadata(existingMetadata, extraFields, {});
  return {
    type: "image",
    source,
    ...(metadata ? { _provider_metadata: metadata } : {}),
  } as GenAIPart;
}

/** Converts a document source to GenAI parts. */
function convertDocumentBlock(
  source: { type: string; media_type?: string; data?: string; url?: string; content?: unknown },
  extraFields: Record<string, unknown>,
  existingMetadata: Record<string, unknown> | undefined,
): GenAIPart[] {
  switch (source.type) {
    case "base64": {
      const sourceExtra = extractExtraFields(source, ["type", "media_type", "data"] as (keyof typeof source)[]);
      const metadata = storeMetadata(existingMetadata, { ...extraFields, ...sourceExtra }, {});
      return [
        {
          type: "blob",
          modality: "document",
          mime_type: source.media_type || "application/pdf",
          content: source.data || "",
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "text": {
      const sourceExtra = extractExtraFields(source, ["type", "media_type", "data"] as (keyof typeof source)[]);
      const metadata = storeMetadata(existingMetadata, { ...extraFields, ...sourceExtra }, {});
      return [
        {
          type: "blob",
          modality: "document",
          mime_type: source.media_type || "text/plain",
          content: source.data || "",
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "url": {
      const sourceExtra = extractExtraFields(source, ["type", "url"] as (keyof typeof source)[]);
      const metadata = storeMetadata(existingMetadata, { ...extraFields, ...sourceExtra }, {});
      return [
        {
          type: "uri",
          modality: "document",
          uri: source.url || "",
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "content": {
      // Content block source - contains nested content blocks
      const nestedContent = source.content;
      if (typeof nestedContent === "string") {
        const metadata = storeMetadata(existingMetadata, extraFields, {});
        return [
          {
            type: "text",
            content: nestedContent,
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ];
      }
      if (Array.isArray(nestedContent)) {
        const parts: GenAIPart[] = [];
        for (const item of nestedContent) {
          parts.push(...convertContentBlock(item as AnthropicContentBlock));
        }
        return parts;
      }
      const metadata = storeMetadata(existingMetadata, extraFields, {});
      return [
        {
          type: "document",
          source,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        } as GenAIPart,
      ];
    }

    default: {
      const metadata = storeMetadata(existingMetadata, extraFields, {});
      return [
        {
          type: "document",
          source,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        } as GenAIPart,
      ];
    }
  }
}
