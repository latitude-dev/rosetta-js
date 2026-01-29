/**
 * VercelAI Schema
 *
 * This file contains the Zod schemas for the Vercel AI SDK message format.
 * Based on the @ai-sdk/provider-utils message types.
 */

import { z } from "zod";
import type { Infer } from "$package/utils";

/**
 * Schema for binary data that accepts string, URL, or any binary format.
 * The Vercel AI SDK uses DataContent | URL for images and files.
 * DataContent = string | Uint8Array | ArrayBuffer | Buffer
 */
const DataContentSchema = z.union([
  z.string(),
  z.instanceof(URL),
  z.custom<Uint8Array | ArrayBuffer>((val) => {
    return val instanceof Uint8Array || val instanceof ArrayBuffer;
  }),
]);

/** Text content part. */
export const VercelAITextPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
  })
  .passthrough();
export type VercelAITextPart = Infer<typeof VercelAITextPartSchema>;

/** Image content part. */
export const VercelAIImagePartSchema = z
  .object({
    type: z.literal("image"),
    image: DataContentSchema,
    mediaType: z.string().optional(),
  })
  .passthrough();
export type VercelAIImagePart = Infer<typeof VercelAIImagePartSchema>;

/** File content part. */
export const VercelAIFilePartSchema = z
  .object({
    type: z.literal("file"),
    data: DataContentSchema,
    filename: z.string().optional(),
    mediaType: z.string(),
  })
  .passthrough();
export type VercelAIFilePart = Infer<typeof VercelAIFilePartSchema>;

/** Reasoning content part. */
export const VercelAIReasoningPartSchema = z
  .object({
    type: z.literal("reasoning"),
    text: z.string(),
  })
  .passthrough();
export type VercelAIReasoningPart = Infer<typeof VercelAIReasoningPartSchema>;

/** Tool call content part. */
export const VercelAIToolCallPartSchema = z
  .object({
    type: z.literal("tool-call"),
    toolCallId: z.string(),
    toolName: z.string(),
    input: z.unknown(),
  })
  .passthrough();
export type VercelAIToolCallPart = Infer<typeof VercelAIToolCallPartSchema>;

/** Tool result output - text variant. */
export const VercelAIToolResultOutputTextSchema = z
  .object({
    type: z.literal("text"),
    value: z.string(),
  })
  .passthrough();

/** Tool result output - json variant. */
export const VercelAIToolResultOutputJsonSchema = z
  .object({
    type: z.literal("json"),
    value: z.unknown(),
  })
  .passthrough();

/** Tool result output - error-text variant. */
export const VercelAIToolResultOutputErrorTextSchema = z
  .object({
    type: z.literal("error-text"),
    value: z.string(),
  })
  .passthrough();

/** Tool result output - error-json variant. */
export const VercelAIToolResultOutputErrorJsonSchema = z
  .object({
    type: z.literal("error-json"),
    value: z.unknown(),
  })
  .passthrough();

/** Tool result output - execution-denied variant. */
export const VercelAIToolResultOutputExecutionDeniedSchema = z
  .object({
    type: z.literal("execution-denied"),
    reason: z.string().optional(),
  })
  .passthrough();

/** Tool result output - content variant with nested content parts. */
export const VercelAIToolResultOutputContentSchema = z
  .object({
    type: z.literal("content"),
    value: z.array(
      z.union([
        z.object({ type: z.literal("text"), text: z.string() }).passthrough(),
        z.object({ type: z.literal("media"), data: z.string(), mediaType: z.string() }).passthrough(),
        z
          .object({
            type: z.literal("file-data"),
            data: z.string(),
            mediaType: z.string(),
            filename: z.string().optional(),
          })
          .passthrough(),
        z.object({ type: z.literal("file-url"), url: z.string() }).passthrough(),
        z
          .object({ type: z.literal("file-id"), fileId: z.union([z.string(), z.record(z.string(), z.string())]) })
          .passthrough(),
        z.object({ type: z.literal("image-data"), data: z.string(), mediaType: z.string() }).passthrough(),
        z.object({ type: z.literal("image-url"), url: z.string() }).passthrough(),
        z
          .object({ type: z.literal("image-file-id"), fileId: z.union([z.string(), z.record(z.string(), z.string())]) })
          .passthrough(),
        z.object({ type: z.literal("custom") }).passthrough(),
      ]),
    ),
  })
  .passthrough();

