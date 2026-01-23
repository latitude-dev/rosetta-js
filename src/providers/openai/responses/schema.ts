/**
 * OpenAI Responses Message Schemas
 *
 * Zod schemas for the OpenAI Responses API message format.
 * This is a unified schema that handles both request and response messages.
 * Only fields and entities used for GenAI translation are explicitly defined.
 * All other fields and entities flow through via .passthrough() to provider metadata.
 */

import { z } from "zod";
import type { Infer } from "$package/utils";

/** Text content part (input_text or output_text) */
export const OpenAIResponsesTextPartSchema = z
  .object({
    type: z.enum(["input_text", "output_text"]),
    text: z.string(),
  })
  .passthrough();
export type OpenAIResponsesTextPart = Infer<typeof OpenAIResponsesTextPartSchema>;

/** Image content part */
export const OpenAIResponsesImagePartSchema = z
  .object({
    type: z.literal("input_image"),
    detail: z.enum(["low", "high", "auto"]),
    file_id: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
  })
  .passthrough();
export type OpenAIResponsesImagePart = Infer<typeof OpenAIResponsesImagePartSchema>;

/** File content part */
export const OpenAIResponsesFilePartSchema = z
  .object({
    type: z.literal("input_file"),
    file_data: z.string().optional(),
    file_id: z.string().nullable().optional(),
  })
  .passthrough();
export type OpenAIResponsesFilePart = Infer<typeof OpenAIResponsesFilePartSchema>;

/** Audio content part */
export const OpenAIResponsesAudioPartSchema = z
  .object({
    type: z.literal("input_audio"),
    data: z.string(),
    format: z.enum(["mp3", "wav"]),
  })
  .passthrough();
export type OpenAIResponsesAudioPart = Infer<typeof OpenAIResponsesAudioPartSchema>;

/** Refusal content part */
export const OpenAIResponsesRefusalPartSchema = z
  .object({
    type: z.literal("refusal"),
    refusal: z.string(),
  })
  .passthrough();
export type OpenAIResponsesRefusalPart = Infer<typeof OpenAIResponsesRefusalPartSchema>;

/** Union of all content parts */
export const OpenAIResponsesContentPartSchema = z.union([
  OpenAIResponsesTextPartSchema,
  OpenAIResponsesImagePartSchema,
  OpenAIResponsesFilePartSchema,
  OpenAIResponsesAudioPartSchema,
  OpenAIResponsesRefusalPartSchema,
]);
export type OpenAIResponsesContentPart = Infer<typeof OpenAIResponsesContentPartSchema>;

/** Message item - unified for input/output */
export const OpenAIResponsesMessageSchema = z
  .object({
    type: z.literal("message").optional(),
    role: z.enum(["user", "assistant", "system", "developer"]),
    content: z.union([z.string(), z.array(OpenAIResponsesContentPartSchema)]),
  })
  .passthrough();
export type OpenAIResponsesMessage = Infer<typeof OpenAIResponsesMessageSchema>;

/** Function call item - model requests function execution */
export const OpenAIResponsesFunctionCallSchema = z
  .object({
    type: z.literal("function_call"),
    call_id: z.string(),
    name: z.string(),
    arguments: z.string(),
  })
  .passthrough();
export type OpenAIResponsesFunctionCall = Infer<typeof OpenAIResponsesFunctionCallSchema>;

/** Function call output item - user provides function result */
export const OpenAIResponsesFunctionCallOutputSchema = z
  .object({
    type: z.literal("function_call_output"),
    call_id: z.string(),
    output: z.string(),
  })
  .passthrough();
export type OpenAIResponsesFunctionCallOutput = Infer<typeof OpenAIResponsesFunctionCallOutputSchema>;

/** Reasoning summary part */
export const OpenAIResponsesReasoningSummarySchema = z
  .object({
    text: z.string(),
    type: z.literal("summary_text"),
  })
  .passthrough();
export type OpenAIResponsesReasoningSummary = Infer<typeof OpenAIResponsesReasoningSummarySchema>;

/** Reasoning item - chain of thought from reasoning models */
export const OpenAIResponsesReasoningSchema = z
  .object({
    type: z.literal("reasoning"),
    summary: z.array(OpenAIResponsesReasoningSummarySchema),
  })
  .passthrough();
export type OpenAIResponsesReasoning = Infer<typeof OpenAIResponsesReasoningSchema>;

/** Generic item schema - catches all other item types (passthrough) */
export const OpenAIResponsesGenericItemSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();
export type OpenAIResponsesGenericItem = Infer<typeof OpenAIResponsesGenericItemSchema>;

/**
 * Union of all item types.
 * Messages are checked first (may not have type field), then specific types, then catch-all.
 */
export const OpenAIResponsesItemSchema = z.union([
  OpenAIResponsesMessageSchema,
  OpenAIResponsesFunctionCallSchema,
  OpenAIResponsesFunctionCallOutputSchema,
  OpenAIResponsesReasoningSchema,
  OpenAIResponsesGenericItemSchema,
]);
export type OpenAIResponsesItem = Infer<typeof OpenAIResponsesItemSchema>;
