/**
 * OpenAI Completions API Message Schemas
 *
 * Zod schemas for the OpenAI Completions API message format.
 * This is a unified schema that handles both request and response messages.
 * Only fields and entities used for GenAI translation are explicitly defined.
 * All other fields and entities flow through via .passthrough() to provider metadata.
 */

import { z } from "zod";
import type { Infer } from "$package/utils";

/** Text content part */
export const OpenAICompletionsTextPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
  })
  .passthrough();
export type OpenAICompletionsTextPart = Infer<typeof OpenAICompletionsTextPartSchema>;

/** Refusal content part (assistant only) */
export const OpenAICompletionsRefusalPartSchema = z
  .object({
    type: z.literal("refusal"),
    refusal: z.string(),
  })
  .passthrough();
export type OpenAICompletionsRefusalPart = Infer<typeof OpenAICompletionsRefusalPartSchema>;

/** Image URL content part (user only) */
export const OpenAICompletionsImageUrlPartSchema = z
  .object({
    type: z.literal("image_url"),
    image_url: z
      .object({
        url: z.string(),
        detail: z.enum(["auto", "low", "high"]).optional(),
      })
      .passthrough(),
  })
  .passthrough();
export type OpenAICompletionsImageUrlPart = Infer<typeof OpenAICompletionsImageUrlPartSchema>;

/** Input audio content part (user only) */
export const OpenAICompletionsInputAudioPartSchema = z
  .object({
    type: z.literal("input_audio"),
    input_audio: z
      .object({
        data: z.string(),
        format: z.enum(["wav", "mp3"]),
      })
      .passthrough(),
  })
  .passthrough();
export type OpenAICompletionsInputAudioPart = Infer<typeof OpenAICompletionsInputAudioPartSchema>;

/** File content part (user only) */
export const OpenAICompletionsFilePartSchema = z
  .object({
    type: z.literal("file"),
    file: z
      .object({
        filename: z.string().optional(),
        file_data: z.string().optional(),
        file_id: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();
export type OpenAICompletionsFilePart = Infer<typeof OpenAICompletionsFilePartSchema>;

/** Content parts for user messages */
export const OpenAICompletionsUserContentPartSchema = z.discriminatedUnion("type", [
  OpenAICompletionsTextPartSchema,
  OpenAICompletionsImageUrlPartSchema,
  OpenAICompletionsInputAudioPartSchema,
  OpenAICompletionsFilePartSchema,
]);
export type OpenAICompletionsUserContentPart = Infer<typeof OpenAICompletionsUserContentPartSchema>;

/** Content parts for assistant messages */
export const OpenAICompletionsAssistantContentPartSchema = z.discriminatedUnion("type", [
  OpenAICompletionsTextPartSchema,
  OpenAICompletionsRefusalPartSchema,
]);
export type OpenAICompletionsAssistantContentPart = Infer<typeof OpenAICompletionsAssistantContentPartSchema>;

/** Function tool call */
export const OpenAICompletionsFunctionToolCallSchema = z
  .object({
    id: z.string(),
    type: z.literal("function"),
    function: z
      .object({
        name: z.string(),
        arguments: z.string(),
      })
      .passthrough(),
  })
  .passthrough();
export type OpenAICompletionsFunctionToolCall = Infer<typeof OpenAICompletionsFunctionToolCallSchema>;

/** Custom tool call */
export const OpenAICompletionsCustomToolCallSchema = z
  .object({
    id: z.string(),
    type: z.literal("custom"),
    custom: z
      .object({
        name: z.string(),
        input: z.string(),
      })
      .passthrough(),
  })
  .passthrough();
export type OpenAICompletionsCustomToolCall = Infer<typeof OpenAICompletionsCustomToolCallSchema>;

/** Any tool call */
export const OpenAICompletionsToolCallSchema = z.discriminatedUnion("type", [
  OpenAICompletionsFunctionToolCallSchema,
  OpenAICompletionsCustomToolCallSchema,
]);
export type OpenAICompletionsToolCall = Infer<typeof OpenAICompletionsToolCallSchema>;

/** Deprecated function call (replaced by tool_calls) */
export const OpenAICompletionsFunctionCallSchema = z
  .object({
    name: z.string(),
    arguments: z.string(),
  })
  .passthrough();
export type OpenAICompletionsFunctionCall = Infer<typeof OpenAICompletionsFunctionCallSchema>;

/** Developer message */
export const OpenAICompletionsDeveloperMessageSchema = z
  .object({
    role: z.literal("developer"),
    content: z.union([z.string(), z.array(OpenAICompletionsTextPartSchema).min(1)]),
    name: z.string().optional(),
  })
  .passthrough();
export type OpenAICompletionsDeveloperMessage = Infer<typeof OpenAICompletionsDeveloperMessageSchema>;

/** System message */
export const OpenAICompletionsSystemMessageSchema = z
  .object({
    role: z.literal("system"),
    content: z.union([z.string(), z.array(OpenAICompletionsTextPartSchema).min(1)]),
    name: z.string().optional(),
  })
  .passthrough();
export type OpenAICompletionsSystemMessage = Infer<typeof OpenAICompletionsSystemMessageSchema>;

/** User message */
export const OpenAICompletionsUserMessageSchema = z
  .object({
    role: z.literal("user"),
    content: z.union([z.string(), z.array(OpenAICompletionsUserContentPartSchema).min(1)]),
    name: z.string().optional(),
  })
  .passthrough();
export type OpenAICompletionsUserMessage = Infer<typeof OpenAICompletionsUserMessageSchema>;

/**
 * Assistant message (unified for request and response) */
export const OpenAICompletionsAssistantMessageSchema = z
  .object({
    role: z.literal("assistant"),
    content: z
      .union([z.string(), z.array(OpenAICompletionsAssistantContentPartSchema).min(1)])
      .nullable()
      .optional(),
    refusal: z.string().nullable().optional(),
    name: z.string().optional(),
    tool_calls: z.array(OpenAICompletionsToolCallSchema).optional(),
    function_call: OpenAICompletionsFunctionCallSchema.nullable().optional(),
  })
  .passthrough();
export type OpenAICompletionsAssistantMessage = Infer<typeof OpenAICompletionsAssistantMessageSchema>;

/** Tool message */
export const OpenAICompletionsToolMessageSchema = z
  .object({
    role: z.literal("tool"),
    content: z.union([z.string(), z.array(OpenAICompletionsTextPartSchema).min(1)]),
    tool_call_id: z.string(),
  })
  .passthrough();
export type OpenAICompletionsToolMessage = Infer<typeof OpenAICompletionsToolMessageSchema>;

/** Function message (deprecated) */
export const OpenAICompletionsFunctionMessageSchema = z
  .object({
    role: z.literal("function"),
    content: z.string().nullable(),
    name: z.string(),
  })
  .passthrough();
export type OpenAICompletionsFunctionMessage = Infer<typeof OpenAICompletionsFunctionMessageSchema>;

/** Union of all message types */
export const OpenAICompletionsMessageSchema = z.discriminatedUnion("role", [
  OpenAICompletionsDeveloperMessageSchema,
  OpenAICompletionsSystemMessageSchema,
  OpenAICompletionsUserMessageSchema,
  OpenAICompletionsAssistantMessageSchema,
  OpenAICompletionsToolMessageSchema,
  OpenAICompletionsFunctionMessageSchema,
]);
export type OpenAICompletionsMessage = Infer<typeof OpenAICompletionsMessageSchema>;
