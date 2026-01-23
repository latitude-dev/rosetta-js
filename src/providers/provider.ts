/**
 * Provider Types
 *
 * Contains the Provider enum and related types.
 * Separated to avoid circular dependencies.
 */

import type { z } from "zod";
import type { GenAIMessage, GenAISystem } from "$package/core/genai";
import type { InputMessages, InputSystem } from "$package/core/input";
import type { AnthropicMetadata } from "$package/providers/anthropic/metadata";
import type { AnthropicMessage, AnthropicSystem } from "$package/providers/anthropic/schema";
import type { CompatMetadata } from "$package/providers/compat/metadata";
import type { CompatMessage, CompatSystem } from "$package/providers/compat/schema";
import type { GoogleMetadata } from "$package/providers/google/metadata";
import type { GoogleContent, GoogleSystem } from "$package/providers/google/schema";
import type { OpenAICompletionsMetadata } from "$package/providers/openai/completions/metadata";
import type { OpenAICompletionsMessage } from "$package/providers/openai/completions/schema";
import type { OpenAIResponsesMetadata } from "$package/providers/openai/responses/metadata";
import type { OpenAIResponsesItem } from "$package/providers/openai/responses/schema";
import type { PromptlMetadata } from "$package/providers/promptl/metadata";
import type { PromptlMessage } from "$package/providers/promptl/schema";
import type { VercelAIMetadata } from "$package/providers/vercelai/metadata";
import type { VercelAIMessage } from "$package/providers/vercelai/schema";

/** Enum of all supported providers. */
export enum Provider {
  GenAI = "genai",
  Promptl = "promptl",
  OpenAICompletions = "openai_completions",
  OpenAIResponses = "openai_responses",
  Anthropic = "anthropic",
  Google = "google",
  VercelAI = "vercel_ai",
  Compat = "compat",
}

/**
 * Maps each Provider to its message type.
 * This will be extended as providers are implemented.
 */
// biome-ignore format: preserve conditional type formatting for readability
export type ProviderMessage<P extends Provider> =
  P extends Provider.GenAI ? GenAIMessage :
  P extends Provider.Promptl ? PromptlMessage :
  P extends Provider.OpenAICompletions ? OpenAICompletionsMessage :
  P extends Provider.OpenAIResponses ? OpenAIResponsesItem :
  P extends Provider.Anthropic ? AnthropicMessage :
  P extends Provider.Google ? GoogleContent :
  P extends Provider.VercelAI ? VercelAIMessage :
  P extends Provider.Compat ? CompatMessage :
  never;

/**
 * Maps each Provider to its system type.
 * Some providers don't separate system from messages.
 */
// biome-ignore format: preserve conditional type formatting for readability
export type ProviderSystem<P extends Provider> =
  P extends Provider.GenAI ? GenAISystem :
  P extends Provider.Promptl ? never :
  P extends Provider.OpenAICompletions ? never :
  P extends Provider.OpenAIResponses ? never :
  P extends Provider.Anthropic ? AnthropicSystem :
  P extends Provider.Google ? GoogleSystem :
  P extends Provider.VercelAI ? never :
  P extends Provider.Compat ? CompatSystem :
  never;

/**
 * Maps each Provider to its metadata type.
 * Each provider can store arbitrary metadata in its designated field.
 */
// biome-ignore format: preserve conditional type formatting for readability
export type ProviderMetadata<P extends Provider> =
  P extends Provider.GenAI ? never :
  P extends Provider.Promptl ? PromptlMetadata :
  P extends Provider.OpenAICompletions ? OpenAICompletionsMetadata :
  P extends Provider.OpenAIResponses ? OpenAIResponsesMetadata :
  P extends Provider.Anthropic ? AnthropicMetadata :
  P extends Provider.Google ? GoogleMetadata :
  P extends Provider.VercelAI ? VercelAIMetadata :
  P extends Provider.Compat ? CompatMetadata :
  never;

/**
 * Arguments for converting provider messages TO GenAI format.
 *
 * @property messages - The input messages to convert (string or array of provider messages).
 * @property system - Optional separated system instructions (string, single object, or array of parts).
 * @property direction - Whether the translation is for "input" (user → assistant) or "output" (assistant → user).
 */
export type ProviderToGenAIArgs = {
  messages: InputMessages;
  system?: InputSystem;
  direction: "input" | "output";
};

/**
 * Arguments for converting FROM GenAI format to provider format.
 *
 * @property messages - The input messages in GenAI format.
 * @property direction - Whether converting for "input" (user → assistant) or "output" (assistant → user).
 */
export type ProviderFromGenAIArgs = {
  messages: GenAIMessage[];
  direction: "input" | "output";
};

/**
 * Specification for an LLM provider adapter.
 * Each provider must implement toGenAI, and optionally fromGenAI.
 */
export type ProviderSpecification<P extends Provider> = {
  /** The provider enum value */
  provider: P;

  /** Human-readable name for error messages */
  name: string;

  /** Zod schema for validating provider messages */
  messageSchema: z.ZodType<ProviderMessage<P>>;

  /** Zod schema for validating provider system instructions (if supported) */
  systemSchema?: z.ZodType<ProviderSystem<P>>;

  /**
   * Convert provider messages TO GenAI format.
   * This is always required - all providers must support ingestion.
   */
  toGenAI(args: ProviderToGenAIArgs): {
    messages: GenAIMessage[];
  };

  /**
   * Convert FROM GenAI format to provider messages.
   * This is optional - not all providers support output conversion.
   */
  fromGenAI?(args: ProviderFromGenAIArgs): {
    messages: ProviderMessage<P>[];
    system?: ProviderSystem<P>;
  };
};
