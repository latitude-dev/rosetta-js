/**
 * GenAI Unified Schema
 *
 * This module contains all Zod schemas and inferred types for the GenAI message format,
 * which serves as the intermediate format for translating between LLM providers.
 */

import { z } from "zod";
import { ProviderMetadataSchema } from "$package/providers/metadata";

/** Role of the entity that created the message. */
export const GenAIRoleSchema = z.enum(["system", "user", "assistant", "tool"]);
export type GenAIRole = z.infer<typeof GenAIRoleSchema>;

/** General modality of attached data. */
export const GenAIModalitySchema = z.enum(["image", "video", "audio"]);
export type GenAIModality = z.infer<typeof GenAIModalitySchema>;

/** Reason for finishing the generation (for output messages). */
export const GenAIFinishReasonSchema = z.enum(["stop", "length", "content_filter", "tool_call", "error"]);
export type GenAIFinishReason = z.infer<typeof GenAIFinishReasonSchema>;

/** Represents text content sent to or received from the model. */
export const GenAITextPartSchema = z
  .object({
    type: z.literal("text"),
    content: z.string(),
    _provider_metadata: ProviderMetadataSchema.optional(),
  })
  .passthrough();
export type GenAITextPart = z.infer<typeof GenAITextPartSchema>;

/** Represents blob binary data sent inline to the model. Content is base64 encoded. */
export const GenAIBlobPartSchema = z
  .object({
    type: z.literal("blob"),
    mime_type: z.string().nullable().optional(),
    modality: z.union([GenAIModalitySchema, z.string()]),
    content: z.string(),
    _provider_metadata: ProviderMetadataSchema.optional(),
  })
  .passthrough();
export type GenAIBlobPart = z.infer<typeof GenAIBlobPartSchema>;

/** Represents an external referenced file sent to the model by file id. */
export const GenAIFilePartSchema = z
  .object({
    type: z.literal("file"),
    mime_type: z.string().nullable().optional(),
    modality: z.union([GenAIModalitySchema, z.string()]),
    file_id: z.string(),
    _provider_metadata: ProviderMetadataSchema.optional(),
  })
  .passthrough();
export type GenAIFilePart = z.infer<typeof GenAIFilePartSchema>;

/** Represents an external referenced file sent to the model by URI. */
export const GenAIUriPartSchema = z
  .object({
    type: z.literal("uri"),
    mime_type: z.string().nullable().optional(),
    modality: z.union([GenAIModalitySchema, z.string()]),
    uri: z.string(),
    _provider_metadata: ProviderMetadataSchema.optional(),
  })
  .passthrough();
export type GenAIUriPart = z.infer<typeof GenAIUriPartSchema>;

/** Represents reasoning/thinking content received from the model. */
export const GenAIReasoningPartSchema = z
  .object({
    type: z.literal("reasoning"),
    content: z.string(),
    _provider_metadata: ProviderMetadataSchema.optional(),
  })
  .passthrough();
export type GenAIReasoningPart = z.infer<typeof GenAIReasoningPartSchema>;

/** Represents a tool call requested by the model. */
export const GenAIToolCallRequestPartSchema = z
  .object({
    type: z.literal("tool_call"),
    id: z.string().nullable().optional(),
    name: z.string(),
    arguments: z.unknown().optional(),
    _provider_metadata: ProviderMetadataSchema.optional(),
  })
  .passthrough();
export type GenAIToolCallRequestPart = z.infer<typeof GenAIToolCallRequestPartSchema>;

/** Represents a tool call result sent to the model or a built-in tool call outcome. */
export const GenAIToolCallResponsePartSchema = z
  .object({
    type: z.literal("tool_call_response"),
    id: z.string().nullable().optional(),
    response: z.unknown(),
    _provider_metadata: ProviderMetadataSchema.optional(),
  })
  .passthrough();
export type GenAIToolCallResponsePart = z.infer<typeof GenAIToolCallResponsePartSchema>;

/** Represents an arbitrary message part with any type and properties. */
export const GenAIGenericPartSchema = z
  .object({
    type: z.string(),
    _provider_metadata: ProviderMetadataSchema.optional(),
  })
  .passthrough();
export type GenAIGenericPart = z.infer<typeof GenAIGenericPartSchema>;

/** Union of all part types. */
export const GenAIPartSchema = z.union([
  GenAITextPartSchema,
  GenAIBlobPartSchema,
  GenAIFilePartSchema,
  GenAIUriPartSchema,
  GenAIReasoningPartSchema,
  GenAIToolCallRequestPartSchema,
  GenAIToolCallResponsePartSchema,
  GenAIGenericPartSchema,
]);
export type GenAIPart = z.infer<typeof GenAIPartSchema>;

/** Represents a chat message in the GenAI format. */
export const GenAIMessageSchema = z
  .object({
    role: z.union([GenAIRoleSchema, z.string()]),
    parts: z.array(GenAIPartSchema),
    name: z.string().nullable().optional(),
    finish_reason: z.union([GenAIFinishReasonSchema, z.string()]).optional(),
    _provider_metadata: ProviderMetadataSchema.optional(),
  })
  .passthrough();
export type GenAIMessage = z.infer<typeof GenAIMessageSchema>;

/** Represents system instructions as an array of parts. */
export const GenAISystemSchema = z.array(GenAIPartSchema);
export type GenAISystem = z.infer<typeof GenAISystemSchema>;
