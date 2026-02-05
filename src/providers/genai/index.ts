/**
 * GenAI Provider
 *
 * The core provider that uses the GenAI message format.
 * This is the intermediate format used for translation between providers.
 */

import {
  type GenAIMessage,
  GenAIMessageSchema,
  type GenAIPart,
  type GenAISystem,
  GenAISystemSchema,
} from "$package/core/genai";
import {
  Provider,
  type ProviderFromGenAIArgs,
  type ProviderSpecification,
  type ProviderToGenAIArgs,
} from "$package/providers/provider";
import { applyMetadataMode, getPartsMetadata, type ProviderMetadataMode, readMetadata } from "$package/utils";

export const GenAISpecification = {
  provider: Provider.GenAI,
  name: "GenAI",
  messageSchema: GenAIMessageSchema,
  systemSchema: GenAISystemSchema,

  toGenAI({ messages, system, direction }: ProviderToGenAIArgs) {
    if (typeof messages === "string") {
      const role = direction === "input" ? "user" : "assistant";
      messages = [{ role, parts: [{ type: "text", content: messages }] }];
    }
    const parsedMessages = GenAIMessageSchema.array().parse(messages);

    if (typeof system === "string") {
      system = [{ type: "text", content: system }];
    } else if (system !== undefined && !Array.isArray(system)) {
      system = [system];
    }
    const parsedSystem = GenAISystemSchema.optional().parse(system);

    if (parsedSystem && parsedSystem.length > 0) {
      parsedMessages.unshift({ role: "system", parts: parsedSystem });
    }

    return { messages: parsedMessages };
  },

  fromGenAI({ messages, providerMetadata }: ProviderFromGenAIArgs) {
    const system: GenAISystem = [];
    const filtered: GenAIMessage[] = [];

    for (const message of messages) {
      // Apply metadata mode to message and its parts (handles _partsMetadata restoration)
      const transformed = applyMetadataModeToGenAIMessage(message, providerMetadata);

      if (message.role === "system") {
        system.push(...transformed.parts);
      } else {
        filtered.push(transformed);
      }
    }

    return { messages: filtered, system: system.length > 0 ? system : undefined };
  },
} as const satisfies ProviderSpecification<Provider.GenAI>;

/** Apply metadata mode to a GenAI part (uses snake_case for GenAI) */
function applyMetadataModeToGenAI(part: GenAIPart, mode: ProviderMetadataMode): GenAIPart {
  const metadata = readMetadata(part as unknown as Record<string, unknown>);
  // Remove existing metadata keys before applying mode
  const { _provider_metadata, _providerMetadata, ...basePart } = part as GenAIPart & {
    _provider_metadata?: unknown;
    _providerMetadata?: unknown;
  };
  return applyMetadataMode(basePart as GenAIPart, metadata, mode, false);
}

/** Apply metadata mode to a GenAI message and its parts */
function applyMetadataModeToGenAIMessage(message: GenAIMessage, mode: ProviderMetadataMode): GenAIMessage {
  const msgMetadata = readMetadata(message as unknown as Record<string, unknown>);
  const transformedParts = message.parts.map((part) => applyMetadataModeToGenAI(part, mode));

  // Extract _partsMetadata from message metadata and apply to first part
  // This restores part-level metadata that was merged when converting to string content
  const partsMetadata = getPartsMetadata(msgMetadata);
  if (partsMetadata && transformedParts.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: length check guarantees element exists
    transformedParts[0] = applyMetadataMode(transformedParts[0]!, partsMetadata, mode, false);
  }

  // Remove existing metadata keys before applying mode
  const { _provider_metadata, _providerMetadata, parts, ...baseMessage } = message as GenAIMessage & {
    _provider_metadata?: unknown;
    _providerMetadata?: unknown;
  };
  const baseWithParts = { ...baseMessage, parts: transformedParts };

  return applyMetadataMode(baseWithParts, msgMetadata, mode, false);
}
