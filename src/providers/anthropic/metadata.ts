/**
 * Anthropic Provider Metadata Schema
 *
 * Opaque passthrough metadata for the Anthropic provider.
 * This is a source-only provider, so we only need to preserve
 * unknown fields for potential downstream use.
 */

import { z } from "zod";

export const AnthropicMetadataSchema = z.object({}).passthrough();
export type AnthropicMetadata = z.infer<typeof AnthropicMetadataSchema>;
