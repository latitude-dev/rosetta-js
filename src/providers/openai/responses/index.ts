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
import { extractExtraFields } from "$package/utils";

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
const KNOWN_MESSAGE_KEYS = ["type", "role", "content", "id", "status"];
const KNOWN_FUNCTION_CALL_KEYS = ["type", "call_id", "name", "arguments"];
const KNOWN_FUNCTION_OUTPUT_KEYS = ["type", "call_id", "output"];
const KNOWN_REASONING_KEYS = ["type", "summary"];

/** Adds provider metadata if there's any data to store. */
function withMetadata(part: GenAIPart, metadata: Record<string, unknown>): GenAIPart {
  if (Object.keys(metadata).length === 0) return part;
  return { ...part, _provider_metadata: { openai_responses: metadata } };
}

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
  const parts: GenAIPart[] = [];

  // Handle content
  if (typeof message.content === "string") {
    parts.push({ type: "text", content: message.content });
  } else {
    for (const part of message.content) {
      parts.push(...contentPartToGenAI(part));
    }
  }

  return {
    role: message.role,
    parts,
    ...(Object.keys(extraFields).length > 0 ? { _provider_metadata: { openai_responses: extraFields } } : {}),
  };
}

/** Keys used for translation - everything else flows to metadata via extractExtraFields */
const KNOWN_TEXT_KEYS = ["type", "text"];
const KNOWN_IMAGE_KEYS = ["type", "detail", "file_id", "image_url"];
const KNOWN_FILE_KEYS = ["type", "file_data", "file_id"];
const KNOWN_AUDIO_KEYS = ["type", "data", "format"];
const KNOWN_REFUSAL_KEYS = ["type", "refusal"];

/** Converts a content part to GenAI parts. */
function contentPartToGenAI(part: OpenAIResponsesContentPart): GenAIPart[] {
  switch (part.type) {
    case "input_text":
    case "output_text": {
      const extraFields = extractExtraFields(part as Record<string, unknown>, KNOWN_TEXT_KEYS);
      return [withMetadata({ type: "text", content: part.text }, extraFields)];
    }

    case "input_image": {
      const extraFields = extractExtraFields(part as Record<string, unknown>, KNOWN_IMAGE_KEYS);
      // Always include detail in metadata since it's image-specific
      const meta = { detail: part.detail, ...extraFields };

      if (part.image_url) {
        // Check if it's a data URL (base64)
        if (part.image_url.startsWith("data:")) {
          const match = part.image_url.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
          if (match) {
            return [
              withMetadata(
                { type: "blob", modality: "image", mime_type: match[1] || "image/png", content: match[2] || "" },
                meta,
              ),
            ];
          }
        }
        return [withMetadata({ type: "uri", modality: "image", uri: part.image_url }, meta)];
      }

      if (part.file_id) {
        return [withMetadata({ type: "file", modality: "image", file_id: part.file_id }, meta)];
      }

      // No URL or file_id - return empty file reference
      return [withMetadata({ type: "file", modality: "image", file_id: "" }, meta)];
    }

    case "input_file": {
      const extraFields = extractExtraFields(part as Record<string, unknown>, KNOWN_FILE_KEYS);

      if (part.file_data) {
        return [withMetadata({ type: "blob", modality: "document", content: part.file_data }, extraFields)];
      }

      if (part.file_id) {
        return [withMetadata({ type: "file", modality: "document", file_id: part.file_id }, extraFields)];
      }

      return [withMetadata({ type: "file", modality: "document", file_id: "" }, extraFields)];
    }

    case "input_audio": {
      const extraFields = extractExtraFields(part as Record<string, unknown>, KNOWN_AUDIO_KEYS);
      const mimeType = part.format === "wav" ? "audio/wav" : "audio/mp3";
      return [withMetadata({ type: "blob", modality: "audio", mime_type: mimeType, content: part.data }, extraFields)];
    }

    case "refusal": {
      const extraFields = extractExtraFields(part as Record<string, unknown>, KNOWN_REFUSAL_KEYS);
      return [withMetadata({ type: "text", content: part.refusal }, { isRefusal: true, ...extraFields })];
    }

    default: {
      // Unknown content type - preserve as generic part
      const unknownPart = part as { type: string } & Record<string, unknown>;
      return [{ type: unknownPart.type, ...(part as Record<string, unknown>) }];
    }
  }
}

/** Converts a function_call item to GenAI. */
function functionCallToGenAI(item: OpenAIResponsesFunctionCall): GenAIMessage {
  const extraFields = extractExtraFields(item, KNOWN_FUNCTION_CALL_KEYS as (keyof OpenAIResponsesFunctionCall)[]);

  // Parse arguments JSON
  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(item.arguments);
  } catch {
    parsedArgs = item.arguments;
  }

  const toolCallPart: GenAIPart = {
    type: "tool_call",
    id: item.call_id,
    name: item.name,
    arguments: parsedArgs,
  };

  return {
    role: "assistant",
    parts: [withMetadata(toolCallPart, extraFields)],
  };
}

/** Converts a function_call_output item to GenAI. */
function functionCallOutputToGenAI(item: OpenAIResponsesFunctionCallOutput): GenAIMessage {
  const extraFields = extractExtraFields(
    item,
    KNOWN_FUNCTION_OUTPUT_KEYS as (keyof OpenAIResponsesFunctionCallOutput)[],
  );

  // Try to parse output as JSON
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(item.output);
  } catch {
    parsedOutput = item.output;
  }

  const responsePart: GenAIPart = {
    type: "tool_call_response",
    id: item.call_id,
    response: parsedOutput,
  };

  return {
    role: "tool",
    parts: [withMetadata(responsePart, extraFields)],
  };
}

/** Converts a reasoning item to GenAI. */
function reasoningToGenAI(item: OpenAIResponsesReasoning): GenAIMessage {
  const extraFields = extractExtraFields(item, KNOWN_REASONING_KEYS as (keyof OpenAIResponsesReasoning)[]);
  const parts: GenAIPart[] = [];

  // Convert each summary to a reasoning part
  for (const summary of item.summary) {
    parts.push({ type: "reasoning", content: summary.text });
  }

  // Add extra fields (id, encrypted_content, status, etc.) to first part's metadata
  const firstPart = parts[0];
  if (Object.keys(extraFields).length > 0 && firstPart) {
    parts[0] = withMetadata(firstPart, extraFields);
  }

  return {
    role: "assistant",
    parts,
    ...(parts.length === 0 && Object.keys(extraFields).length > 0
      ? { _provider_metadata: { openai_responses: extraFields } }
      : {}),
  };
}

/** Converts any other item type to a GenAI message with a generic part. */
function genericItemToGenAI(item: OpenAIResponsesItem): GenAIMessage {
  const itemType = "type" in item ? (item.type as string) : "unknown";

  // Determine role based on item type
  const outputTypes = ["computer_call_output", "local_shell_call_output", "function_call_output"];
  const role = outputTypes.includes(itemType) ? "tool" : "assistant";

  // Create a generic part preserving all item data
  const genericPart: GenAIPart = {
    type: itemType,
    _provider_metadata: { openai_responses: item },
  };

  return {
    role,
    parts: [genericPart],
  };
}