/** Union of all tool result output types. */
export const VercelAIToolResultOutputSchema = z.discriminatedUnion("type", [
  VercelAIToolResultOutputTextSchema,
  VercelAIToolResultOutputJsonSchema,
  VercelAIToolResultOutputErrorTextSchema,
  VercelAIToolResultOutputErrorJsonSchema,
  VercelAIToolResultOutputExecutionDeniedSchema,
  VercelAIToolResultOutputContentSchema,
]);
export type VercelAIToolResultOutput = Infer<typeof VercelAIToolResultOutputSchema>;

/** Tool result content part. */
export const VercelAIToolResultPartSchema = z
  .object({
    type: z.literal("tool-result"),
    toolCallId: z.string(),
    toolName: z.string(),
    output: VercelAIToolResultOutputSchema,
  })
  .passthrough();
export type VercelAIToolResultPart = Infer<typeof VercelAIToolResultPartSchema>;

/** Tool approval request part. */
export const VercelAIToolApprovalRequestSchema = z
  .object({
    type: z.literal("tool-approval-request"),
    approvalId: z.string(),
    toolCallId: z.string(),
  })
  .passthrough();
export type VercelAIToolApprovalRequest = Infer<typeof VercelAIToolApprovalRequestSchema>;

/** Tool approval response part. */
export const VercelAIToolApprovalResponseSchema = z
  .object({
    type: z.literal("tool-approval-response"),
    approvalId: z.string(),
    approved: z.boolean(),
    reason: z.string().optional(),
  })
  .passthrough();
export type VercelAIToolApprovalResponse = Infer<typeof VercelAIToolApprovalResponseSchema>;

/** User content - string or array of text/image/file parts. */
export const VercelAIUserContentSchema = z.union([
  z.string(),
  z.array(z.discriminatedUnion("type", [VercelAITextPartSchema, VercelAIImagePartSchema, VercelAIFilePartSchema])),
]);
export type VercelAIUserContent = Infer<typeof VercelAIUserContentSchema>;

/** Assistant content - string or array of various parts. */
export const VercelAIAssistantContentSchema = z.union([
  z.string(),
  z.array(
    z.discriminatedUnion("type", [
      VercelAITextPartSchema,
      VercelAIFilePartSchema,
      VercelAIReasoningPartSchema,
      VercelAIToolCallPartSchema,
      VercelAIToolResultPartSchema,
      VercelAIToolApprovalRequestSchema,
    ]),
  ),
]);
export type VercelAIAssistantContent = Infer<typeof VercelAIAssistantContentSchema>;

/** Tool content - array of tool result or approval response parts. */
export const VercelAIToolContentSchema = z.array(
  z.discriminatedUnion("type", [VercelAIToolResultPartSchema, VercelAIToolApprovalResponseSchema]),
);
export type VercelAIToolContent = Infer<typeof VercelAIToolContentSchema>;

/** System message. */
export const VercelAISystemMessageSchema = z
  .object({
    role: z.literal("system"),
    content: z.string(),
  })
  .passthrough();
export type VercelAISystemMessage = Infer<typeof VercelAISystemMessageSchema>;

/** User message. */
export const VercelAIUserMessageSchema = z
  .object({
    role: z.literal("user"),
    content: VercelAIUserContentSchema,
  })
  .passthrough();
export type VercelAIUserMessage = Infer<typeof VercelAIUserMessageSchema>;

/** Assistant message. */
export const VercelAIAssistantMessageSchema = z
  .object({
    role: z.literal("assistant"),
    content: VercelAIAssistantContentSchema,
  })
  .passthrough();
export type VercelAIAssistantMessage = Infer<typeof VercelAIAssistantMessageSchema>;

/** Tool message. */
export const VercelAIToolMessageSchema = z
  .object({
    role: z.literal("tool"),
    content: VercelAIToolContentSchema,
  })
  .passthrough();
export type VercelAIToolMessage = Infer<typeof VercelAIToolMessageSchema>;

/** Union of all message types. */
export const VercelAIMessageSchema = z.discriminatedUnion("role", [
  VercelAISystemMessageSchema,
  VercelAIUserMessageSchema,
  VercelAIAssistantMessageSchema,
  VercelAIToolMessageSchema,
]);
export type VercelAIMessage = Infer<typeof VercelAIMessageSchema>;

/** Union of all part types for internal use. */
export type VercelAIPart =
  | VercelAITextPart
  | VercelAIImagePart
  | VercelAIFilePart
  | VercelAIReasoningPart
  | VercelAIToolCallPart
  | VercelAIToolResultPart
  | VercelAIToolApprovalRequest
  | VercelAIToolApprovalResponse;
