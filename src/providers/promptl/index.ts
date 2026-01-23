/**
 * Promptl Provider
 *
 * The provider that uses the Promptl message format.
 * This is the format used in Latitude.
 */

import type { GenAIMessage, GenAIPart } from "$package/core/genai";
import type { PromptlMetadata } from "$package/providers/promptl/metadata";
import {
  type PromptlAssistantMessage,
  type PromptlContent,
  type PromptlMessage,
  PromptlMessageSchema,
  type PromptlToolCall,
} from "$package/providers/promptl/schema";
import {
  Provider,
  type ProviderFromGenAIArgs,
  type ProviderSpecification,
  type ProviderToGenAIArgs,
} from "$package/providers/provider";
import { extractExtraFields, isUrlString } from "$package/utils";

export const PromptlSpecification = {
  provider: Provider.Promptl,
  name: "Promptl",
  messageSchema: PromptlMessageSchema,

  toGenAI({ messages, direction }: ProviderToGenAIArgs) {
    if (typeof messages === "string") {
      const role = direction === "input" ? "user" : "assistant";
      messages = [{ role, content: [{ type: "text", text: messages }] }];
    }

    // Normalize string content to array content for compatibility with promptl library output
    // The library outputs messages with string content, but our schema expects arrays
    const normalized = messages.map((msg) => {
      const m = msg as { role: string; content: unknown };
      if (typeof m.content === "string") {
        return { ...m, content: [{ type: "text", text: m.content }] };
      }
      return m;
    });

    const parsedMessages = PromptlMessageSchema.array().parse(normalized);

    const converted: GenAIMessage[] = [];
    for (const message of parsedMessages) {
      converted.push(promptlMessageToGenAI(message));
    }

    return { messages: converted };
  },

  fromGenAI({ messages }: ProviderFromGenAIArgs) {
    // Build a lookup map from tool call id to tool name from all tool_call parts
    const toolCallNameMap = buildToolCallNameMap(messages);

    const converted: PromptlMessage[] = [];
    for (const message of messages) {
      converted.push(...genAIMessageToPromptl(message, toolCallNameMap));
    }

    return { messages: converted };
  },
} as const satisfies ProviderSpecification<Provider.Promptl>;

/** Builds a map from tool call id to tool name from all messages. */
function buildToolCallNameMap(messages: GenAIMessage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "tool_call") {
        // Type assertion needed because GenAIGenericPartSchema's `type: z.string()` overlaps with literal types,
        // preventing TypeScript from properly narrowing the union. At runtime, this is correctly a tool_call part.
        const id = part.id as string | null | undefined;
        const name = part.name as string | undefined;
        if (typeof id === "string" && id && name) {
          map.set(id, name);
        }
      }
    }
  }
  return map;
}

/** Get tool arguments from a tool-call content, supporting both `args` and `toolArguments` for backwards compatibility. */
function getToolArguments(content: {
  args?: Record<string, unknown>;
  toolArguments?: Record<string, unknown>;
}): Record<string, unknown> {
  // Prefer `args` (new), fall back to `toolArguments` (legacy)
  return content.args ?? content.toolArguments ?? {};
}

