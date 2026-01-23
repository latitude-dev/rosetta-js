/**
 * VercelAI Provider
 *
 * Provider for the Vercel AI SDK message format.
 * This is the format used by the `ai` package from Vercel.
 */

import type { GenAIMessage, GenAIPart } from "$package/core/genai";
import {
  Provider,
  type ProviderFromGenAIArgs,
  type ProviderSpecification,
  type ProviderToGenAIArgs,
} from "$package/providers/provider";
import type { VercelAIMetadata } from "$package/providers/vercelai/metadata";
import {
  type VercelAIAssistantMessage,
  type VercelAIMessage,
  VercelAIMessageSchema,
  type VercelAIPart,
  type VercelAISystemMessage,
  type VercelAIToolMessage,
  type VercelAIUserMessage,
} from "$package/providers/vercelai/schema";
import { binaryToBase64, extractExtraFields, getUrlString, inferModality, isUrl } from "$package/utils";

export const VercelAISpecification = {
  provider: Provider.VercelAI,
  name: "Vercel AI",
  messageSchema: VercelAIMessageSchema,

  toGenAI({ messages, direction }: ProviderToGenAIArgs) {
    if (typeof messages === "string") {
      const role = direction === "input" ? "user" : "assistant";
      messages = [{ role, content: messages }];
    }

    // Normalize string content to array format for user/assistant messages
    const normalized = messages.map((msg) => {
      const m = msg as { role: string; content: unknown };
      if (m.role === "user" && typeof m.content === "string") {
        return { ...m, content: [{ type: "text", text: m.content }] };
      }
      if (m.role === "assistant" && typeof m.content === "string") {
        return { ...m, content: [{ type: "text", text: m.content }] };
      }
      return m;
    });

    const parsedMessages = VercelAIMessageSchema.array().parse(normalized);

    const converted: GenAIMessage[] = [];
    for (const message of parsedMessages) {
      converted.push(vercelAIMessageToGenAI(message));
    }

    return { messages: converted };
  },

  fromGenAI({ messages }: ProviderFromGenAIArgs) {
    const toolCallNameMap = buildToolCallNameMap(messages);

    const converted: VercelAIMessage[] = [];
    for (const message of messages) {
      converted.push(...genAIMessageToVercelAI(message, toolCallNameMap));
    }

    return { messages: converted };
  },
} as const satisfies ProviderSpecification<Provider.VercelAI>;

