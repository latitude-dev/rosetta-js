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
 *
 * The schema has two types of fields:
 *
 * 1. **Root-level shared fields** (camelCase): Cross-provider semantic data that
 *    target providers can read without knowing about source providers. These enable
 *    lossless translation of semantically important data like tool names and error states.
 *
 * 2. **Provider-specific slots** (snake_case): Data for same-provider round-trips only.
 *    Target providers should NEVER read from other provider's slots - this violates
 *    provider isolation.
 */
export const ProviderMetadataSchema = z.object({
  // Root-level shared fields for cross-provider semantic data (camelCase)
  /** Tool name for tool_call_response parts (GenAI schema doesn't include it) */
  toolName: z.string().optional(),
  /** Error indicator for tool results or other error states */
  isError: z.boolean().optional(),
  /** Refusal indicator for assistant refusal content */
  isRefusal: z.boolean().optional(),
  /** Original type when mapping to a different GenAI type (for lossy conversions) */
  originalType: z.string().optional(),

  // Provider-specific slots for same-provider round-trips only (snake_case)
  genai: z.never().optional(),
  promptl: PromptlMetadataSchema.optional(),
  openai_completions: OpenAICompletionsMetadataSchema.optional(),
  openai_responses: OpenAIResponsesMetadataSchema.optional(),
  anthropic: AnthropicMetadataSchema.optional(),
  google: GoogleMetadataSchema.optional(),
  vercel_ai: VercelAIMetadataSchema.optional(),
  compat: CompatMetadataSchema.optional(),
});
