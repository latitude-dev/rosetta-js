/**
 * Anthropic Messages API Schemas
 *
 * Zod schemas for the Anthropic Messages API format.
 * Unified schema that handles both request (MessageParam) and response (Message) messages.
 * Only fields and entities used for GenAI translation are explicitly defined.
 * All other fields and entities flow through via .passthrough() to provider metadata.
 */

import { z } from "zod";
import type { Infer } from "$package/utils";

/** Text content block */
export const AnthropicTextBlockSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
  })
  .passthrough();
export type AnthropicTextBlock = Infer<typeof AnthropicTextBlockSchema>;

/** Thinking content block (extended thinking feature) */
export const AnthropicThinkingBlockSchema = z
  .object({
    type: z.literal("thinking"),
    thinking: z.string(),
    signature: z.string(),
  })
  .passthrough();
export type AnthropicThinkingBlock = Infer<typeof AnthropicThinkingBlockSchema>;

/** Redacted thinking block (when thinking is redacted) */
export const AnthropicRedactedThinkingBlockSchema = z
  .object({
    type: z.literal("redacted_thinking"),
    data: z.string(),
  })
  .passthrough();
export type AnthropicRedactedThinkingBlock = Infer<typeof AnthropicRedactedThinkingBlockSchema>;

/** Tool use block (assistant requesting tool execution) */
export const AnthropicToolUseBlockSchema = z
  .object({
    type: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
  })
  .passthrough();
export type AnthropicToolUseBlock = Infer<typeof AnthropicToolUseBlockSchema>;

/** Server tool use block (built-in tools like web_search) */
export const AnthropicServerToolUseBlockSchema = z
  .object({
    type: z.literal("server_tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
  })
  .passthrough();
export type AnthropicServerToolUseBlock = Infer<typeof AnthropicServerToolUseBlockSchema>;

/** Tool result block (user providing tool execution result) */
export const AnthropicToolResultBlockSchema = z
  .object({
    type: z.literal("tool_result"),
    tool_use_id: z.string(),
    content: z.union([z.string(), z.array(z.any())]).optional(),
    is_error: z.boolean().optional(),
  })
  .passthrough();
export type AnthropicToolResultBlock = Infer<typeof AnthropicToolResultBlockSchema>;

/** Base64 image source */
export const AnthropicBase64ImageSourceSchema = z
  .object({
    type: z.literal("base64"),
    media_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
    data: z.string(),
  })
  .passthrough();
export type AnthropicBase64ImageSource = Infer<typeof AnthropicBase64ImageSourceSchema>;

/** URL image source */
export const AnthropicURLImageSourceSchema = z
  .object({
    type: z.literal("url"),
    url: z.string(),
  })
  .passthrough();
export type AnthropicURLImageSource = Infer<typeof AnthropicURLImageSourceSchema>;

/** Image block */
export const AnthropicImageBlockSchema = z
  .object({
    type: z.literal("image"),
    source: z.union([AnthropicBase64ImageSourceSchema, AnthropicURLImageSourceSchema]),
  })
  .passthrough();
export type AnthropicImageBlock = Infer<typeof AnthropicImageBlockSchema>;

/** Base64 PDF source */
export const AnthropicBase64PDFSourceSchema = z
  .object({
    type: z.literal("base64"),
    media_type: z.literal("application/pdf"),
    data: z.string(),
  })
  .passthrough();
export type AnthropicBase64PDFSource = Infer<typeof AnthropicBase64PDFSourceSchema>;

/** Plain text source for documents */
export const AnthropicPlainTextSourceSchema = z
  .object({
    type: z.literal("text"),
    media_type: z.literal("text/plain"),
    data: z.string(),
  })
  .passthrough();
export type AnthropicPlainTextSource = Infer<typeof AnthropicPlainTextSourceSchema>;

/** URL PDF source */
export const AnthropicURLPDFSourceSchema = z
  .object({
    type: z.literal("url"),
    url: z.string(),
  })
  .passthrough();
export type AnthropicURLPDFSource = Infer<typeof AnthropicURLPDFSourceSchema>;

/** Content block source for documents */
export const AnthropicContentBlockSourceSchema = z
  .object({
    type: z.literal("content"),
    content: z.union([z.string(), z.array(z.union([AnthropicTextBlockSchema, AnthropicImageBlockSchema]))]),
  })
  .passthrough();
export type AnthropicContentBlockSource = Infer<typeof AnthropicContentBlockSourceSchema>;

/** Document block */
export const AnthropicDocumentBlockSchema = z
  .object({
    type: z.literal("document"),
    source: z.union([
      AnthropicBase64PDFSourceSchema,
      AnthropicPlainTextSourceSchema,
      AnthropicURLPDFSourceSchema,
      AnthropicContentBlockSourceSchema,
    ]),
  })
  .passthrough();
export type AnthropicDocumentBlock = Infer<typeof AnthropicDocumentBlockSchema>;

/** Web search tool result block */
export const AnthropicWebSearchToolResultBlockSchema = z
  .object({
    type: z.literal("web_search_tool_result"),
    tool_use_id: z.string(),
    content: z.unknown(),
  })
  .passthrough();
export type AnthropicWebSearchToolResultBlock = Infer<typeof AnthropicWebSearchToolResultBlockSchema>;

/** Search result block (for RAG/search results) */
export const AnthropicSearchResultBlockSchema = z
  .object({
    type: z.literal("search_result"),
    source: z.string(),
    title: z.string(),
    content: z.array(AnthropicTextBlockSchema),
  })
  .passthrough();
export type AnthropicSearchResultBlock = Infer<typeof AnthropicSearchResultBlockSchema>;

/**
 * Unified content block schema - handles all content types from both input and output.
 * Input-only types (image, document, tool_result) and output-only types are all included.
 */
export const AnthropicContentBlockSchema = z.union([
  AnthropicTextBlockSchema,
  AnthropicImageBlockSchema,
  AnthropicDocumentBlockSchema,
  AnthropicThinkingBlockSchema,
  AnthropicRedactedThinkingBlockSchema,
  AnthropicToolUseBlockSchema,
  AnthropicToolResultBlockSchema,
  AnthropicServerToolUseBlockSchema,
  AnthropicWebSearchToolResultBlockSchema,
  AnthropicSearchResultBlockSchema,
]);
export type AnthropicContentBlock = Infer<typeof AnthropicContentBlockSchema>;

/**
 * Unified message schema - handles both input (MessageParam) and output (Message) formats.
 *
 * Input format: { role: 'user' | 'assistant', content: string | ContentBlock[] }
 * Output format: { id, type: 'message', role: 'assistant', content: ContentBlock[], model, stop_reason, ... }
 *
 * The schema accepts both by making output-specific fields optional.
 */
export const AnthropicMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.union([z.string(), z.array(AnthropicContentBlockSchema).min(1)]),
    // Output-specific fields (optional for input messages)
    id: z.string().optional(),
    type: z.literal("message").optional(),
    model: z.string().optional(),
    stop_reason: z.string().nullable().optional(),
    stop_sequence: z.string().nullable().optional(),
    usage: z.object({}).passthrough().optional(),
  })
  .passthrough();
export type AnthropicMessage = Infer<typeof AnthropicMessageSchema>;

/** System content - can be string or array of text blocks */
export const AnthropicSystemSchema = z.union([z.string(), z.array(AnthropicTextBlockSchema)]);
export type AnthropicSystem = Infer<typeof AnthropicSystemSchema>;
