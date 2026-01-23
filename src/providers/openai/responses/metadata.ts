/**
 * OpenAI Responses Metadata Schema
 *
 * Opaque passthrough schema for source-only provider.
 * All unknown fields are preserved as-is during conversion.
 */

import { z } from "zod";

export const OpenAIResponsesMetadataSchema = z.object({}).passthrough();
export type OpenAIResponsesMetadata = z.infer<typeof OpenAIResponsesMetadataSchema>;
