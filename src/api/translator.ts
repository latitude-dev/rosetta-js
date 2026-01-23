/**
 * Translator Class
 *
 * The main API for translating messages between LLM providers.
 */

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
import type { Voided } from "$package/utils";

/** Configuration options for creating a Translator instance. */
export type TranslatorConfig = {
  /**
   * Priority order when inferring the source provider.
   * If not provided, uses DEFAULT_INFER_PRIORITY.
   * Cannot be empty if provided.
   */
  inferPriority?: Provider[];
};

/** Options for the translate/safeTranslate methods. */
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
 * Translator class for converting messages between LLM providers.
 *
 * @example
 * ```typescript
 * const translator = new Translator();
 *
 * // Auto-detect source, convert to GenAI
 * const result = translator.translate(messages);
 *
 * // Specify source and target
 * const result = translator.translate(messages, { from: Provider.OpenAI, to: Provider.Anthropic });
 * ```
 */
export class Translator {
  private readonly inferPriority: Provider[];

  constructor(config: TranslatorConfig = {}) {
    if (config.inferPriority !== undefined && config.inferPriority.length === 0) {
      throw new Error("Infer priority list cannot be empty if provided");
    }
    this.inferPriority = config.inferPriority ?? DEFAULT_INFER_PRIORITY;
  }

  /**
   * Translate messages from one provider format to another.
   *
   * @param messages - The messages to translate (string or array of provider messages)
   * @param options - Translation options (from, to, system). All optional.
   * @returns The translated messages and optional system instructions
   * @throws Error if translation fails
   */
  translate<From extends ProviderSource = Provider, To extends ProviderTarget = Provider.GenAI>(
    messages: InputMessages,
    options: TranslateOptions<From, To> = {},
  ): TranslateResult<To> {
    const from = options.from ?? (inferProvider(messages, options.system, this.inferPriority) as From);
    const to = options.to ?? (Provider.GenAI as To);
    const system = options.system;
    const direction = options.direction ?? "input";

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

    // Get target provider specification
    const targetSpec = getProviderSpecification(to);
    if (!targetSpec?.fromGenAI) {
      throw new Error(`Translating to provider "${to}" is not supported`);
    }

    // Convert from GenAI to target format
    const converted = targetSpec.fromGenAI({ messages: genai.messages, direction });

    return { messages: converted.messages, system: converted.system };
  }

  /**
   * Safely translate messages, returning an error object instead of throwing.
   *
   * @param messages - The messages to translate (string or array of provider messages)
   * @param options - Translation options (from, to, system). All optional.
   * @returns An object with either error or (messages and optional system)
   */
  safeTranslate<From extends ProviderSource = Provider, To extends ProviderTarget = Provider.GenAI>(
    messages: InputMessages,
    options: TranslateOptions<From, To> = {},
  ): SafeTranslateResult<To> {
    try {
      return this.translate(messages, options);
    } catch (error) {
      return { error: error as Error };
    }
  }
}

/** Default translator instance used by the exported functions. */
const _default = new Translator();

/**
 * Translate messages from one provider format to another.
 * Uses the default Translator instance.
 */
export function translate<From extends ProviderSource = Provider, To extends ProviderTarget = Provider.GenAI>(
  messages: InputMessages,
  options: TranslateOptions<From, To> = {},
): TranslateResult<To> {
  return _default.translate(messages, options);
}

/**
 * Safely translate messages, returning an error object instead of throwing.
 * Uses the default Translator instance.
 */
export function safeTranslate<From extends ProviderSource = Provider, To extends ProviderTarget = Provider.GenAI>(
  messages: InputMessages,
  options: TranslateOptions<From, To> = {},
): SafeTranslateResult<To> {
  return _default.safeTranslate(messages, options);
}
