/**
 * GenAI Provider
 *
 * The core provider that uses the GenAI message format.
 * This is the intermediate format used for translation between providers.
 */

import { type GenAIMessage, GenAIMessageSchema, type GenAISystem, GenAISystemSchema } from "$package/core/genai";
import {
  Provider,
  type ProviderFromGenAIArgs,
  type ProviderSpecification,
  type ProviderToGenAIArgs,
} from "$package/providers/provider";

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

  fromGenAI({ messages }: ProviderFromGenAIArgs) {
    const system: GenAISystem = [];
    const filtered: GenAIMessage[] = [];

    for (const message of messages) {
      if (message.role === "system") system.push(...message.parts);
      else filtered.push(message);
    }

    return { messages: filtered, system: system.length > 0 ? system : undefined };
  },
} as const satisfies ProviderSpecification<Provider.GenAI>;
