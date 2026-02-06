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
import {
  applyMetadataMode,
  getKnownFields,
  getPartsMetadata,
  type ProviderMetadataMode,
  readMetadata,
  storeMetadata,
} from "$package/utils";

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
      const partsByIndex = groupPartsByMessageIndex(parsedSystem);

      if (partsByIndex) {
        // Insert system messages at their original positions (lowest index first).
        // Ascending order is correct because messageIndex refers to the position in the full
        // conversation (including system messages). As we insert left-to-right, each insertion
        // naturally shifts subsequent positions to account for the added messages.
        const sortedIndices = [...partsByIndex.keys()].sort((a, b) => a - b);
        for (const index of sortedIndices) {
          // biome-ignore lint/style/noNonNullAssertion: key comes from the map
          const parts = partsByIndex.get(index)!;
          // Clamp to valid range: -1 (no index) and 0 both go to position 0
          const insertAt = index < 0 ? 0 : Math.min(index, parsedMessages.length);
          parsedMessages.splice(insertAt, 0, { role: "system", parts });
        }
      } else {
        // No parts have messageIndex - fall back to prepending all as one system message
        parsedMessages.unshift({ role: "system", parts: parsedSystem });
      }
    }

    return { messages: parsedMessages };
  },

  fromGenAI({ messages, providerMetadata }: ProviderFromGenAIArgs) {
    const system: GenAISystem = [];
    const filtered: GenAIMessage[] = [];

    for (let i = 0; i < messages.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: index is within bounds
      const message = messages[i]!;
      // Apply metadata mode to message and its parts (handles _partsMetadata restoration)
      const transformed = applyMetadataModeToGenAIMessage(message, providerMetadata);

      if (message.role === "system") {
        // Store the original message index on each part so the position can be reconstructed
        for (const part of transformed.parts) {
          system.push(storeMessageIndexOnPart(part, i));
        }
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

/** Store the original message index on a system part via _provider_metadata._known_fields. */
function storeMessageIndexOnPart(part: GenAIPart, index: number): GenAIPart {
  const existingMetadata = readMetadata(part as unknown as Record<string, unknown>);
  const metadata = storeMetadata(existingMetadata ?? {}, {}, { messageIndex: index });
  if (!metadata) return part;
  return { ...part, _provider_metadata: metadata };
}

/**
 * Groups system parts by their messageIndex known field.
 * Returns a Map from index to parts array, or null if no parts have a messageIndex.
 */
function groupPartsByMessageIndex(parts: GenAIPart[]): Map<number, GenAIPart[]> | null {
  let hasAnyIndex = false;
  const grouped = new Map<number, GenAIPart[]>();

  for (const part of parts) {
    const metadata = readMetadata(part as unknown as Record<string, unknown>);
    const known = getKnownFields(metadata);

    if (known.messageIndex !== undefined) {
      hasAnyIndex = true;
      const idx = known.messageIndex;
      const existing = grouped.get(idx);
      if (existing) {
        existing.push(part);
      } else {
        grouped.set(idx, [part]);
      }
    } else {
      // Parts without an index go into a group keyed by -1 (will be prepended)
      const existing = grouped.get(-1);
      if (existing) {
        existing.push(part);
      } else {
        grouped.set(-1, [part]);
      }
    }
  }

  return hasAnyIndex ? grouped : null;
}