/** Converts a Promptl content part to GenAI parts. */
function promptlContentToGenAI(content: PromptlContent): GenAIPart[] {
  // Only include fields that are explicitly converted to GenAI fields.
  // Content-type-specific metadata fields (id, isStreaming, isError) are NOT included
  // so they flow automatically to extraFields and get preserved in metadata.
  const knownContentKeys = [
    "type",
    "text",
    "image",
    "file",
    "mimeType",
    "toolCallId",
    "toolName",
    "args",
    "toolArguments",
    "data",
    "result",
  ];
  const extraFields = extractExtraFields(content, knownContentKeys as (keyof PromptlContent)[]);

  const metadata: PromptlMetadata = extraFields;
  const hasMetadata = Object.keys(metadata).length > 0;

  switch (content.type) {
    case "text":
      return [
        {
          type: "text",
          content: content.text ?? "",
          ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
        },
      ];

    case "image": {
      const imageValue = content.image;
      if (imageValue instanceof URL) {
        return [
          {
            type: "uri",
            modality: "image",
            uri: imageValue.toString(),
            ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
          },
        ];
      }
      if (imageValue instanceof ArrayBuffer) {
        const base64 = btoa(String.fromCharCode(...new Uint8Array(imageValue)));
        return [
          {
            type: "blob",
            modality: "image",
            content: base64,
            ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
          },
        ];
      }
      if (imageValue instanceof Uint8Array) {
        const base64 = btoa(String.fromCharCode(...imageValue));
        return [
          {
            type: "blob",
            modality: "image",
            content: base64,
            ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
          },
        ];
      }
      // String: could be URL or base64
      if (isUrlString(imageValue)) {
        return [
          {
            type: "uri",
            modality: "image",
            uri: imageValue,
            ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
          },
        ];
      }
      return [
        {
          type: "blob",
          modality: "image",
          content: imageValue,
          ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
        },
      ];
    }

    case "file": {
      const fileValue = content.file;
      const mimeType = content.mimeType;
      // Infer modality from mimeType
      let modality: string = "document";
      if (mimeType.startsWith("image/")) modality = "image";
      else if (mimeType.startsWith("video/")) modality = "video";
      else if (mimeType.startsWith("audio/")) modality = "audio";

      if (fileValue instanceof URL) {
        return [
          {
            type: "uri",
            modality,
            mime_type: mimeType,
            uri: fileValue.toString(),
            ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
          },
        ];
      }
      if (fileValue instanceof ArrayBuffer) {
        const base64 = btoa(String.fromCharCode(...new Uint8Array(fileValue)));
        return [
          {
            type: "blob",
            modality,
            mime_type: mimeType,
            content: base64,
            ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
          },
        ];
      }
      if (fileValue instanceof Uint8Array) {
        const base64 = btoa(String.fromCharCode(...fileValue));
        return [
          {
            type: "blob",
            modality,
            mime_type: mimeType,
            content: base64,
            ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
          },
        ];
      }
      // String: could be URL or base64
      if (isUrlString(fileValue)) {
        return [
          {
            type: "uri",
            modality,
            mime_type: mimeType,
            uri: fileValue,
            ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
          },
        ];
      }
      return [
        {
          type: "blob",
          modality,
          mime_type: mimeType,
          content: fileValue,
          ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
        },
      ];
    }

    case "reasoning":
      // id and isStreaming are automatically in metadata via extraFields
      return [
        {
          type: "reasoning",
          content: content.text,
          ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
        },
      ];

    case "redacted-reasoning":
      // Store redacted reasoning as a generic part with the data preserved
      return [
        {
          type: "redacted-reasoning",
          content: content.data,
          ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
        },
      ];

    case "tool-call":
      return [
        {
          type: "tool_call",
          id: content.toolCallId,
          name: content.toolName,
          arguments: getToolArguments(content),
          ...(hasMetadata ? { _provider_metadata: { promptl: metadata } } : {}),
        },
      ];

    case "tool-result":
      // isError is automatically in metadata via extraFields
      return [
        {
          type: "tool_call_response",
          id: content.toolCallId,
          response: content.result,
          _provider_metadata: {
            promptl: {
              toolName: content.toolName,
              ...metadata,
            },
          },
        },
      ];
  }
}

/** Converts a Promptl ToolCall (from toolCalls array) to a GenAI tool_call part. */
function promptlToolCallToGenAI(toolCall: PromptlToolCall): GenAIPart {
  const knownKeys = ["id", "name", "arguments"];
  const extraFields = extractExtraFields(toolCall, knownKeys as (keyof PromptlToolCall)[]);
  const hasMetadata = Object.keys(extraFields).length > 0;

  return {
    type: "tool_call",
    id: toolCall.id,
    name: toolCall.name,
    arguments: toolCall.arguments,
    ...(hasMetadata ? { _provider_metadata: { promptl: extraFields } } : {}),
  };
}

