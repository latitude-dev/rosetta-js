/**
 * OpenAI Completions Metadata Schema
 *
 * For source-only providers, metadata is treated as opaque passthrough data.
 * We don't need to explicitly define fields since we're not converting back
 * to this format - just preserving any extra data for potential downstream use.
 */

import { z } from "zod";

/** Metadata schema for OpenAI Completions provider - opaque passthrough */
export const OpenAICompletionsMetadataSchema = z.object({}).passthrough();
export type OpenAICompletionsMetadata = z.infer<typeof OpenAICompletionsMetadataSchema>;
