/**
 * Provider Specifications Registry
 *
 * Separated into its own file to avoid circular dependencies.
 */

import { AnthropicSpecification } from "$package/providers/anthropic";
import { CompatSpecification } from "$package/providers/compat";
import { GenAISpecification } from "$package/providers/genai";
import { GoogleSpecification } from "$package/providers/google";
import { OpenAICompletionsSpecification } from "$package/providers/openai/completions";
import { OpenAIResponsesSpecification } from "$package/providers/openai/responses";
import { PromptlSpecification } from "$package/providers/promptl";
import { Provider, type ProviderSpecification } from "$package/providers/provider";
import { VercelAISpecification } from "$package/providers/vercelai";

/** Registry of all provider specifications. */
const PROVIDER_SPECIFICATIONS = {
  [Provider.GenAI]: GenAISpecification,
  [Provider.Promptl]: PromptlSpecification,
  [Provider.OpenAICompletions]: OpenAICompletionsSpecification,
  [Provider.OpenAIResponses]: OpenAIResponsesSpecification,
  [Provider.Anthropic]: AnthropicSpecification,
  [Provider.Google]: GoogleSpecification,
  [Provider.VercelAI]: VercelAISpecification,
  [Provider.Compat]: CompatSpecification,
} as const satisfies {
  [P in Provider]: ProviderSpecification<P>;
};
type ProviderSpecifications = typeof PROVIDER_SPECIFICATIONS;

/**
 * Union of providers that can be used as translation sources.
 * Currently all providers support being a source (they all have `toGenAI`).
 */
// biome-ignore format: preserve conditional type formatting for readability
export type ProviderSource = {
  [P in Provider]: "toGenAI" extends keyof ProviderSpecifications[P] ? P : never;
}[Provider];

/**
 * Union of providers that have a `fromGenAI` function defined.
 * These are the only providers that can be used as translation targets.
 */
// biome-ignore format: preserve conditional type formatting for readability
export type ProviderTarget = {
  [P in Provider]: "fromGenAI" extends keyof ProviderSpecifications[P] ? P : never;
}[Provider];

export function getProviderSpecification<P extends Provider>(provider: P): ProviderSpecification<P> | undefined {
  return PROVIDER_SPECIFICATIONS[provider] as unknown as ProviderSpecification<P> | undefined;
}
