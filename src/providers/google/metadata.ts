/**
 * Google Gemini Provider Metadata
 *
 * Opaque passthrough schema for source-only provider.
 * No explicit fields needed since we only convert TO GenAI.
 */

import { z } from "zod";

export const GoogleMetadataSchema = z.object({}).passthrough();
export type GoogleMetadata = z.infer<typeof GoogleMetadataSchema>;
