/**
 * Promptl Metadata
 *
 * This file contains the Zod schemas for the Promptl metadata.
 * Uses passthrough to preserve arbitrary fields like _promptlSourceMap, _sourceData, etc.
 */

import { z } from "zod";

/** Promptl-specific metadata that can be attached to GenAI entities.
 * Uses passthrough to preserve all fields including:
 * - _promptlSourceMap: Source map for the promptl message
 * - _sourceData: Tool source data
 * - toolName: Tool name for tool call responses (legacy)
 * - _isGeneratingToolCall: Flag for streaming tool call generation
 * - Any other provider-specific fields
 */
export const PromptlMetadataSchema = z.object({}).passthrough();
export type PromptlMetadata = z.infer<typeof PromptlMetadataSchema>;
