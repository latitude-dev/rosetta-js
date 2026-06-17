/**
 * Translation API
 *
 * The main API for translating messages between LLM providers.
 */

import type { GenAIMessage } from "$package/core/genai";
import { DEFAULT_INFER_PRIORITY, inferProvider } from "$package/core/infer";
import type { InputMessages, InputSystem } from "$package/core/input";
import {
  getProviderSpecification,
  Provider,
  type ProviderMessage,
  type ProviderSource,
  type ProviderSystem,
  type ProviderTarget,
} from "$package/providers";
import type { ProviderMetadataMode, Voided } from "$package/utils";

/** Options for the translate/safeTranslate functions. */
export type TranslateOptions<From extends ProviderSource = Provider, To extends ProviderTarget = Provider.GenAI> = {
  /** The source provider format. If not provided, will try to infer from messages. */
  from?: From;

  /** The target provider format. Defaults to Provider.GenAI. */
  to?: To;

  /** Optional system instructions for providers that separate them from messages. */
  system?: InputSystem;

  /**
   * Optional direction of the messages for translation.
   *
   * Controls how the messages are interpreted and transformed by the providers.
   * - "input": Messages are provided as input to a model (e.g., user prompt), usually the default and most common.
   * - "output": Messages are interpreted as model output (e.g., assistant response).
   * This can affect how provider adapters interpret roles, system prompts, etc.
   * If not specified, defaults to "input".
   */
  direction?: "input" | "output";

  /**
   * Priority order when inferring the source provider.
   * If not provided, uses DEFAULT_INFER_PRIORITY.
   * Cannot be empty if provided.
   */
  inferPriority?: Provider[];

  /**
   * Whether to filter out empty messages during translation.
   *
   * When true, messages that have no meaningful content are removed from the output:
   * - It has no parts, OR
   * - All parts are empty text parts (empty or whitespace-only)
   *
   * Messages with any non-text parts (tool_call, reasoning, blob, etc.) are always kept.
   * This is useful for cleaning up conversation history before sending to an LLM.
   *
   * @default false
   */
  filterEmptyMessages?: boolean;

  /**
   * How to handle provider metadata during translation.
   *
   * - "strip": No extra fields or metadata field in output. Known fields are still used internally.
   * - "preserve" (default): Add metadata field to output entities. Fields stay inside the metadata field.
   * - "passthrough": Spread all extra fields as direct properties on output entities.
   *
   * Note: When translating from and to the same provider, this is automatically
   * set to "passthrough" to ensure lossless round-trips.
   *
   * @default "preserve"
   */
  providerMetadata?: ProviderMetadataMode;
};

/** Result of a successful translate operation. */
export type TranslateResult<To extends ProviderTarget> = {
  /** The translated messages in the target provider format. */
  messages: ProviderMessage<To>[];

  /** The translated system instructions (if the target provider supports them). */
  system?: ProviderSystem<To>;
};

/**
 * Result of a safeTranslate operation.
 * Either error is defined (and messages is undefined), or messages is defined (and error is undefined).
 */
export type SafeTranslateResult<To extends ProviderTarget> =
  | (TranslateResult<To> & { error?: undefined })
  | ({ error: Error } & Voided<TranslateResult<To>>);

/**
 * Filters out empty messages from GenAI messages.
 * A message is considered empty if:
 * - It has no parts, OR
 * - All parts are empty text parts (empty or whitespace-only)
 *
 * Messages with any non-text parts (tool_call, reasoning, blob, etc.) are always kept.
 */
function filterEmptyGenAIMessages(messages: GenAIMessage[]): GenAIMessage[] {
  return messages.filter((message) => {
    // Empty if no parts
    if (message.parts.length === 0) {
      return false;
    }

    // Check if all parts are empty text parts
    const allEmptyText = message.parts.every((part) => {
      if (part.type === "text") {
        const content = (part as { content: string }).content;
        return !content || content.trim() === "";
      }
      // Non-text parts (tool_call, reasoning, blob, etc.) count as non-empty
      return false;
    });

    // Keep if not all empty text
    return !allEmptyText;
  });
}

/**
 * Translate messages from one provider format to another.
 *
 * @param messages - The messages to translate (string, a single, or an array of provider messages)
 * @param options - Translation options. All optional.
 * @returns The translated messages and optional system instructions
 * @throws Error if translation fails
 *
 * @example
 * ```typescript
 * // Auto-detect source, convert to GenAI
 * const result = translate(messages);
 *
 * // Specify source and target
 * const result = translate(messages, { from: Provider.OpenAICompletions, to: Provider.GenAI });
 *
 * // With filtering and metadata options
 * const result = translate(messages, { filterEmptyMessages: true, providerMetadata: "strip" });
 * ```
 */
export function translate<From extends ProviderSource = Provider, To extends ProviderTarget = Provider.GenAI>(
  messages: InputMessages,
  options: TranslateOptions<From, To> = {},
): TranslateResult<To> {
  if (options.inferPriority !== undefined && options.inferPriority.length === 0) {
    throw new Error("Infer priority list cannot be empty if provided");
  }

  const inferPriority = options.inferPriority ?? DEFAULT_INFER_PRIORITY;
  const filterEmptyMessages = options.filterEmptyMessages ?? false;
  const from = options.from ?? (inferProvider(messages, options.system, inferPriority) as From);
  const to = options.to ?? (Provider.GenAI as To);
  const system = options.system;
  const direction = options.direction ?? "input";
  const providerMetadata = // Auto-passthrough for same-provider translations to ensure lossless round-trips
    (from as string) === (to as string) ? "passthrough" : (options.providerMetadata ?? "preserve");

  // Get source provider specification
  const sourceSpec = getProviderSpecification(from);
  if (!sourceSpec?.toGenAI) {
    throw new Error(`Translating from provider "${from}" is not supported`);
  }

  if (system && !sourceSpec.systemSchema) {
    throw new Error(`Provider "${from}" does not support separated system instructions`);
  }

  // Convert to GenAI format (provider's toGenAI validates input with Zod)
  const genai = sourceSpec.toGenAI({ messages, system, direction });

  // Filter empty messages at the GenAI intermediate level (if enabled)
  const filteredMessages = filterEmptyMessages ? filterEmptyGenAIMessages(genai.messages) : genai.messages;

  // Get target provider specification
  const targetSpec = getProviderSpecification(to);
  if (!targetSpec?.fromGenAI) {
    throw new Error(`Translating to provider "${to}" is not supported`);
  }

  // Convert from GenAI to target format
  const converted = targetSpec.fromGenAI({ messages: filteredMessages, direction, providerMetadata });

  return { messages: converted.messages, system: converted.system };
}

/**
 * Safely translate messages, returning an error object instead of throwing.
 *
 * @param messages - The messages to translate (string, a single, or an array of provider messages)
 * @param options - Translation options. All optional.
 * @returns An object with either error or (messages and optional system)
 */
export function safeTranslate<From extends ProviderSource = Provider, To extends ProviderTarget = Provider.GenAI>(
  messages: InputMessages,
  options: TranslateOptions<From, To> = {},
): SafeTranslateResult<To> {
  try {
    return translate(messages, options);
  } catch (error) {
    return { error: error as Error };
  }
}
