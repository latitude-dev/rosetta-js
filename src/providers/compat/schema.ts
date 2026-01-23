/**
 * Compat Provider Schemas
 *
 * Permissive schemas that accept any object structure.
 * The Compat provider is designed as a universal fallback
 * that can handle messages from any LLM provider format.
 */

import { z } from "zod";

/**
 * Permissive message schema that accepts any object.
 * The Compat provider will attempt to extract role, content,
 * and other common fields from whatever structure is provided.
 */
export const CompatMessageSchema = z.object({}).passthrough();
export type CompatMessage = z.infer<typeof CompatMessageSchema>;

/**
 * Permissive system instruction schema.
 * Accepts string, single object, or array of objects.
 */
export const CompatSystemSchema = z.union([
  z.string(),
  z.object({}).passthrough(),
  z.array(z.object({}).passthrough()),
]);
export type CompatSystem = z.infer<typeof CompatSystemSchema>;
