/**
 * Provider Metadata Schema
 *
 * Separated into its own file to avoid circular dependencies between
 * providers/index.ts and core/genai/index.ts.
 *
 * Provider-specific metadata schemas are in their respective provider folders
 * (e.g., promptl/metadata.ts) and imported here for typed access.
 */

import { z } from "zod";
import { AnthropicMetadataSchema } from "$package/providers/anthropic/metadata";
import { CompatMetadataSchema } from "$package/providers/compat/metadata";
import { GoogleMetadataSchema } from "$package/providers/google/metadata";
import { OpenAICompletionsMetadataSchema } from "$package/providers/openai/completions/metadata";
import { OpenAIResponsesMetadataSchema } from "$package/providers/openai/responses/metadata";
import { PromptlMetadataSchema } from "$package/providers/promptl/metadata";
import { VercelAIMetadataSchema } from "$package/providers/vercelai/metadata";

/**
 * Provider metadata extension for preserving provider-specific data.
 * This is included on ALL GenAI entities (parts, messages) to scope metadata
 * to the related entity, enabling lossless round-trips between providers.
 */
export const ProviderMetadataSchema = z.object({
  genai: z.never().optional(),
  promptl: PromptlMetadataSchema.optional(),
  openai_completions: OpenAICompletionsMetadataSchema.optional(),
  openai_responses: OpenAIResponsesMetadataSchema.optional(),
  anthropic: AnthropicMetadataSchema.optional(),
  google: GoogleMetadataSchema.optional(),
  vercel_ai: VercelAIMetadataSchema.optional(),
  compat: CompatMetadataSchema.optional(),
});
