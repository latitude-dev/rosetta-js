/**
 * Promptl Schema
 *
 * This file contains the Zod schemas for the Promptl message format.
 * Based on the legacy and new Promptl message types.
 */

import { z } from "zod";

/** Base content schema with common fields. Uses passthrough to preserve _promptlSourceMap and other metadata. */
const BaseContentSchema = z.object({}).passthrough();

/**
 * Schema for binary data that accepts string, URL, or any binary format.
 * Uses z.any() for binary types to ensure compatibility with external libraries (like promptl-ai)
 * which use Buffer, ArrayBuffer, Uint8Array with varying generic parameters.
 * Actual type checking happens at runtime via instanceof checks in conversion code.
 */
const BinaryDataSchema = z.union([
  z.string(),
  z.instanceof(URL),
  // Accept any object that could be binary data (Buffer, ArrayBuffer, Uint8Array, etc.)
  z.custom<Uint8Array | ArrayBuffer>((val) => {
    return val instanceof Uint8Array || val instanceof ArrayBuffer;
  }),
]);
export type BinaryData = z.infer<typeof BinaryDataSchema>;

/** Text content in a Promptl message. */
export const PromptlTextContentSchema = BaseContentSchema.extend({
  type: z.literal("text"),
  text: z.string().optional(),
});
export type PromptlTextContent = z.infer<typeof PromptlTextContentSchema>;

/** Image content in a Promptl message. Supports various binary formats and URLs. */
export const PromptlImageContentSchema = BaseContentSchema.extend({
  type: z.literal("image"),
  image: BinaryDataSchema,
});
export type PromptlImageContent = z.infer<typeof PromptlImageContentSchema>;

/** File content in a Promptl message. Supports various binary formats and URLs. */
export const PromptlFileContentSchema = BaseContentSchema.extend({
  type: z.literal("file"),
  file: BinaryDataSchema,
  mimeType: z.string(),
});
export type PromptlFileContent = z.infer<typeof PromptlFileContentSchema>;

/** Reasoning content in a Promptl message. */
export const PromptlReasoningContentSchema = BaseContentSchema.extend({
  type: z.literal("reasoning"),
  text: z.string(),
  id: z.string().optional(),
  isStreaming: z.boolean().optional(),
});
export type PromptlReasoningContent = z.infer<typeof PromptlReasoningContentSchema>;

/** Redacted reasoning content in a Promptl message. */
export const PromptlRedactedReasoningContentSchema = BaseContentSchema.extend({
  type: z.literal("redacted-reasoning"),
  data: z.string(),
});
export type PromptlRedactedReasoningContent = z.infer<typeof PromptlRedactedReasoningContentSchema>;

/** Tool call/request content in a Promptl message.
 * Supports both `args` (new) and `toolArguments` (legacy) for backwards compatibility. */
export const PromptlToolCallContentSchema = z
  .object({
    type: z.literal("tool-call"),
    toolCallId: z.string(),
    toolName: z.string(),
    /** New field name for tool arguments. */
    args: z.record(z.string(), z.unknown()).optional(),
    /** Legacy field name for tool arguments (backwards compatibility). */
    toolArguments: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
export type PromptlToolCallContent = z.infer<typeof PromptlToolCallContentSchema>;

/** Tool result content in a Promptl message. */
export const PromptlToolResultContentSchema = z
  .object({
    type: z.literal("tool-result"),
    toolCallId: z.string(),
    toolName: z.string(),
    result: z.unknown(),
    isError: z.boolean().optional(),
  })
  .passthrough();
export type PromptlToolResultContent = z.infer<typeof PromptlToolResultContentSchema>;

/** Union of all Promptl content types. */
export const PromptlContentSchema = z.discriminatedUnion("type", [
  PromptlTextContentSchema,
  PromptlImageContentSchema,
  PromptlFileContentSchema,
  PromptlReasoningContentSchema,
  PromptlRedactedReasoningContentSchema,
  PromptlToolCallContentSchema,
  PromptlToolResultContentSchema,
]);
export type PromptlContent = z.infer<typeof PromptlContentSchema>;

/** Tool call object for the toolCalls field on AssistantMessage.
 * Supports both `arguments` (new) and legacy field names for backwards compatibility. */
export const PromptlToolCallSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    arguments: z.record(z.string(), z.unknown()),
  })
  .passthrough();
export type PromptlToolCall = z.infer<typeof PromptlToolCallSchema>;

/** Base message schema with common fields.
 * Content can be a string (promptl library output) or array of content objects. */
const BaseMessageSchema = z
  .object({
    content: z.union([z.string(), z.array(PromptlContentSchema)]),
  })
  .passthrough();

/** System message in Promptl format. */
export const PromptlSystemMessageSchema = BaseMessageSchema.extend({
  role: z.literal("system"),
});
export type PromptlSystemMessage = z.infer<typeof PromptlSystemMessageSchema>;

/** Developer message in Promptl format. */
export const PromptlDeveloperMessageSchema = BaseMessageSchema.extend({
  role: z.literal("developer"),
});
export type PromptlDeveloperMessage = z.infer<typeof PromptlDeveloperMessageSchema>;

/** User message in Promptl format. */
export const PromptlUserMessageSchema = BaseMessageSchema.extend({
  role: z.literal("user"),
  name: z.string().optional(),
});
export type PromptlUserMessage = z.infer<typeof PromptlUserMessageSchema>;

/** Assistant message in Promptl format.
 * Content can be a string, array of tool call content, or array of any content.
 * Also supports a separate toolCalls array and streaming flag. */
export const PromptlAssistantMessageSchema = BaseMessageSchema.extend({
  role: z.literal("assistant"),
  toolCalls: z.array(PromptlToolCallSchema).nullable().optional(),
});
export type PromptlAssistantMessage = z.infer<typeof PromptlAssistantMessageSchema>;

/** Tool message in Promptl format.
 * Supports both legacy format (toolName/toolId at message level) and new format (tool-result in content). */
export const PromptlToolMessageSchema = z
  .object({
    role: z.literal("tool"),
    content: z.array(PromptlContentSchema),
    /** Legacy field: tool name at message level. */
    toolName: z.string().optional(),
    /** Legacy field: tool call ID at message level. */
    toolId: z.string().optional(),
  })
  .passthrough();
export type PromptlToolMessage = z.infer<typeof PromptlToolMessageSchema>;

/** Union of all Promptl message types. */
export const PromptlMessageSchema = z.discriminatedUnion("role", [
  PromptlSystemMessageSchema,
  PromptlDeveloperMessageSchema,
  PromptlUserMessageSchema,
  PromptlAssistantMessageSchema,
  PromptlToolMessageSchema,
]);
export type PromptlMessage = z.infer<typeof PromptlMessageSchema>;