/** Converts a Promptl message to a GenAI message. */
function promptlMessageToGenAI(message: PromptlMessage): GenAIMessage {
  const knownMessageKeys = ["role", "content", "name", "toolName", "toolId", "toolCalls"];
  const extraFields = extractExtraFields(message, knownMessageKeys as (keyof PromptlMessage)[]);

  // GenAI accepts any string role, so we pass the Promptl role directly
  const genAIRole = message.role;

  // Convert content parts
  const parts: GenAIPart[] = [];

  if (message.role === "assistant") {
    const assistantMessage = message as PromptlAssistantMessage;

    // Handle string content
    if (typeof assistantMessage.content === "string") {
      parts.push({ type: "text", content: assistantMessage.content });
    } else {
      for (const content of assistantMessage.content) {
        parts.push(...promptlContentToGenAI(content));
      }
    }

    // Handle toolCalls array (separate from content)
    if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
      for (const toolCall of assistantMessage.toolCalls) {
        parts.push(promptlToolCallToGenAI(toolCall));
      }
    }
  } else if (message.role === "tool") {
    // Check if this is the legacy format (toolName/toolId at message level)
    // or the new format (tool-result in content)
    const hasLegacyFields = "toolName" in message && message.toolName && "toolId" in message && message.toolId;
    const hasToolResultContent = message.content.some((c) => c.type === "tool-result");

    if (hasLegacyFields && !hasToolResultContent) {
      // Legacy format: wrap content in a tool_call_response
      const contentParts: GenAIPart[] = [];
      for (const content of message.content) {
        contentParts.push(...promptlContentToGenAI(content));
      }
      // If single text part, use its content directly as response; otherwise use array
      let response: unknown;
      if (contentParts.length === 1 && contentParts[0]?.type === "text") {
        response = contentParts[0].content;
      } else {
        response = contentParts;
      }

      parts.push({
        type: "tool_call_response",
        id: message.toolId,
        response,
        _provider_metadata: {
          promptl: {
            toolName: message.toolName,
            ...extraFields,
          },
        },
      });
    } else {
      // New format: tool-result content items become tool_call_response parts
      for (const content of message.content) {
        parts.push(...promptlContentToGenAI(content));
      }
    }
  } else {
    // Handle string content (from promptl library) or array content
    const content = message.content;
    if (typeof content === "string") {
      parts.push({ type: "text", content });
    } else {
      for (const c of content) {
        parts.push(...promptlContentToGenAI(c));
      }
    }
  }

  // Build metadata for message level
  const hasMessageMetadata = Object.keys(extraFields).length > 0;

  return {
    role: genAIRole,
    parts,
    ...(message.role === "user" && message.name ? { name: message.name } : {}),
    ...(hasMessageMetadata && message.role !== "tool" ? { _provider_metadata: { promptl: extraFields } } : {}),
  };
}

/** Converts a GenAI part to Promptl content. */
function genAIPartToPromptl(part: GenAIPart): PromptlContent | null {
  const extraFromMeta = part._provider_metadata?.promptl ?? {};

  switch (part.type) {
    case "text":
      return {
        type: "text",
        text: part.content,
        ...extraFromMeta,
      } as PromptlContent;

    case "blob": {
      if (part.modality === "image") {
        return {
          type: "image",
          image: part.content, // base64 string
          ...extraFromMeta,
        } as PromptlContent;
      }
      // Other modalities become file
      return {
        type: "file",
        file: part.content,
        mimeType: part.mime_type ?? `application/${part.modality}`,
        ...extraFromMeta,
      } as PromptlContent;
    }

    case "uri": {
      if (part.modality === "image") {
        return {
          type: "image",
          image: part.uri,
          ...extraFromMeta,
        } as PromptlContent;
      }
      // Other modalities become file
      return {
        type: "file",
        file: part.uri,
        mimeType: part.mime_type ?? `application/${part.modality}`,
        ...extraFromMeta,
      } as PromptlContent;
    }

    case "file":
      // GenAI file (by file_id) - convert to file with id as content
      return {
        type: "file",
        file: part.file_id,
        mimeType: part.mime_type ?? `application/${part.modality}`,
        ...extraFromMeta,
      } as PromptlContent;

    case "tool_call": {
      // Include both `args` and `toolArguments` for backwards compatibility
      const args = (part.arguments as Record<string, unknown>) ?? {};
      return {
        type: "tool-call",
        toolCallId: part.id ?? "",
        toolName: part.name,
        args,
        toolArguments: args,
        ...extraFromMeta,
      } as PromptlContent;
    }

    case "tool_call_response":
      // This is handled at the message level for tool role
      return null;

    case "reasoning":
      // Convert to Promptl reasoning content
      return {
        type: "reasoning",
        text: part.content,
        ...extraFromMeta,
      } as PromptlContent;

    default:
      // Check for redacted-reasoning (custom type)
      if (part.type === "redacted-reasoning" && "content" in part) {
        return {
          type: "redacted-reasoning",
          // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
          data: part["content"] as string,
          ...extraFromMeta,
        } as PromptlContent;
      }
      // Generic part - convert to text if it has content, otherwise skip
      if ("content" in part && typeof part.content === "string") {
        return {
          type: "text",
          text: part.content,
          _genericType: part.type,
          ...extraFromMeta,
        } as PromptlContent;
      }
      return null;
  }
}

