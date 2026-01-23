/**
 * Provider Inference Logic
 *
 * Provides functionality to automatically detect which LLM provider
 * a message array belongs to based on schema validation.
 */

import type { InputMessages, InputSystem } from "$package/core/input";
import { getProviderSpecification, Provider } from "$package/providers";

/**
 * Default priority order for provider inference.
 * When multiple providers could match a message format, the first matching
 * provider in this list is returned.
 */
export const DEFAULT_INFER_PRIORITY: Provider[] = [
  Provider.OpenAICompletions,
  Provider.OpenAIResponses,
  Provider.Anthropic,
  Provider.Google,
  Provider.VercelAI,
  Provider.GenAI,
  Provider.Promptl,
  Provider.Compat,
];

/**
 * Infer the provider from an array of messages.
 *
 * Tries to match the messages against each provider's schema in priority order.
 * If no match is found, returns Provider.Compat as a universal fallback.
 *
 * @param messages - The messages to analyze
 * @param system - The optional system instructions to analyze
 * @param priority - Priority order for matching (defaults to DEFAULT_INFER_PRIORITY)
 * @returns The inferred provider (never throws, always returns a provider)
 */
export function inferProvider(
  messages: InputMessages,
  system?: InputSystem,
  priority: Provider[] = DEFAULT_INFER_PRIORITY,
): Provider {
  // String input is trivially valid for any provider
  if (typeof messages === "string") {
    return priority[0] ?? Provider.Compat;
  }

  // Try to match messages against each provider's schema
  if (messages.length > 0) {
    for (const provider of priority) {
      const spec = getProviderSpecification(provider);
      const result = spec?.messageSchema.array().safeParse(messages);
      if (result?.success) return provider;
    }
  }

  // String system is trivially valid for any provider
  if (typeof system === "string") {
    return priority[0] ?? Provider.Compat;
  }

  // Try to match system against each provider's schema
  if (system !== undefined) {
    for (const provider of priority) {
      const spec = getProviderSpecification(provider);
      const result = spec?.systemSchema?.safeParse(system);
      if (result?.success) return provider;
    }
  }

  // Fallback to Compat for best-effort conversion of unknown formats
  return Provider.Compat;
}
