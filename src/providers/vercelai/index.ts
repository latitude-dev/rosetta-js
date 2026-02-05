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
import {
  type VercelAIAssistantMessage,
  type VercelAIMessage,
  VercelAIMessageSchema,
  type VercelAIPart,
  type VercelAISystemMessage,
  type VercelAIToolMessage,
  type VercelAIUserMessage,
} from "$package/providers/vercelai/schema";
import {
  applyMetadataMode,
  binaryToBase64,
  extractExtraFields,
  getKnownFields,
  getPartsMetadata,
  getUrlString,
  inferModality,
  isUrl,
  type ProviderMetadataMode,
  readMetadata,
  storeMetadata,
} from "$package/utils";

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

  fromGenAI({ messages, providerMetadata }: ProviderFromGenAIArgs) {
    const toolCallNameMap = buildToolCallNameMap(messages);

    const converted: VercelAIMessage[] = [];
    for (const message of messages) {
      converted.push(...genAIMessageToVercelAI(message, toolCallNameMap, providerMetadata));
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
  const allKnownKeys = [...knownPartKeys, "_provider_metadata", "_providerMetadata"];
  const extraFields = extractExtraFields(part, allKnownKeys as (keyof typeof part)[]);
  const existingMetadata = readMetadata(part as unknown as Record<string, unknown>);

  // Helper to build metadata
  const buildMetadata = (knownFields = {}) => storeMetadata(existingMetadata, extraFields, knownFields);

  switch (part.type) {
    case "text": {
      const metadata = buildMetadata();
      return [
        {
          type: "text",
          content: part.text,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "image": {
      const metadata = buildMetadata();
      const imageValue = part.image;
      if (isUrl(imageValue)) {
        return [
          {
            type: "uri",
            modality: "image",
            uri: getUrlString(imageValue),
            ...(part.mediaType ? { mime_type: part.mediaType } : {}),
            ...(metadata ? { _provider_metadata: metadata } : {}),
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
            ...(metadata ? { _provider_metadata: metadata } : {}),
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
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "file": {
      const metadata = buildMetadata();
      const fileValue = part.data;
      const modality = inferModality(part.mediaType);

      if (isUrl(fileValue)) {
        return [
          {
            type: "uri",
            modality,
            uri: getUrlString(fileValue),
            mime_type: part.mediaType,
            ...(metadata ? { _provider_metadata: metadata } : {}),
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
            ...(metadata ? { _provider_metadata: metadata } : {}),
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
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "reasoning": {
      const metadata = buildMetadata();
      return [
        {
          type: "reasoning",
          content: part.text,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "tool-call": {
      const metadata = buildMetadata();
      return [
        {
          type: "tool_call",
          id: part.toolCallId,
          name: part.toolName,
          arguments: part.input,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "tool-result": {
      // Support both modern format (output) and legacy format (result + isError)
      let response: unknown;
      let isError = false;
      let outputType: string | undefined;

      // Check for modern format first (output field exists)
      const output = part.output as { type: string; value?: unknown; reason?: string } | undefined;
      if (output !== undefined) {
        if (typeof output === "object" && output !== null && "type" in output) {
          // Handle typed ToolResultOutput
          outputType = output.type;
          switch (output.type) {
            case "text":
            case "json":
            case "error-text":
            case "error-json":
              response = output.value;
              isError = output.type === "error-text" || output.type === "error-json";
              break;
            case "execution-denied":
              response = output.reason ?? "Execution denied";
              isError = true;
              break;
            case "content":
              // Content array - pass through as-is
              response = output.value;
              break;
            default:
              response = output;
          }
        } else {
          // Raw value in output field (backwards compatibility)
          response = output;
        }
      } else {
        // Legacy format: result + isError fields (no output field)
        const legacyResult = (part as unknown as { result?: unknown }).result;
        const legacyIsError = (part as unknown as { isError?: boolean }).isError;
        response = legacyResult;
        isError = legacyIsError ?? false;
        // Infer output type from legacy format for round-trip
        if (isError) {
          outputType = typeof legacyResult === "string" ? "error-text" : "error-json";
        } else {
          outputType = typeof legacyResult === "string" ? "text" : "json";
        }
      }

      // Store outputType in extra fields for round-trip, known fields for cross-provider
      const extraWithOutputType = { ...extraFields, ...(outputType ? { outputType } : {}) };
      const metadata = storeMetadata(existingMetadata, extraWithOutputType, {
        toolName: part.toolName,
        ...(isError ? { isError: true } : {}),
      });

      return [
        {
          type: "tool_call_response",
          id: part.toolCallId,
          response,
          ...(metadata ? { _provider_metadata: metadata } : {}),
        },
      ];
    }

    case "tool-approval-request": {
      const metadata = buildMetadata();
      return [
        {
          type: "tool-approval-request",
          content: "",
          ...(metadata ? { _provider_metadata: metadata } : {}),
          approvalId: part.approvalId,
          toolCallId: part.toolCallId,
        },
      ];
    }

    case "tool-approval-response": {
      const metadata = buildMetadata();
      return [
        {
          type: "tool-approval-response",
          content: "",
          ...(metadata ? { _provider_metadata: metadata } : {}),
          approvalId: part.approvalId,
          approved: part.approved,
          ...(part.reason ? { reason: part.reason } : {}),
        },
      ];
    }

    default:
      return [];
  }
}

/** Convert a VercelAI message to GenAI message. */
function vercelAIMessageToGenAI(message: VercelAIMessage): GenAIMessage {
  const knownMessageKeys = ["role", "content", "_provider_metadata", "_providerMetadata"];
  const extraFields = extractExtraFields(message, knownMessageKeys as (keyof VercelAIMessage)[]);
  const existingMetadata = readMetadata(message as unknown as Record<string, unknown>);
  const msgMetadata = storeMetadata(existingMetadata, extraFields, {});

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
        // Include both modern (output) and legacy (result, isError) fields for tool-result
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
          "result",
          "isError",
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
      // Include both modern (output) and legacy (result, isError) fields
      const knownPartKeys = [
        "type",
        "toolCallId",
        "toolName",
        "output",
        "result",
        "isError",
        "approvalId",
        "approved",
        "reason",
      ];
      for (const part of toolMsg.content) {
        parts.push(...vercelAIPartToGenAI(part, knownPartKeys));
      }
      break;
    }
  }

  return {
    role: message.role,
    parts,
    ...(msgMetadata ? { _provider_metadata: msgMetadata } : {}),
  };
}

/** Convert a GenAI part to VercelAI part. */
function genAIPartToVercelAI(
  part: GenAIPart,
  toolCallNameMap: Map<string, string>,
  mode: ProviderMetadataMode,
): VercelAIPart | null {
  const metadata = readMetadata(part as unknown as Record<string, unknown>);
  const known = getKnownFields(metadata);

  // Helper to apply metadata mode to a part
  const applyMode = <T extends object>(content: T): T => applyMetadataMode(content, metadata, mode, true) as T;

  switch (part.type) {
    case "text":
      return applyMode({
        type: "text",
        text: part.content,
      } as VercelAIPart);

    case "blob": {
      if (part.modality === "image") {
        return applyMode({
          type: "image",
          image: part.content, // base64 string
          ...(part.mime_type ? { mediaType: part.mime_type } : {}),
        } as VercelAIPart);
      }
      // Other modalities become file
      return applyMode({
        type: "file",
        data: part.content,
        mediaType: part.mime_type ?? `application/${part.modality}`,
      } as VercelAIPart);
    }

    case "uri": {
      if (part.modality === "image") {
        return applyMode({
          type: "image",
          image: part.uri,
          ...(part.mime_type ? { mediaType: part.mime_type } : {}),
        } as VercelAIPart);
      }
      // Other modalities become file
      return applyMode({
        type: "file",
        data: part.uri,
        mediaType: part.mime_type ?? `application/${part.modality}`,
      } as VercelAIPart);
    }

    case "file":
      // GenAI file (by file_id) - convert to file
      return applyMode({
        type: "file",
        data: part.file_id,
        mediaType: part.mime_type ?? `application/${part.modality}`,
      } as VercelAIPart);

    case "reasoning":
      return applyMode({
        type: "reasoning",
        text: part.content,
      } as VercelAIPart);

    case "tool_call":
      return applyMode({
        type: "tool-call",
        toolCallId: part.id ?? "",
        toolName: part.name,
        input: part.arguments,
      } as VercelAIPart);

    case "tool_call_response": {
      const toolId = String((part.id as string | null | undefined) ?? "");

      // Read toolName from known fields
      let toolName = known.toolName;
      // Fallback: try to infer from matching tool call if not in known fields
      if (!toolName && toolId && toolCallNameMap.has(toolId)) {
        toolName = toolCallNameMap.get(toolId);
      }
      toolName = toolName ?? "unknown";

      // Read isError from known fields
      const hasError = known.isError;

      // Get stored output type from extra fields (for same-provider round-trip)
      // biome-ignore lint/complexity/useLiteralKeys: required for index signature access
      const outputType = metadata?.["outputType"] as string | undefined;

      // Wrap response in typed ToolResultOutput structure
      let output: unknown;
      const response = part.response;

      if (outputType) {
        // Restore original output type from metadata
        if (outputType === "execution-denied") {
          output = { type: "execution-denied", reason: typeof response === "string" ? response : undefined };
        } else if (outputType === "content") {
          output = { type: "content", value: response };
        } else {
          output = { type: outputType, value: response };
        }
      } else if (typeof response === "string") {
        output = { type: hasError ? "error-text" : "text", value: response };
      } else {
        output = { type: hasError ? "error-json" : "json", value: response };
      }

      // Build base output and apply mode (excluding outputType from passthrough since it's internal)
      const baseOutput = {
        type: "tool-result" as const,
        toolCallId: toolId,
        toolName,
        output,
      };

      // For passthrough, exclude outputType since it's internal
      if (mode === "passthrough" && metadata) {
        const { _known_fields, _knownFields, outputType: _, ...extraFields } = metadata;
        if (Object.keys(extraFields).length > 0) {
          return { ...baseOutput, ...extraFields } as VercelAIPart;
        }
        return baseOutput as VercelAIPart;
      }

      return applyMode(baseOutput as VercelAIPart);
    }

    default:
      // Check for custom types that we stored as generic parts
      if (part.type === "tool-approval-request" && "approvalId" in part && "toolCallId" in part) {
        const genericPart = part as unknown as Record<string, unknown>;
        return applyMode({
          type: "tool-approval-request",
          // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
          approvalId: String(genericPart["approvalId"]),
          // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
          toolCallId: String(genericPart["toolCallId"]),
        } as VercelAIPart);
      }
      if (part.type === "tool-approval-response" && "approvalId" in part && "approved" in part) {
        const genericPart = part as unknown as Record<string, unknown>;
        return applyMode({
          type: "tool-approval-response",
          // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
          approvalId: String(genericPart["approvalId"]),
          // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
          approved: Boolean(genericPart["approved"]),
          // biome-ignore lint/complexity/useLiteralKeys: required for TypeScript index signature access
          ...("reason" in part ? { reason: String(genericPart["reason"]) } : {}),
        } as VercelAIPart);
      }
      // Generic part - convert to text if it has content
      if ("content" in part && typeof part.content === "string") {
        return applyMode({
          type: "text",
          text: part.content,
        } as VercelAIPart);
      }
      return null;
  }
}

/** Convert a GenAI message to VercelAI messages. */
function genAIMessageToVercelAI(
  message: GenAIMessage,
  toolCallNameMap: Map<string, string>,
  mode: ProviderMetadataMode,
): VercelAIMessage[] {
  const msgMetadata = readMetadata(message as unknown as Record<string, unknown>);

  // Helper to apply metadata mode to a message
  const applyMode = <T extends object>(msg: T): T => applyMetadataMode(msg, msgMetadata, mode, true) as T;

  // Helper to check if any part has metadata that should be preserved
  const hasPartMetadata = () =>
    message.parts.some((p) => {
      const meta = readMetadata(p as unknown as Record<string, unknown>);
      return meta && Object.keys(meta).length > 0;
    });

  // Helper to determine if we should collapse single text part to string
  // Only collapse if mode is "strip" OR no parts have metadata
  const shouldCollapseToString = () => mode === "strip" || !hasPartMetadata();

  // Handle system messages
  if (message.role === "system") {
    // Extract text content
    const textContent = message.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { content: string }).content)
      .join("\n");

    // System messages must use string content, so collect part metadata into _partsMetadata
    let combinedMeta = msgMetadata ? { ...msgMetadata } : undefined;
    let partsMetadata: Record<string, unknown> | undefined;
    for (const part of message.parts.filter((p) => p.type === "text")) {
      const partMeta = readMetadata(part as unknown as Record<string, unknown>);
      if (partMeta && Object.keys(partMeta).length > 0) {
        partsMetadata = { ...partsMetadata, ...partMeta };
      }
    }
    if (partsMetadata) {
      combinedMeta = { ...combinedMeta, _partsMetadata: partsMetadata };
    }

    const applyModeCombined = <T extends object>(msg: T): T => applyMetadataMode(msg, combinedMeta, mode, true) as T;

    return [
      applyModeCombined({
        role: "system",
        content: textContent,
      } as VercelAISystemMessage),
    ];
  }

  // Handle tool messages
  if (message.role === "tool") {
    const toolParts: VercelAIPart[] = [];

    for (const part of message.parts) {
      const converted = genAIPartToVercelAI(part, toolCallNameMap, mode);
      if (converted && (converted.type === "tool-result" || converted.type === "tool-approval-response")) {
        toolParts.push(converted);
      }
    }

    if (toolParts.length === 0) {
      return [];
    }

    // Apply _partsMetadata to the first tool part if present
    const partsMetadata = getPartsMetadata(msgMetadata);
    if (partsMetadata && toolParts.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: length check guarantees element exists
      toolParts[0] = applyMetadataMode(toolParts[0]!, partsMetadata, mode, true) as VercelAIPart;
    }

    return [
      applyMode({
        role: "tool",
        content: toolParts,
      } as VercelAIToolMessage),
    ];
  }

  // Handle user messages
  if (message.role === "user") {
    const userParts: VercelAIPart[] = [];

    for (const part of message.parts) {
      const converted = genAIPartToVercelAI(part, toolCallNameMap, mode);
      if (converted && (converted.type === "text" || converted.type === "image" || converted.type === "file")) {
        userParts.push(converted);
      }
    }

    // Check for _partsMetadata - if present, we need array content to apply it
    const partsMetadata = getPartsMetadata(msgMetadata);

    // If only one text part and no metadata to preserve (including _partsMetadata), use string content
    if (userParts.length === 1 && userParts[0]?.type === "text" && shouldCollapseToString() && !partsMetadata) {
      return [
        applyMode({
          role: "user",
          content: (userParts[0] as { text: string }).text,
        } as VercelAIUserMessage),
      ];
    }

    // Apply _partsMetadata to the first user part if present
    if (partsMetadata && userParts.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: length check guarantees element exists
      userParts[0] = applyMetadataMode(userParts[0]!, partsMetadata, mode, true) as VercelAIPart;
    }

    return [
      applyMode({
        role: "user",
        content: userParts,
      } as VercelAIUserMessage),
    ];
  }

  // Handle assistant messages
  if (message.role === "assistant") {
    const assistantParts: VercelAIPart[] = [];

    for (const part of message.parts) {
      const converted = genAIPartToVercelAI(part, toolCallNameMap, mode);
      if (converted) {
        assistantParts.push(converted);
      }
    }

    // Check for _partsMetadata - if present, we need array content to apply it
    const partsMetadata = getPartsMetadata(msgMetadata);

    // If only one text part and no metadata to preserve (including _partsMetadata), use string content
    if (
      assistantParts.length === 1 &&
      assistantParts[0]?.type === "text" &&
      shouldCollapseToString() &&
      !partsMetadata
    ) {
      return [
        applyMode({
          role: "assistant",
          content: (assistantParts[0] as { text: string }).text,
        } as VercelAIAssistantMessage),
      ];
    }

    // Apply _partsMetadata to the first assistant part if present
    if (partsMetadata && assistantParts.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: length check guarantees element exists
      assistantParts[0] = applyMetadataMode(assistantParts[0]!, partsMetadata, mode, true) as VercelAIPart;
    }

    return [
      applyMode({
        role: "assistant",
        content: assistantParts,
      } as VercelAIAssistantMessage),
    ];
  }

  // Unknown role - treat as user message with text content
  const textParts = message.parts
    .filter((p) => p.type === "text")
    .map((p) => ({ type: "text" as const, text: (p as { content: string }).content }));

  if (textParts.length > 0) {
    // Apply _partsMetadata to the first text part if present
    const partsMetadata = getPartsMetadata(msgMetadata);
    if (partsMetadata) {
      // biome-ignore lint/style/noNonNullAssertion: length check guarantees element exists
      textParts[0] = applyMetadataMode(textParts[0]!, partsMetadata, mode, true) as (typeof textParts)[0];
    }

    return [
      applyMode({
        role: "user",
        content: textParts,
      } as VercelAIUserMessage),
    ];
  }

  return [];
}
