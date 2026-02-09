/**
 * OpenAI Completions Provider
 *
 * Provider for the OpenAI Chat Completions API message format.
 * This is a source-only provider (no fromGenAI) since OpenAI messages
 * are typically ingested but not produced by this library.
 */

import type { GenAIMessage, GenAIPart } from "$package/core/genai";
import {
  type OpenAICompletionsAssistantMessage,
  type OpenAICompletionsMessage,
  OpenAICompletionsMessageSchema,
  type OpenAICompletionsToolCall,
  type OpenAICompletionsUserContentPart,
} from "$package/providers/openai/completions/schema";
import { Provider, type ProviderSpecification, type ProviderToGenAIArgs } from "$package/providers/provider";
import { extractExtraFields, readMetadata, storeMetadata, withMetadata } from "$package/utils";

export const OpenAICompletionsSpecification = {
  provider: Provider.OpenAICompletions,
  name: "OpenAI Completions",
  messageSchema: OpenAICompletionsMessageSchema,

  toGenAI({ messages, direction }: ProviderToGenAIArgs) {
    // Handle string input - wrap in OpenAI Completions format then fall through
    if (typeof messages === "string") {
      const role = direction === "input" ? "user" : "assistant";
      messages = [{ role, content: messages }];
    }

    // Validate with schema
    const parsedMessages = OpenAICompletionsMessageSchema.array().parse(messages);

    // Convert each message
    const converted: GenAIMessage[] = [];
    for (const message of parsedMessages) {
      converted.push(openAIMessageToGenAI(message));
    }

    return { messages: converted };
  },
} as const satisfies ProviderSpecification<Provider.OpenAICompletions>;

/** Message-level keys that are handled explicitly during conversion (not stored as opaque metadata). */
const KNOWN_MESSAGE_KEYS = [
  "role",
  "content",
  "name",
  "refusal",
  "tool_calls",
  "function_call",
  "tool_call_id",
  "audio",
  "_provider_metadata",
  "_providerMetadata",
];

/** Converts an OpenAI Completions message to a GenAI message. */
function openAIMessageToGenAI(message: OpenAICompletionsMessage): GenAIMessage {
  const extraFields = extractExtraFields(message, KNOWN_MESSAGE_KEYS as (keyof OpenAICompletionsMessage)[]);
  const existingMetadata = readMetadata(message as unknown as Record<string, unknown>);
  const parts: GenAIPart[] = [];

  switch (message.role) {
    case "developer":
    case "system": {
      parts.push(...convertTextContent(message.content));
      const msgMetadata = storeMetadata(existingMetadata, extraFields, {});
      return {
        role: message.role,
        parts,
        ...(message.name ? { name: message.name } : {}),
        ...(msgMetadata ? { _provider_metadata: msgMetadata } : {}),
      };
    }

    case "user": {
      if (typeof message.content === "string") {
        parts.push({ type: "text", content: message.content });
      } else {
        for (const part of message.content) {
          parts.push(...convertUserContentPart(part));
        }
      }
      const msgMetadata = storeMetadata(existingMetadata, extraFields, {});
      return {
        role: "user",
        parts,
        ...(message.name ? { name: message.name } : {}),
        ...(msgMetadata ? { _provider_metadata: msgMetadata } : {}),
      };
    }

    case "assistant": {
      parts.push(...convertAssistantMessage(message));
      // extraFields automatically captures annotations, audio, and any other unknown fields
      const msgMetadata = storeMetadata(existingMetadata, extraFields, {});
      return {
        role: "assistant",
        parts,
        ...(message.name ? { name: message.name } : {}),
        ...(msgMetadata ? { _provider_metadata: msgMetadata } : {}),
      };
    }

    case "tool": {
      const contentParts = convertTextContent(message.content);
      const response =
        contentParts.length === 1 && contentParts[0]?.type === "text"
          ? contentParts[0].content
          : contentParts.map((p) => (p.type === "text" ? p.content : p));

      const partMetadata = storeMetadata(existingMetadata, extraFields, {});
      parts.push({
        type: "tool_call_response",
        id: message.tool_call_id,
        response,
        ...(partMetadata ? { _provider_metadata: partMetadata } : {}),
      });
      return { role: "tool", parts };
    }

    case "function": {
      // Deprecated function messages - preserve function name in known fields for cross-provider access
      const partMetadata = storeMetadata(existingMetadata, extraFields, { toolName: message.name });
      parts.push({
        type: "tool_call_response",
        id: null,
        response: message.content,
        ...(partMetadata ? { _provider_metadata: partMetadata } : {}),
      });
      return { role: "tool", parts };
    }

    default: {
      const unknownMessage = message as { role: string; content?: unknown };
      const msgMetadata = storeMetadata(existingMetadata, extraFields, {});
      return {
        role: unknownMessage.role,
        parts: [{ type: "text", content: JSON.stringify(unknownMessage.content) }],
        ...(msgMetadata ? { _provider_metadata: msgMetadata } : {}),
      };
    }
  }
}

/** Converts string or text array content to GenAI text parts. */
function convertTextContent(content: string | Array<{ type: "text"; text: string }>): GenAIPart[] {
  if (typeof content === "string") {
    return [{ type: "text", content }];
  }
  return content.map((part) => ({ type: "text" as const, content: part.text }));
}

