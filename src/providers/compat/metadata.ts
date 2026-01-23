/**
 * Compat Provider Metadata Schema
 *
 * Opaque passthrough schema for the Compat provider.
 * Since Compat is a source-only provider used as a fallback,
 * we don't need to define explicit fields - all extra fields
 * are preserved as opaque metadata.
 */

import { z } from "zod";

export const CompatMetadataSchema = z.object({}).passthrough();
export type CompatMetadata = z.infer<typeof CompatMetadataSchema>;
