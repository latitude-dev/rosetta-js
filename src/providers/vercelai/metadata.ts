/**
 * VercelAI Metadata Schema
 *
 * Opaque passthrough schema for preserving VercelAI-specific data during translation.
 */

import { z } from "zod";

export const VercelAIMetadataSchema = z.object({}).passthrough();
export type VercelAIMetadata = z.infer<typeof VercelAIMetadataSchema>;