/** Builds a map from tool call id to tool name from all messages. */
function buildToolCallNameMap(messages: GenAIMessage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "tool_call") {
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

/** Convert a VercelAI part to GenAI parts. */
function vercelAIPartToGenAI(part: VercelAIPart, knownPartKeys: string[]): GenAIPart[] {
  const extraFields = extractExtraFields(part, knownPartKeys as (keyof typeof part)[]);
  const metadata: VercelAIMetadata = extraFields;
  const hasMetadata = Object.keys(metadata).length > 0;

  switch (part.type) {
    case "text":
      return [
        {
          type: "text",
          content: part.text,
          ...(hasMetadata ? { _provider_metadata: { vercel_ai: metadata } } : {}),
        },
      ];

    case "image": {
      const imageValue = part.image;
      if (isUrl(imageValue)) {
        return [
          {
            type: "uri",
            modality: "image",
            uri: getUrlString(imageValue),
            ...(part.mediaType ? { mime_type: part.mediaType } : {}),
            ...(hasMetadata ? { _provider_metadata: { vercel_ai: metadata } } : {}),
          },
        ];
      }
      // Binary data - convert to base64
      if (imageValue instanceof Uint8Array || imageValue instanceof ArrayBuffer) {
        return [
          {
            type: "blob",
            modality: "image",
            content: binaryToBase64(imageValue),
            ...(part.mediaType ? { mime_type: part.mediaType } : {}),
            ...(hasMetadata ? { _provider_metadata: { vercel_ai: metadata } } : {}),
          },
        ];
      }
      // String that's not a URL - assume base64
      return [
        {
          type: "blob",
          modality: "image",
          content: String(imageValue),
          ...(part.mediaType ? { mime_type: part.mediaType } : {}),
          ...(hasMetadata ? { _provider_metadata: { vercel_ai: metadata } } : {}),
        },
      ];
    }

    case "file": {
      const fileValue = part.data;
      const modality = inferModality(part.mediaType);

      if (isUrl(fileValue)) {
        return [
          {
            type: "uri",
            modality,
            uri: getUrlString(fileValue),
            mime_type: part.mediaType,
            ...(hasMetadata ? { _provider_metadata: { vercel_ai: metadata } } : {}),
          },
        ];
      }
      // Binary data - convert to base64
      if (fileValue instanceof Uint8Array || fileValue instanceof ArrayBuffer) {
        return [
          {
            type: "blob",
            modality,
            content: binaryToBase64(fileValue),
            mime_type: part.mediaType,
            ...(hasMetadata ? { _provider_metadata: { vercel_ai: metadata } } : {}),
          },
        ];
      }
      // String that's not a URL - assume base64
      return [
        {
          type: "blob",
          modality,
          content: String(fileValue),
          mime_type: part.mediaType,
          ...(hasMetadata ? { _provider_metadata: { vercel_ai: metadata } } : {}),
        },
      ];
    }

    case "reasoning":
      return [
        {
          type: "reasoning",
          content: part.text,
          ...(hasMetadata ? { _provider_metadata: { vercel_ai: metadata } } : {}),
        },
      ];

    case "tool-call":
      return [
        {
          type: "tool_call",
          id: part.toolCallId,
          name: part.toolName,
          arguments: part.input,
          ...(hasMetadata ? { _provider_metadata: { vercel_ai: metadata } } : {}),
        },
      ];

    case "tool-result":
      return [
        {
          type: "tool_call_response",
          id: part.toolCallId,
          response: part.output,
          _provider_metadata: {
            vercel_ai: {
              toolName: part.toolName,
              ...metadata,
            },
          },
        },
      ];

    case "tool-approval-request":
      return [
        {
          type: "tool-approval-request",
          content: "",
          ...(hasMetadata ? { _provider_metadata: { vercel_ai: metadata } } : {}),
          approvalId: part.approvalId,
          toolCallId: part.toolCallId,
        },
      ];

    case "tool-approval-response":
      return [
        {
          type: "tool-approval-response",
          content: "",
          ...(hasMetadata ? { _provider_metadata: { vercel_ai: metadata } } : {}),
          approvalId: part.approvalId,
          approved: part.approved,
          ...(part.reason ? { reason: part.reason } : {}),
        },
      ];

    default:
      return [];
  }
}

/** Convert a VercelAI message to GenAI message. */
function vercelAIMessageToGenAI(message: VercelAIMessage): GenAIMessage {
  const knownMessageKeys = ["role", "content"];
  const extraFields = extractExtraFields(message, knownMessageKeys as (keyof VercelAIMessage)[]);
  const hasMessageMetadata = Object.keys(extraFields).length > 0;

  const parts: GenAIPart[] = [];

  switch (message.role) {
    case "system": {
      const sysMsg = message as VercelAISystemMessage;
      parts.push({ type: "text", content: sysMsg.content });
      break;
    }

    case "user": {
      const userMsg = message as VercelAIUserMessage;
      const content = userMsg.content;
      if (typeof content === "string") {
        parts.push({ type: "text", content });
      } else {
        const knownPartKeys = ["type", "text", "image", "data", "filename", "mediaType"];
        for (const part of content) {
          parts.push(...vercelAIPartToGenAI(part, knownPartKeys));
        }
      }
      break;
    }

    case "assistant": {
      const assistantMsg = message as VercelAIAssistantMessage;
      const content = assistantMsg.content;
      if (typeof content === "string") {
        parts.push({ type: "text", content });
      } else {
        const knownPartKeys = [
          "type",
          "text",
          "data",
          "filename",
          "mediaType",
          "toolCallId",
          "toolName",
          "input",
          "output",
          "approvalId",
        ];
        for (const part of content) {
          parts.push(...vercelAIPartToGenAI(part, knownPartKeys));
        }
      }
      break;
    }

    case "tool": {
      const toolMsg = message as VercelAIToolMessage;
      const knownPartKeys = ["type", "toolCallId", "toolName", "output", "approvalId", "approved", "reason"];
      for (const part of toolMsg.content) {
        parts.push(...vercelAIPartToGenAI(part, knownPartKeys));
      }
      break;
    }
  }

  return {
    role: message.role,
    parts,
    ...(hasMessageMetadata ? { _provider_metadata: { vercel_ai: extraFields } } : {}),
  };
}

/** Convert a GenAI part to VercelAI part. */
function genAIPartToVercelAI(part: GenAIPart, toolCallNameMap: Map<string, string>): VercelAIPart | null {
  const extraFromMeta = part._provider_metadata?.vercel_ai ?? {};

  switch (part.type) {
    case "text":
      return {
        type: "text",
        text: part.content,
        ...extraFromMeta,
      } as VercelAIPart;

    case "blob": {
      if (part.modality === "image") {
        return {
          type: "image",
          image: part.content, // base64 string
          ...(part.mime_type ? { mediaType: part.mime_type } : {}),
          ...extraFromMeta,
        } as VercelAIPart;
      }
      // Other modalities become file
      return {
        type: "file",
        data: part.content,
        mediaType: part.mime_type ?? `application/${part.modality}`,
        ...extraFromMeta,
      } as VercelAIPart;
    }

    case "uri": {
      if (part.modality === "image") {
        return {
          type: "image",
          image: part.uri,
          ...(part.mime_type ? { mediaType: part.mime_type } : {}),
          ...extraFromMeta,
        } as VercelAIPart;
      }
      // Other modalities become file
      return {
        type: "file",
        data: part.uri,
        mediaType: part.mime_type ?? `application/${part.modality}`,
        ...extraFromMeta,
      } as VercelAIPart;
    }

    case "file":
      // GenAI file (by file_id) - convert to file
      return {
        type: "file",
        data: part.file_id,
        mediaType: part.mime_type ?? `application/${part.modality}`,
        ...extraFromMeta,
      } as VercelAIPart;

    case "reasoning":
      return {
        type: "reasoning",
        text: part.content,
        ...extraFromMeta,
      } as VercelAIPart;

    case "tool_call":
      return {
        type: "tool-call",
        toolCallId: part.id ?? "",
        toolName: part.name,
        input: part.arguments,
        ...extraFromMeta,
      } as VercelAIPart;

    case "tool_call_response": {
      const partMeta = part._provider_metadata?.vercel_ai;
      // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
      let toolName = partMeta?.["toolName"] as string | undefined;
      const toolId = String((part.id as string | null | undefined) ?? "");

      // Try to infer from matching tool call
      if (!toolName && toolId && toolCallNameMap.has(toolId)) {
        toolName = toolCallNameMap.get(toolId);
      }
      toolName = toolName ?? "unknown";

      // Extract metadata except toolName
      const restMeta = partMeta
        ? extractExtraFields(partMeta as Record<string, unknown>, ["toolName"] as (keyof Record<string, unknown>)[])
        : {};

      return {
        type: "tool-result",
        toolCallId: toolId,
        toolName,
        output: part.response,
        ...restMeta,
      } as VercelAIPart;
    }

    default:
      // Check for custom types that we stored as generic parts
      if (part.type === "tool-approval-request" && "approvalId" in part && "toolCallId" in part) {
        const genericPart = part as unknown as Record<string, unknown>;
        return {
          type: "tool-approval-request",
          // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
          approvalId: String(genericPart["approvalId"]),
          // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
          toolCallId: String(genericPart["toolCallId"]),
          ...extraFromMeta,
        } as VercelAIPart;
      }
      if (part.type === "tool-approval-response" && "approvalId" in part && "approved" in part) {
        const genericPart = part as unknown as Record<string, unknown>;
        return {
          type: "tool-approval-response",
          // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
          approvalId: String(genericPart["approvalId"]),
          // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
          approved: Boolean(genericPart["approved"]),
          // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
          ...("reason" in part ? { reason: String(genericPart["reason"]) } : {}),
          ...extraFromMeta,
        } as VercelAIPart;
      }
      // Generic part - convert to text if it has content
      if ("content" in part && typeof part.content === "string") {
        return {
          type: "text",
          text: part.content,
          ...extraFromMeta,
        } as VercelAIPart;
      }
      return null;
  }
}

/** Convert a GenAI message to VercelAI messages. */
function genAIMessageToVercelAI(message: GenAIMessage, toolCallNameMap: Map<string, string>): VercelAIMessage[] {
  const vercelAIMeta = message._provider_metadata?.vercel_ai ?? {};

  // Handle system messages
  if (message.role === "system") {
    // Extract text content
    const textContent = message.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { content: string }).content)
      .join("\n");

    return [
      {
        role: "system",
        content: textContent,
        ...vercelAIMeta,
      } as VercelAISystemMessage,
    ];
  }

  // Handle tool messages
  if (message.role === "tool") {
    const toolParts: VercelAIPart[] = [];

    for (const part of message.parts) {
      const converted = genAIPartToVercelAI(part, toolCallNameMap);
      if (converted && (converted.type === "tool-result" || converted.type === "tool-approval-response")) {
        toolParts.push(converted);
      }
    }

    if (toolParts.length === 0) {
      return [];
    }

    return [
      {
        role: "tool",
        content: toolParts,
        ...vercelAIMeta,
      } as VercelAIToolMessage,
    ];
  }

  // Handle user messages
  if (message.role === "user") {
    const userParts: VercelAIPart[] = [];

    for (const part of message.parts) {
      const converted = genAIPartToVercelAI(part, toolCallNameMap);
      if (converted && (converted.type === "text" || converted.type === "image" || converted.type === "file")) {
        userParts.push(converted);
      }
    }

    // If only one text part, use string content
    if (userParts.length === 1 && userParts[0]?.type === "text") {
      return [
        {
          role: "user",
          content: (userParts[0] as { text: string }).text,
          ...vercelAIMeta,
        } as VercelAIUserMessage,
      ];
    }

    return [
      {
        role: "user",
        content: userParts,
        ...vercelAIMeta,
      } as VercelAIUserMessage,
    ];
  }

  // Handle assistant messages
  if (message.role === "assistant") {
    const assistantParts: VercelAIPart[] = [];

    for (const part of message.parts) {
      const converted = genAIPartToVercelAI(part, toolCallNameMap);
      if (converted) {
        assistantParts.push(converted);
      }
    }

    // If only one text part, use string content
    if (assistantParts.length === 1 && assistantParts[0]?.type === "text") {
      return [
        {
          role: "assistant",
          content: (assistantParts[0] as { text: string }).text,
          ...vercelAIMeta,
        } as VercelAIAssistantMessage,
      ];
    }

    return [
      {
        role: "assistant",
        content: assistantParts,
        ...vercelAIMeta,
      } as VercelAIAssistantMessage,
    ];
  }

  // Unknown role - treat as user message with text content
  const textParts = message.parts
    .filter((p) => p.type === "text")
    .map((p) => ({ type: "text" as const, text: (p as { content: string }).content }));

  if (textParts.length > 0) {
    return [
      {
        role: "user",
        content: textParts,
        ...vercelAIMeta,
      } as VercelAIUserMessage,
    ];
  }

  return [];
}
