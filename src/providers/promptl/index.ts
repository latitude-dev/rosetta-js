/**
 * Promptl Provider
 *
 * The provider that uses the Promptl message format.
 * This is the format used in Latitude.
 */

import type { GenAIMessage, GenAIPart } from "$package/core/genai";
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
import {
  applyMetadataMode,
  extractExtraFields,
  getKnownFields,
  getPartsMetadata,
  isUrlString,
  type ProviderMetadataMode,
  readMetadata,
  storeMetadata,
} from "$package/utils";

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

  fromGenAI({ messages, providerMetadata }: ProviderFromGenAIArgs) {
    // Build a lookup map from tool call id to tool name from all tool_call parts
    const toolCallNameMap = buildToolCallNameMap(messages);

    const converted: PromptlMessage[] = [];
    for (const message of messages) {
      converted.push(...genAIMessageToPromptl(message, toolCallNameMap, providerMetadata));
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
    "_provider_metadata",
    "_providerMetadata",
  ];
  const extraFields = extractExtraFields(content, knownContentKeys as (keyof PromptlContent)[]);
  const existingMetadata = readMetadata(content as unknown as Record<string, unknown>);

  // Helper to build metadata
  const buildMetadata = (knownFields = {}) => storeMetadata(existingMetadata, extraFields, knownFields);

  switch (content.type) {
    case "text": {
      const metadata = buildMetadata();
      return [
        {
          type: "text",
          content: content.text ?? "",
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "image": {
      const metadata = buildMetadata();
      const imageValue = content.image;
      if (imageValue instanceof URL) {
        return [
          {
            type: "uri",
            modality: "image",
            uri: imageValue.toString(),
            ...(metadata ? { _provider_metadata: metadata } : {}),
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
            ...(metadata ? { _provider_metadata: metadata } : {}),
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
            ...(metadata ? { _provider_metadata: metadata } : {}),
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
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ];
      }
      return [
        {
          type: "blob",
          modality: "image",
          content: imageValue,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "file": {
      const metadata = buildMetadata();
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
            ...(metadata ? { _provider_metadata: metadata } : {}),
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
            ...(metadata ? { _provider_metadata: metadata } : {}),
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
            ...(metadata ? { _provider_metadata: metadata } : {}),
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
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ];
      }
      return [
        {
          type: "blob",
          modality,
          mime_type: mimeType,
          content: fileValue,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "reasoning": {
      // id and isStreaming are automatically in metadata via extraFields
      const metadata = buildMetadata();
      return [
        {
          type: "reasoning",
          content: content.text,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "redacted-reasoning": {
      // Map to reasoning (closest GenAI equivalent), store original type in known fields
      const metadata = buildMetadata({ originalType: "redacted-reasoning" });
      return [
        {
          type: "reasoning",
          content: content.data,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "tool-call": {
      const metadata = buildMetadata();
      return [
        {
          type: "tool_call",
          id: content.toolCallId,
          name: content.toolName,
          arguments: getToolArguments(content),
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "tool-result": {
      // Check if isError is in extraFields
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      const isError = "isError" in extraFields ? (extraFields["isError"] as boolean) : undefined;
      // Remove isError from extraFields since it's going to known fields
      const { isError: _, ...restExtra } = extraFields;
      const metadata = storeMetadata(existingMetadata, restExtra, {
        toolName: content.toolName,
        ...(isError ? { isError: true } : {}),
      });

      return [
        {
          type: "tool_call_response",
          id: content.toolCallId,
          response: content.result,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }
  }
}

/** Converts a Promptl ToolCall (from toolCalls array) to a GenAI tool_call part. */
function promptlToolCallToGenAI(toolCall: PromptlToolCall): GenAIPart {
  const knownKeys = ["id", "name", "arguments", "_provider_metadata", "_providerMetadata"];
  const extraFields = extractExtraFields(toolCall, knownKeys as (keyof PromptlToolCall)[]);
  const existingMetadata = readMetadata(toolCall as unknown as Record<string, unknown>);
  const metadata = storeMetadata(existingMetadata, extraFields, {});

  return {
    type: "tool_call",
    id: toolCall.id,
    name: toolCall.name,
    arguments: toolCall.arguments,
    ...(metadata ? { _provider_metadata: metadata } : {}),
  };
}

/** Converts a Promptl message to a GenAI message. */
function promptlMessageToGenAI(message: PromptlMessage): GenAIMessage {
  const knownMessageKeys = [
    "role",
    "content",
    "name",
    "toolName",
    "toolId",
    "toolCalls",
    "_provider_metadata",
    "_providerMetadata",
  ];
  const extraFields = extractExtraFields(message, knownMessageKeys as (keyof PromptlMessage)[]);
  const existingMetadata = readMetadata(message as unknown as Record<string, unknown>);

  // GenAI accepts any string role, so we pass the Promptl role directly
  const genAIRole = message.role;

  // Convert content parts
  const parts: GenAIPart[] = [];

  if (message.role === "assistant") {
    const assistantMessage = message as PromptlAssistantMessage;

    // Track tool call IDs from content to deduplicate against toolCalls array
    const toolCallIdsInContent = new Set<string>();

    // Handle string content
    if (typeof assistantMessage.content === "string") {
      parts.push({ type: "text", content: assistantMessage.content });
    } else {
      for (const content of assistantMessage.content) {
        // Track tool-call IDs from content
        if (content.type === "tool-call" && content.toolCallId) {
          toolCallIdsInContent.add(content.toolCallId);
        }
        parts.push(...promptlContentToGenAI(content));
      }
    }

    // Handle toolCalls array (separate from content) - deduplicate by ID
    if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
      for (const toolCall of assistantMessage.toolCalls) {
        // Only add if not already present in content
        if (!toolCallIdsInContent.has(toolCall.id)) {
          parts.push(promptlToolCallToGenAI(toolCall));
        }
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

      const metadata = storeMetadata(existingMetadata, extraFields, { toolName: message.toolName });
      parts.push({
        type: "tool_call_response",
        id: message.toolId,
        response,
        ...(metadata ? { _provider_metadata: metadata } : {}),
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
  const msgMetadata = message.role !== "tool" ? storeMetadata(existingMetadata, extraFields, {}) : undefined;

  return {
    role: genAIRole,
    parts,
    ...(message.role === "user" && message.name ? { name: message.name } : {}),
    ...(msgMetadata ? { _provider_metadata: msgMetadata } : {}),
  };
}

/** Converts a GenAI part to Promptl content. */
function genAIPartToPromptl(
  part: GenAIPart,
  toolCallNameMap: Map<string, string>,
  mode: ProviderMetadataMode,
): PromptlContent | null {
  const metadata = readMetadata(part as unknown as Record<string, unknown>);
  const known = getKnownFields(metadata);

  // Helper to apply metadata mode to a content object
  const applyMode = <T extends object>(content: T): T => applyMetadataMode(content, metadata, mode, true) as T;

  switch (part.type) {
    case "text":
      return applyMode({
        type: "text",
        text: part.content,
      } as PromptlContent);

    case "blob": {
      if (part.modality === "image") {
        return applyMode({
          type: "image",
          image: part.content, // base64 string
        } as PromptlContent);
      }
      // Other modalities become file
      return applyMode({
        type: "file",
        file: part.content,
        mimeType: part.mime_type ?? `application/${part.modality}`,
      } as PromptlContent);
    }

    case "uri": {
      if (part.modality === "image") {
        return applyMode({
          type: "image",
          image: part.uri,
        } as PromptlContent);
      }
      // Other modalities become file
      return applyMode({
        type: "file",
        file: part.uri,
        mimeType: part.mime_type ?? `application/${part.modality}`,
      } as PromptlContent);
    }

    case "file":
      // GenAI file (by file_id) - convert to file with id as content
      return applyMode({
        type: "file",
        file: part.file_id,
        mimeType: part.mime_type ?? `application/${part.modality}`,
      } as PromptlContent);

    case "tool_call": {
      // Include both `args` and `toolArguments` for backwards compatibility
      const args = (part.arguments as Record<string, unknown>) ?? {};
      return applyMode({
        type: "tool-call",
        toolCallId: part.id ?? "",
        toolName: part.name,
        args,
        toolArguments: args,
      } as PromptlContent);
    }

    case "tool_call_response": {
      // Convert to PromptlToolResultContent
      const toolId = String((part.id as string | null | undefined) ?? "");
      // Read toolName from known fields
      let toolName = known.toolName;
      // Fallback: try to infer from matching tool call if not in known fields
      if (!toolName && toolId && toolCallNameMap.has(toolId)) {
        toolName = toolCallNameMap.get(toolId);
      }
      // Fallback to "unknown" if still not found
      toolName = toolName ?? "unknown";

      // Read isError from known fields - always include it
      const isError = known.isError ?? false;

      return applyMode({
        type: "tool-result",
        toolCallId: toolId,
        toolName,
        result: part.response,
        isError,
      } as PromptlContent);
    }

    case "reasoning": {
      // Read originalType from known fields
      if (known.originalType === "redacted-reasoning") {
        // Restore the original redacted-reasoning type
        return applyMode({
          type: "redacted-reasoning",
          data: part.content,
        } as PromptlContent);
      }

      // Regular reasoning content
      return applyMode({
        type: "reasoning",
        text: part.content,
      } as PromptlContent);
    }

    default:
      // Generic part - convert to text if it has content, otherwise skip
      if ("content" in part && typeof part.content === "string") {
        return applyMode({
          type: "text",
          text: part.content,
          _genericType: part.type,
        } as PromptlContent);
      }
      return null;
  }
}

/** Creates a Promptl tool message from a GenAI tool_call_response part. */
function createToolMessageFromPart(
  part: GenAIPart,
  toolCallNameMap: Map<string, string>,
  mode: ProviderMetadataMode,
): PromptlMessage {
  const partMetadata = readMetadata(part as unknown as Record<string, unknown>);
  const known = getKnownFields(partMetadata);
  // Type assertion needed because GenAIGenericPartSchema overlaps with literal types
  const toolId = String((part.id as string | null | undefined) ?? "");

  // Read toolName from known fields
  let toolName = known.toolName;
  // Fallback: try to infer from matching tool call if not in known fields
  if (!toolName && toolId && toolCallNameMap.has(toolId)) {
    toolName = toolCallNameMap.get(toolId);
  }

  // Fallback to "unknown" if still not found
  toolName = toolName ?? "unknown";

  // Read isError from known fields - always include it
  const isError = known.isError ?? false;

  // Create tool-result content
  const toolResultContent: PromptlContent = {
    type: "tool-result",
    toolCallId: toolId,
    toolName,
    result: part.response,
    isError,
  };

  // Apply metadata mode to the tool message
  // Backwards compatibility: include toolName and toolId at message level
  const baseToolMsg = {
    role: "tool" as const,
    toolName: String(toolName),
    toolId,
    content: [applyMetadataMode(toolResultContent, partMetadata, mode, true) as PromptlContent],
  };

  return applyMetadataMode(baseToolMsg, partMetadata, mode, true) as PromptlMessage;
}

/** Converts a GenAI message to Promptl message(s). */
function genAIMessageToPromptl(
  message: GenAIMessage,
  toolCallNameMap: Map<string, string>,
  mode: ProviderMetadataMode,
): PromptlMessage[] {
  const msgMetadata = readMetadata(message as unknown as Record<string, unknown>);

  // Handle tool role specially - each tool_call_response becomes a separate message
  if (message.role === "tool") {
    const toolMessages: PromptlMessage[] = [];

    for (const part of message.parts) {
      if (part.type === "tool_call_response") {
        toolMessages.push(createToolMessageFromPart(part, toolCallNameMap, mode));
      }
    }

    // Apply _partsMetadata to the first tool message's content if present
    const partsMetadata = getPartsMetadata(msgMetadata);
    if (partsMetadata && toolMessages.length > 0) {
      const firstMsg = toolMessages[0] as PromptlMessage & { content: PromptlContent[] };
      if (firstMsg.content.length > 0) {
        // biome-ignore lint/style/noNonNullAssertion: length check guarantees element exists
        firstMsg.content[0] = applyMetadataMode(firstMsg.content[0]!, partsMetadata, mode, true) as PromptlContent;
      }
    }

    return toolMessages.length > 0 ? toolMessages : [];
  }

  // Handle assistant role - check if any parts are tool_call_response
  if (message.role === "assistant") {
    const toolResponseParts = message.parts.filter((p) => p.type === "tool_call_response");
    const otherParts = message.parts.filter((p) => p.type !== "tool_call_response");

    // If there are tool_call_response parts, convert them to tool messages
    if (toolResponseParts.length > 0) {
      const result: PromptlMessage[] = [];

      // Create tool messages for each tool_call_response part
      for (const part of toolResponseParts) {
        result.push(createToolMessageFromPart(part, toolCallNameMap, mode));
      }

      // If there are other parts, create an assistant message for them
      if (otherParts.length > 0) {
        const content: PromptlContent[] = [];
        for (const part of otherParts) {
          const converted = genAIPartToPromptl(part, toolCallNameMap, mode);
          if (converted) {
            content.push(converted);
          }
        }
        if (content.length > 0) {
          // Extract _partsMetadata from message metadata and apply to first content part
          const partsMetadata = getPartsMetadata(msgMetadata);
          if (partsMetadata) {
            // biome-ignore lint/style/noNonNullAssertion: length check guarantees element exists
            content[0] = applyMetadataMode(content[0]!, partsMetadata, mode, true) as PromptlContent;
          }

          const assistantMsg = { role: "assistant" as const, content };
          result.unshift(applyMetadataMode(assistantMsg, msgMetadata, mode, true) as PromptlMessage);
        }
      } else {
        // No other parts - apply _partsMetadata to the first tool message's content
        const partsMetadata = getPartsMetadata(msgMetadata);
        if (partsMetadata && result.length > 0) {
          const firstMsg = result[0] as PromptlMessage & { content: PromptlContent[] };
          if (firstMsg.content.length > 0) {
            // biome-ignore lint/style/noNonNullAssertion: length check guarantees element exists
            firstMsg.content[0] = applyMetadataMode(firstMsg.content[0]!, partsMetadata, mode, true) as PromptlContent;
          }
        }
      }

      return result;
    }
  }

  // Convert parts to content
  const content: PromptlContent[] = [];
  for (const part of message.parts) {
    const converted = genAIPartToPromptl(part, toolCallNameMap, mode);
    if (converted) {
      content.push(converted);
    }
  }

  // Extract _partsMetadata from message metadata and apply to first content part
  // This restores part-level metadata that was merged when converting to string content
  const partsMetadata = getPartsMetadata(msgMetadata);
  if (partsMetadata && content.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: length check guarantees element exists
    content[0] = applyMetadataMode(content[0]!, partsMetadata, mode, true) as PromptlContent;
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
    ...(role === "user" && message.name ? { name: message.name } : {}),
  };

  return [applyMetadataMode(baseMessage, msgMetadata, mode, true) as PromptlMessage];
}