/** Converts a user content part to GenAI parts. */
function convertUserContentPart(part: OpenAICompletionsUserContentPart): GenAIPart[] {
  const existingMetadata = readMetadata(part as unknown as Record<string, unknown>);

  switch (part.type) {
    case "text": {
      const extraFields = extractExtraFields(part, [
        "type",
        "text",
        "_provider_metadata",
        "_providerMetadata",
      ] as (keyof typeof part)[]);
      return [withMetadata({ type: "text", content: part.text }, extraFields)];
    }

    case "image_url": {
      const url = part.image_url.url;
      // Capture unknown fields from both the part and nested image_url object
      const partExtra = extractExtraFields(part, [
        "type",
        "image_url",
        "_provider_metadata",
        "_providerMetadata",
      ] as (keyof typeof part)[]);
      const imageUrlExtra = extractExtraFields(part.image_url, ["url"] as (keyof typeof part.image_url)[]);
      const allExtra = { ...partExtra, ...imageUrlExtra };

      // Check if it's a data URL (base64) or regular URL
      if (url.startsWith("data:")) {
        const match = url.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
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
          uri: url,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "input_audio": {
      const { format, data } = part.input_audio;
      // Capture unknown fields from both the part and nested input_audio object
      const partExtra = extractExtraFields(part, [
        "type",
        "input_audio",
        "_provider_metadata",
        "_providerMetadata",
      ] as (keyof typeof part)[]);
      const audioExtra = extractExtraFields(part.input_audio, ["data", "format"] as (keyof typeof part.input_audio)[]);
      const allExtra = { format, ...partExtra, ...audioExtra };
      const metadata = storeMetadata(existingMetadata, allExtra, {});

      return [
        {
          type: "blob",
          modality: "audio",
          mime_type: format === "wav" ? "audio/wav" : "audio/mp3",
          content: data,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "file": {
      const { file_id, file_data, filename } = part.file;
      // Capture unknown fields from both the part and nested file object
      const partExtra = extractExtraFields(part, [
        "type",
        "file",
        "_provider_metadata",
        "_providerMetadata",
      ] as (keyof typeof part)[]);
      const fileExtra = extractExtraFields(part.file, [
        "file_id",
        "file_data",
        "filename",
      ] as (keyof typeof part.file)[]);
      const allExtra = { ...(filename ? { filename } : {}), ...partExtra, ...fileExtra };
      const metadata = storeMetadata(existingMetadata, allExtra, {});

      if (file_id) {
        return [
          {
            type: "file",
            modality: "document",
            file_id,
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ];
      }
      if (file_data) {
        return [
          {
            type: "blob",
            modality: "document",
            content: file_data,
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ];
      }
      return [
        {
          type: "file",
          modality: "document",
          file_id: "",
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }
  }
}

/** Converts an assistant message's content parts, refusal, and tool calls to GenAI parts. */
function convertAssistantMessage(message: OpenAICompletionsAssistantMessage): GenAIPart[] {
  const parts: GenAIPart[] = [];

  // Handle content (text or refusal parts)
  if (message.content != null) {
    if (typeof message.content === "string") {
      parts.push({ type: "text", content: message.content });
    } else {
      for (const part of message.content) {
        if (part.type === "text") {
          parts.push({ type: "text", content: part.text });
        } else if (part.type === "refusal") {
          // Mark refusal in known fields
          const metadata = storeMetadata(undefined, {}, { isRefusal: true });
          parts.push({
            type: "text",
            content: part.refusal,
            ...(metadata ? { _provider_metadata: metadata } : {}),
          });
        }
      }
    }
  }

  // Handle top-level refusal field - store in known fields
  if (message.refusal) {
    const metadata = storeMetadata(undefined, {}, { isRefusal: true });
    parts.push({
      type: "text",
      content: message.refusal,
      ...(metadata ? { _provider_metadata: metadata } : {}),
    });
  }

  // Handle tool_calls
  if (message.tool_calls?.length) {
    for (const toolCall of message.tool_calls) {
      parts.push(convertToolCall(toolCall));
    }
  }

  // Handle deprecated function_call
  if (message.function_call) {
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(message.function_call.arguments);
    } catch {
      parsedArgs = message.function_call.arguments;
    }
    parts.push({ type: "tool_call", id: null, name: message.function_call.name, arguments: parsedArgs });
  }

  // Handle audio response (convert to blob if data is present)
  // Audio field flows through passthrough, so we access it via cast
  const audio = (message as { audio?: { data?: string } }).audio;
  if (audio && "data" in audio && audio.data) {
    const metadata = storeMetadata(undefined, { audio }, {});
    parts.push({
      type: "blob",
      modality: "audio",
      content: audio.data,
      ...(metadata ? { _provider_metadata: metadata } : {}),
    });
  }

  return parts;
}

/** Converts a tool call to a GenAI tool_call part. */
function convertToolCall(toolCall: OpenAICompletionsToolCall): GenAIPart {
  if (toolCall.type === "function") {
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch {
      parsedArgs = toolCall.function.arguments;
    }
    // No extra metadata needed - the structure is fully captured in GenAI format
    return { type: "tool_call", id: toolCall.id, name: toolCall.function.name, arguments: parsedArgs };
  }

  // Custom tool call - input becomes arguments, no extra metadata needed
  return { type: "tool_call", id: toolCall.id, name: toolCall.custom.name, arguments: toolCall.custom.input };
}
