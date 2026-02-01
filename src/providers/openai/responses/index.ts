/**
 * OpenAI Responses Provider
 *
 * Provider for the OpenAI Responses API message format.
 * This is a source-only provider (no fromGenAI) since OpenAI Responses
 * items are typically ingested but not produced by this library.
 */

import type { GenAIMessage, GenAIPart } from "$package/core/genai";
import {
  type OpenAIResponsesContentPart,
  type OpenAIResponsesFunctionCall,
  type OpenAIResponsesFunctionCallOutput,
  type OpenAIResponsesItem,
  OpenAIResponsesItemSchema,
  type OpenAIResponsesMessage,
  type OpenAIResponsesReasoning,
} from "$package/providers/openai/responses/schema";
import { Provider, type ProviderSpecification, type ProviderToGenAIArgs } from "$package/providers/provider";
import { extractExtraFields, readMetadata, storeMetadata, withMetadata } from "$package/utils";

export const OpenAIResponsesSpecification = {
  provider: Provider.OpenAIResponses,
  name: "OpenAI Responses",
  messageSchema: OpenAIResponsesItemSchema,

  toGenAI({ messages, direction }: ProviderToGenAIArgs) {
    // Handle string input
    if (typeof messages === "string") {
      const role = direction === "input" ? "user" : "assistant";
      return {
        messages: [{ role, parts: [{ type: "text" as const, content: messages }] }],
      };
    }

    // Validate with schema
    const parsedItems = OpenAIResponsesItemSchema.array().parse(messages);

    // Convert each item
    const converted: GenAIMessage[] = [];
    for (const item of parsedItems) {
      converted.push(itemToGenAI(item));
    }

    return { messages: converted };
  },
} as const satisfies ProviderSpecification<Provider.OpenAIResponses>;

/** Message-level keys that are handled explicitly during conversion. */
const KNOWN_MESSAGE_KEYS = ["type", "role", "content", "id", "status", "_provider_metadata", "_providerMetadata"];
const KNOWN_FUNCTION_CALL_KEYS = ["type", "call_id", "name", "arguments", "_provider_metadata", "_providerMetadata"];
const KNOWN_FUNCTION_OUTPUT_KEYS = ["type", "call_id", "output", "_provider_metadata", "_providerMetadata"];
const KNOWN_REASONING_KEYS = ["type", "summary", "_provider_metadata", "_providerMetadata"];

/** Converts an OpenAI Responses item to a GenAI message. */
function itemToGenAI(item: OpenAIResponsesItem): GenAIMessage {
  // Check for message item (has role field, type is optional or 'message')
  if ("role" in item && (!("type" in item) || item.type === "message")) {
    return messageToGenAI(item as OpenAIResponsesMessage);
  }

  // Check for function_call
  if ("type" in item && item.type === "function_call") {
    return functionCallToGenAI(item as OpenAIResponsesFunctionCall);
  }

  // Check for function_call_output
  if ("type" in item && item.type === "function_call_output") {
    return functionCallOutputToGenAI(item as OpenAIResponsesFunctionCallOutput);
  }

  // Check for reasoning
  if ("type" in item && item.type === "reasoning") {
    return reasoningToGenAI(item as OpenAIResponsesReasoning);
  }

  // All other items: convert to generic part, preserving full data
  return genericItemToGenAI(item);
}

/** Converts a message item to GenAI. */
function messageToGenAI(message: OpenAIResponsesMessage): GenAIMessage {
  const extraFields = extractExtraFields(message, KNOWN_MESSAGE_KEYS as (keyof OpenAIResponsesMessage)[]);
  const existingMetadata = readMetadata(message as unknown as Record<string, unknown>);
  const parts: GenAIPart[] = [];

  // Handle content
  if (typeof message.content === "string") {
    parts.push({ type: "text", content: message.content });
  } else {
    for (const part of message.content) {
      parts.push(...contentPartToGenAI(part));
    }
  }

  const msgMetadata = storeMetadata(existingMetadata, extraFields, {});

  return {
    role: message.role,
    parts,
    ...(msgMetadata ? { _provider_metadata: msgMetadata } : {}),
  };
}