/** Converts a GenAI message to Promptl message(s). */
function genAIMessageToPromptl(message: GenAIMessage, toolCallNameMap: Map<string, string>): PromptlMessage[] {
  const promptlMeta = message._provider_metadata?.promptl;

  // Use all metadata fields - they were stored specifically to preserve Promptl-specific data
  const extraFromMeta = promptlMeta ?? {};

  // Handle tool role specially - each tool_call_response becomes a separate message
  if (message.role === "tool") {
    const toolMessages: PromptlMessage[] = [];

    for (const part of message.parts) {
      if (part.type === "tool_call_response") {
        const partMeta = part._provider_metadata?.promptl;
        // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
        let toolName = partMeta?.["toolName"] as string | undefined;
        // Type assertion needed because GenAIGenericPartSchema overlaps with literal types
        const toolId = String((part.id as string | null | undefined) ?? "");

        // If no toolName in metadata, try to infer from matching tool call
        if (!toolName && toolId && toolCallNameMap.has(toolId)) {
          toolName = toolCallNameMap.get(toolId);
        }

        // Fallback to "unknown" if still not found
        toolName = toolName ?? "unknown";

        // Convert response back to content
        let content: PromptlContent[];
        if (typeof part.response === "string") {
          content = [{ type: "text", text: part.response }];
        } else if (Array.isArray(part.response)) {
          // Response was an array of GenAI parts
          content = (part.response as GenAIPart[])
            .map((p) => genAIPartToPromptl(p))
            .filter((c): c is PromptlContent => c !== null);
        } else {
          // Other response types - serialize to JSON text
          content = [{ type: "text", text: JSON.stringify(part.response) }];
        }

        // Extract all metadata except toolName which is used explicitly above
        const partExtra = partMeta ? extractExtraFields(partMeta, ["toolName"]) : {};

        toolMessages.push({
          role: "tool",
          toolName: String(toolName),
          toolId,
          content,
          ...partExtra,
        } as PromptlMessage);
      }
    }

    return toolMessages.length > 0 ? toolMessages : [];
  }

  // Convert parts to content
  const content: PromptlContent[] = [];
  for (const part of message.parts) {
    const converted = genAIPartToPromptl(part);
    if (converted) {
      content.push(converted);
    }
  }

  // Map role - Promptl only accepts specific roles
  let role: PromptlMessage["role"];
  if (message.role === "system") {
    role = "system";
  } else if (message.role === "developer") {
    role = "developer";
  } else if (message.role === "user") {
    role = "user";
  } else if (message.role === "assistant") {
    role = "assistant";
  } else {
    // Unknown role - default to user
    role = "user";
  }

  const baseMessage = {
    role,
    content,
    ...extraFromMeta,
  };

  if (role === "user" && message.name) {
    return [{ ...baseMessage, role: "user", name: message.name } as PromptlMessage];
  }

  return [baseMessage as PromptlMessage];
}