/** Keys used for translation - everything else flows to metadata via extractExtraFields */
const KNOWN_TEXT_KEYS = ["type", "text", "_provider_metadata", "_providerMetadata"];
const KNOWN_IMAGE_KEYS = ["type", "detail", "file_id", "image_url", "_provider_metadata", "_providerMetadata"];
const KNOWN_FILE_KEYS = ["type", "file_data", "file_id", "_provider_metadata", "_providerMetadata"];
const KNOWN_AUDIO_KEYS = ["type", "data", "format", "_provider_metadata", "_providerMetadata"];
const KNOWN_REFUSAL_KEYS = ["type", "refusal", "_provider_metadata", "_providerMetadata"];

/** Converts a content part to GenAI parts. */
function contentPartToGenAI(part: OpenAIResponsesContentPart): GenAIPart[] {
  const existingMetadata = readMetadata(part as unknown as Record<string, unknown>);

  switch (part.type) {
    case "input_text":
    case "output_text": {
      const extraFields = extractExtraFields(part as Record<string, unknown>, KNOWN_TEXT_KEYS);
      return [withMetadata({ type: "text", content: part.text }, extraFields)];
    }

    case "input_image": {
      const extraFields = extractExtraFields(part as Record<string, unknown>, KNOWN_IMAGE_KEYS);
      // Always include detail in extra fields since it's image-specific
      const allExtra = { detail: part.detail, ...extraFields };

      if (part.image_url) {
        // Check if it's a data URL (base64)
        if (part.image_url.startsWith("data:")) {
          const match = part.image_url.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
          if (match) {
            const metadata = storeMetadata(existingMetadata, allExtra, {});
            return [
              {
                type: "blob",
                modality: "image",
                mime_type: match[1] || "image/png",
                content: match[2] || "",
                ...(metadata ? { _provider_metadata: metadata } : {}),
              },
            ];
          }
        }
        const metadata = storeMetadata(existingMetadata, allExtra, {});
        return [
          {
            type: "uri",
            modality: "image",
            uri: part.image_url,
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ];
      }

      if (part.file_id) {
        const metadata = storeMetadata(existingMetadata, allExtra, {});
        return [
          {
            type: "file",
            modality: "image",
            file_id: part.file_id,
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ];
      }

      // No URL or file_id - return empty file reference
      const metadata = storeMetadata(existingMetadata, allExtra, {});
      return [
        {
          type: "file",
          modality: "image",
          file_id: "",
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "input_file": {
      const extraFields = extractExtraFields(part as Record<string, unknown>, KNOWN_FILE_KEYS);

      if (part.file_data) {
        const metadata = storeMetadata(existingMetadata, extraFields, {});
        return [
          {
            type: "blob",
            modality: "document",
            content: part.file_data,
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ];
      }

      if (part.file_id) {
        const metadata = storeMetadata(existingMetadata, extraFields, {});
        return [
          {
            type: "file",
            modality: "document",
            file_id: part.file_id,
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ];
      }

      const metadata = storeMetadata(existingMetadata, extraFields, {});
      return [
        {
          type: "file",
          modality: "document",
          file_id: "",
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "input_audio": {
      const extraFields = extractExtraFields(part as Record<string, unknown>, KNOWN_AUDIO_KEYS);
      const mimeType = part.format === "wav" ? "audio/wav" : "audio/mp3";
      const metadata = storeMetadata(existingMetadata, extraFields, {});
      return [
        {
          type: "blob",
          modality: "audio",
          mime_type: mimeType,
          content: part.data,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "refusal": {
      const extraFields = extractExtraFields(part as Record<string, unknown>, KNOWN_REFUSAL_KEYS);
      // Store isRefusal in known fields
      const metadata = storeMetadata(existingMetadata, extraFields, { isRefusal: true });
      return [
        {
          type: "text",
          content: part.refusal,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    default: {
      // Unknown content type - preserve as generic part
      const unknownPart = part as { type: string } & Record<string, unknown>;
      const { _provider_metadata, _providerMetadata, ...restPart } = unknownPart;
      // restPart already includes `type`, no need to add it again
      return [restPart as GenAIPart];
    }
  }
}

/** Converts a function_call item to GenAI. */
function functionCallToGenAI(item: OpenAIResponsesFunctionCall): GenAIMessage {
  const extraFields = extractExtraFields(item, KNOWN_FUNCTION_CALL_KEYS as (keyof OpenAIResponsesFunctionCall)[]);
  const existingMetadata = readMetadata(item as unknown as Record<string, unknown>);

  // Parse arguments JSON
  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(item.arguments);
  } catch {
    parsedArgs = item.arguments;
  }

  const metadata = storeMetadata(existingMetadata, extraFields, {});
  const toolCallPart: GenAIPart = {
    type: "tool_call",
    id: item.call_id,
    name: item.name,
    arguments: parsedArgs,
    ...(metadata ? { _provider_metadata: metadata } : {}),
  };

  return {
    role: "assistant",
    parts: [toolCallPart],
  };
}

/** Converts a function_call_output item to GenAI. */
function functionCallOutputToGenAI(item: OpenAIResponsesFunctionCallOutput): GenAIMessage {
  const extraFields = extractExtraFields(
    item,
    KNOWN_FUNCTION_OUTPUT_KEYS as (keyof OpenAIResponsesFunctionCallOutput)[],
  );
  const existingMetadata = readMetadata(item as unknown as Record<string, unknown>);

  // Try to parse output as JSON
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(item.output);
  } catch {
    parsedOutput = item.output;
  }

  const metadata = storeMetadata(existingMetadata, extraFields, {});
  const responsePart: GenAIPart = {
    type: "tool_call_response",
    id: item.call_id,
    response: parsedOutput,
    ...(metadata ? { _provider_metadata: metadata } : {}),
  };

  return {
    role: "tool",
    parts: [responsePart],
  };
}

/** Converts a reasoning item to GenAI. */
function reasoningToGenAI(item: OpenAIResponsesReasoning): GenAIMessage {
  const extraFields = extractExtraFields(item, KNOWN_REASONING_KEYS as (keyof OpenAIResponsesReasoning)[]);
  const existingMetadata = readMetadata(item as unknown as Record<string, unknown>);
  const parts: GenAIPart[] = [];

  // Convert each summary to a reasoning part
  for (let i = 0; i < item.summary.length; i++) {
    const summary = item.summary[i];
    if (!summary) continue;
    // Add extra fields to first part's metadata
    if (i === 0 && (Object.keys(extraFields).length > 0 || existingMetadata)) {
      const metadata = storeMetadata(existingMetadata, extraFields, {});
      parts.push({
        type: "reasoning",
        content: summary.text,
        ...(metadata ? { _provider_metadata: metadata } : {}),
      });
    } else {
      parts.push({ type: "reasoning", content: summary.text });
    }
  }

  const msgMetadata = parts.length === 0 ? storeMetadata(existingMetadata, extraFields, {}) : undefined;

  return {
    role: "assistant",
    parts,
    ...(msgMetadata ? { _provider_metadata: msgMetadata } : {}),
  };
}

/** Converts any other item type to a GenAI message with a generic part. */
function genericItemToGenAI(item: OpenAIResponsesItem): GenAIMessage {
  const itemType = "type" in item ? (item.type as string) : "unknown";

  // Determine role based on item type
  const outputTypes = ["computer_call_output", "local_shell_call_output", "function_call_output"];
  const role = outputTypes.includes(itemType) ? "tool" : "assistant";

  // Create a generic part preserving all item data (flattened, not nested under provider)
  const genericPart: GenAIPart = {
    type: itemType,
    _provider_metadata: item as Record<string, unknown>,
  };

  return {
    role,
    parts: [genericPart],
  };
}
