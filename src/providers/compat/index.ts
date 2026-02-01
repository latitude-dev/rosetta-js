/**
 * Compat Provider - Universal Fallback for Unknown LLM Message Formats
 *
 * When translating messages with Rosetta, provider inference tries to match the input
 * against known provider schemas. If none match, the Compat provider is used as a
 * last resort to perform best-effort conversion to GenAI format.
 *
 * This provider is source-only (toGenAI only, no fromGenAI) because its purpose is to
 * ingest arbitrary message formats, not to generate them.
 *
 * Conversion Strategy:
 * 1. Normalize field names - Convert snake_case and kebab-case to camelCase
 * 2. Detect roles - Map provider-specific roles (e.g., "model" → "assistant")
 * 3. Extract content - Handle string content, arrays of parts, or structured content blocks
 * 4. Identify part types - Use type field discriminators or characteristic field detection
 * 5. Preserve unknown data - Serialize unrecognized structures as JSON text parts
 *
 * Supported Patterns:
 * - OpenAI Chat Completions (content string/array, tool_calls, function_call)
 * - Anthropic Messages (content blocks with type discriminator)
 * - Google Gemini (parts array with inlineData, functionCall, etc.)
 * - VercelAI/Promptl (camelCase tool-call, tool-result parts)
 * - Ollama, Cohere, Mistral, and other providers with role+content structure
 * - Custom formats with recognizable patterns (text, images, tool calls)
 */

import type { GenAIMessage, GenAIPart } from "$package/core/genai";
import { type CompatMessage, CompatMessageSchema, CompatSystemSchema } from "$package/providers/compat/schema";
import { Provider, type ProviderSpecification, type ProviderToGenAIArgs } from "$package/providers/provider";
import {
  getProperty as get,
  getObjectProperty as getObj,
  getStringProperty as getString,
  inferModality,
  isUrlString,
  normalizeKeys,
  type Obj,
  parseJsonIfString,
  storeMetadata,
} from "$package/utils";

export const CompatSpecification = {
  provider: Provider.Compat,
  name: "Compat",
  messageSchema: CompatMessageSchema,
  systemSchema: CompatSystemSchema,

  toGenAI({ messages, system, direction }: ProviderToGenAIArgs) {
    // Handle string input
    if (typeof messages === "string") {
      const role = direction === "input" ? "user" : "assistant";
      return {
        messages: [{ role, parts: [{ type: "text" as const, content: messages }] }],
      };
    }

    // Validate with permissive schema
    const parsedMessages = CompatMessageSchema.array().parse(messages);

    // Convert each message
    const converted: GenAIMessage[] = [];
    for (const message of parsedMessages) {
      converted.push(convertMessage(message, direction));
    }

    // Handle system instructions if provided
    if (system !== undefined) {
      const systemParts = convertSystemToParts(system);
      if (systemParts.length > 0) {
        converted.unshift({ role: "system", parts: systemParts });
      }
    }

    return { messages: converted };
  },
} as const satisfies ProviderSpecification<Provider.Compat>;

/** Detects the role from a message object */
function detectRole(msg: Obj, direction: "input" | "output"): string {
  const role = get(msg, "role");
  if (typeof role === "string") {
    const normalized = role.toLowerCase();
    // Map provider-specific roles
    if (normalized === "model") return "assistant"; // Google Gemini
    if (normalized === "function") return "tool"; // Legacy OpenAI
    return normalized;
  }
  return direction === "input" ? "user" : "assistant";
}

/** Converts system instructions to GenAI parts */
function convertSystemToParts(system: unknown): GenAIPart[] {
  if (typeof system === "string") {
    return [{ type: "text", content: system }];
  }

  if (Array.isArray(system)) {
    const parts: GenAIPart[] = [];
    for (const item of system) {
      if (typeof item === "object" && item !== null) {
        parts.push(...convertPartObject(item as Obj));
      }
    }
    return parts;
  }

  if (typeof system === "object" && system !== null) {
    const obj = system as Obj;
    // Check for text field
    const text = getString(obj, "text");
    if (text) {
      return [{ type: "text", content: text }];
    }
    const content = getString(obj, "content");
    if (content) {
      return [{ type: "text", content }];
    }
    // Serialize as JSON fallback
    return [{ type: "text", content: JSON.stringify(system) }];
  }

  return [];
}

/** Converts a single message to GenAI format */
function convertMessage(message: CompatMessage, direction: "input" | "output"): GenAIMessage {
  const normalized = normalizeKeys(message as Obj);
  const role = detectRole(normalized, direction);
  const parts: GenAIPart[] = [];

  // Extract name if present
  const name = getString(normalized, "name");

  // Check for message-level reasoning/thinking fields (Ollama, Fireworks, Together AI)
  const thinking = getString(normalized, "thinking");
  if (thinking) {
    parts.push({ type: "reasoning", content: thinking });
  }
  const reasoningContent = getString(normalized, "reasoningContent");
  if (reasoningContent) {
    parts.push({ type: "reasoning", content: reasoningContent });
  }
  const reasoning = getString(normalized, "reasoning");
  if (reasoning) {
    parts.push({ type: "reasoning", content: reasoning });
  }

  // Check for refusal (OpenAI) - store in known fields
  const refusal = getString(normalized, "refusal");
  if (refusal) {
    const metadata = storeMetadata(undefined, {}, { isRefusal: true });
    parts.push({
      type: "text",
      content: refusal,
      ...(metadata ? { _provider_metadata: metadata } : {}),
    });
  }

  // Priority 1: content field (most common)
  const content = get(normalized, "content");
  if (content !== undefined) {
    parts.push(...convertContent(content));
  }
  // Priority 2: parts field (Google Gemini style)
  else {
    const msgParts = get(normalized, "parts");
    if (Array.isArray(msgParts)) {
      for (const part of msgParts) {
        if (typeof part === "object" && part !== null) {
          parts.push(...convertPartObject(part as Obj));
        }
      }
    }
    // Priority 3: text or message field (plain text fallback)
    else {
      const text = getString(normalized, "text");
      if (text) {
        parts.push({ type: "text", content: text });
      } else {
        const msg = getString(normalized, "message");
        if (msg) {
          parts.push({ type: "text", content: msg });
        }
      }
    }
  }

  // Check for tool_calls at message level (OpenAI style)
  const toolCalls = get(normalized, "toolCalls");
  if (Array.isArray(toolCalls)) {
    for (const toolCall of toolCalls) {
      if (typeof toolCall === "object" && toolCall !== null) {
        parts.push(...convertToolCall(toolCall as Obj));
      }
    }
  }

  // Check for function_call at message level (legacy OpenAI)
  const functionCall = getObj(normalized, "functionCall");
  if (functionCall) {
    parts.push(...convertLegacyFunctionCall(functionCall));
  }

  // Handle tool response message (role: tool with tool_call_id)
  if ((role === "tool" || role === "function") && parts.length > 0) {
    const toolCallId = get(normalized, "toolCallId") ?? get(normalized, "toolUseId") ?? null;
    const toolName = get(normalized, "name") ?? get(normalized, "toolName");

    // Check if we already have tool_call_response parts from content
    const hasToolResponse = parts.some((p) => p.type === "tool_call_response");

    if (!hasToolResponse && toolCallId !== undefined) {
      // Wrap content as tool response
      const response =
        parts.length === 1 && parts[0]?.type === "text"
          ? (parts[0] as { content: string }).content
          : parts.map((p) => (p.type === "text" ? (p as { content: string }).content : p));

      // Store toolName in known fields
      const metadata = toolName ? storeMetadata(undefined, {}, { toolName: String(toolName) }) : undefined;

      return {
        role: "tool",
        parts: [
          {
            type: "tool_call_response",
            id: typeof toolCallId === "string" ? toolCallId : null,
            response,
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ],
        ...(name ? { name } : {}),
      };
    }
  }

  // If no parts were extracted, try to serialize the whole message
  if (parts.length === 0) {
    // Only serialize if there's something meaningful beyond standard/processed fields
    const keysToIgnore = [
      "role",
      "name",
      "content",
      "parts",
      "text",
      "message",
      "toolCalls",
      "functionCall",
      "thinking",
      "reasoning",
      "reasoningContent",
      "refusal",
    ];
    const hasOtherContent = Object.keys(normalized).some((k) => !keysToIgnore.includes(k));
    if (hasOtherContent) {
      parts.push({ type: "text", content: JSON.stringify(message) });
    }
  }

  return {
    role,
    parts,
    ...(name ? { name } : {}),
  };
}

/** Converts content field to GenAI parts */
function convertContent(content: unknown): GenAIPart[] {
  // String content
  if (typeof content === "string") {
    return [{ type: "text", content }];
  }

  // Array of parts
  if (Array.isArray(content)) {
    const parts: GenAIPart[] = [];
    for (const item of content) {
      if (typeof item === "string") {
        parts.push({ type: "text", content: item });
      } else if (typeof item === "object" && item !== null) {
        parts.push(...convertPartObject(item as Obj));
      }
    }
    return parts;
  }

  // Single object
  if (typeof content === "object" && content !== null) {
    return convertPartObject(content as Obj);
  }

  // Fallback: stringify anything else
  if (content !== null && content !== undefined) {
    return [{ type: "text", content: String(content) }];
  }

  return [];
}

/** Converts a single part object to GenAI parts */
function convertPartObject(part: Obj): GenAIPart[] {
  const normalized = normalizeKeys(part);
  const typeVal = getString(normalized, "type");
  const type = typeVal?.toLowerCase();

  // Type-based detection (discriminated union approach)
  if (type) {
    return convertTypedPart(normalized, type);
  }

  // Characteristic field detection (Google Gemini style - no type field)
  return convertUntypedPart(normalized);
}

/** Converts a part with a type field */
function convertTypedPart(part: Obj, type: string): GenAIPart[] {
  switch (type) {
    case "text": {
      const text = getString(part, "text") ?? getString(part, "content");
      if (text) {
        return [{ type: "text", content: text }];
      }
      return [];
    }

    case "image_url":
    case "imageurl": {
      // OpenAI style: { type: "image_url", image_url: { url: "..." } }
      const imageUrl = getObj(part, "imageUrl");
      const url = getString(imageUrl ?? {}, "url") ?? getString(imageUrl ?? {}, "uri");
      if (url) {
        return [convertImageUrl(url, part)];
      }
      return [];
    }

    case "image": {
      // Anthropic style: { type: "image", source: { type: "base64", data: "..." } }
      // VercelAI style: { type: "image", image: "..." }
      const source = getObj(part, "source");
      if (source) {
        return [convertAnthropicImageSource(source, part)];
      }
      const image = getString(part, "image");
      if (image) {
        return [convertImageUrl(image, part)];
      }
      return [];
    }

    case "input_audio":
    case "inputaudio":
    case "audio": {
      // OpenAI style: { type: "input_audio", input_audio: { data: "...", format: "..." } }
      const audioData = getObj(part, "inputAudio") ?? getObj(part, "audio");
      const data = getString(audioData ?? {}, "data") ?? getString(part, "data");
      const format = getString(audioData ?? {}, "format") ?? getString(part, "format");
      if (data) {
        const mimeType = format === "wav" ? "audio/wav" : format === "mp3" ? "audio/mp3" : "audio/mpeg";
        return [{ type: "blob", modality: "audio", mime_type: mimeType, content: data }];
      }
      return [];
    }

    case "file":
    case "document": {
      // OpenAI style: { type: "file", file: { file_id, file_data } }
      // Anthropic style: { type: "document", source: { type: "base64", data } }
      const fileObj = getObj(part, "file");
      const source = getObj(part, "source");

      if (fileObj) {
        const fileId = getString(fileObj, "fileId") ?? getString(fileObj, "file_id");
        const fileData = getString(fileObj, "fileData") ?? getString(fileObj, "file_data");
        const mimeType = getString(part, "mediaType") ?? getString(part, "mimeType") ?? getString(fileObj, "mimeType");
        const modality = inferModality(mimeType);

        if (fileId) {
          return [{ type: "file", modality, file_id: fileId, ...(mimeType ? { mime_type: mimeType } : {}) }];
        }
        if (fileData) {
          return [{ type: "blob", modality, content: fileData, ...(mimeType ? { mime_type: mimeType } : {}) }];
        }
      }

      if (source) {
        return [convertAnthropicDocumentSource(source, part)];
      }

      // VercelAI style: { type: "file", data: "...", mediaType: "..." }
      const data = getString(part, "data");
      const mediaType = getString(part, "mediaType") ?? getString(part, "mimeType");
      if (data && mediaType) {
        const modality = inferModality(mediaType);
        if (isUrlString(data)) {
          return [{ type: "uri", modality, uri: data, mime_type: mediaType }];
        }
        return [{ type: "blob", modality, content: data, mime_type: mediaType }];
      }

      return [];
    }

    case "tool_use":
    case "tooluse":
    case "tool-call":
    case "toolcall": {
      // Anthropic: { type: "tool_use", id, name, input }
      // VercelAI: { type: "tool-call", toolCallId, toolName, args }
      const id = getString(part, "id") ?? getString(part, "toolCallId");
      const name = getString(part, "name") ?? getString(part, "toolName");
      const args = get(part, "input") ?? get(part, "args") ?? get(part, "arguments") ?? get(part, "toolArguments");

      if (name) {
        return [
          {
            type: "tool_call",
            id: id ?? null,
            name,
            arguments: parseArguments(args),
          },
        ];
      }
      return [];
    }

    case "tool_result":
    case "toolresult":
    case "tool-result": {
      // Anthropic: { type: "tool_result", tool_use_id, content }
      // VercelAI: { type: "tool-result", toolCallId, toolName, output }
      const id = getString(part, "toolUseId") ?? getString(part, "toolCallId");
      const response = get(part, "content") ?? get(part, "output") ?? get(part, "result");

      return [
        {
          type: "tool_call_response",
          id: id ?? null,
          response,
        },
      ];
    }

    case "thinking":
    case "reasoning": {
      // Anthropic: { type: "thinking", thinking: "..." }
      // VercelAI: { type: "reasoning", text: "..." }
      const content = getString(part, "thinking") ?? getString(part, "text") ?? getString(part, "content");
      if (content) {
        return [{ type: "reasoning", content }];
      }
      return [];
    }

    case "redacted_thinking":
    case "redactedthinking":
    case "redacted-reasoning": {
      // Anthropic: { type: "redacted_thinking", data: "..." }
      // Map to reasoning with originalType in known fields
      const data = getString(part, "data") ?? getString(part, "content");
      if (data) {
        const metadata = storeMetadata(undefined, {}, { originalType: type });
        return [
          {
            type: "reasoning",
            content: data,
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ];
      }
      return [];
    }

    case "refusal": {
      // OpenAI: { type: "refusal", refusal: "..." }
      // Store isRefusal in known fields
      const content = getString(part, "refusal") ?? getString(part, "content");
      if (content) {
        const metadata = storeMetadata(undefined, {}, { isRefusal: true });
        return [
          {
            type: "text",
            content,
            ...(metadata ? { _provider_metadata: metadata } : {}),
          },
        ];
      }
      return [];
    }

    default: {
      // Unknown type - convert to generic part
      const content = getString(part, "text") ?? getString(part, "content");
      if (content) {
        return [{ type, content } as GenAIPart];
      }
      // Preserve as generic part with all data
      return [{ type, ...part } as GenAIPart];
    }
  }
}

/** Converts a part without a type field (Google Gemini style) */
function convertUntypedPart(part: Obj): GenAIPart[] {
  // Text part
  const text = getString(part, "text");
  if (text) {
    const isThought = get(part, "thought") === true;
    if (isThought) {
      return [{ type: "reasoning", content: text }];
    }
    return [{ type: "text", content: text }];
  }

  // Inline data (Google Gemini blob)
  const inlineData = getObj(part, "inlineData");
  if (inlineData) {
    const data = getString(inlineData, "data");
    const mimeType = getString(inlineData, "mimeType");
    if (data) {
      const modality = inferModality(mimeType);
      return [{ type: "blob", modality, content: data, ...(mimeType ? { mime_type: mimeType } : {}) }];
    }
  }

  // File data (Google Gemini URI)
  const fileData = getObj(part, "fileData");
  if (fileData) {
    const uri = getString(fileData, "fileUri") ?? getString(fileData, "uri");
    const mimeType = getString(fileData, "mimeType");
    if (uri) {
      const modality = inferModality(mimeType);
      return [{ type: "uri", modality, uri, ...(mimeType ? { mime_type: mimeType } : {}) }];
    }
  }

  // Function call (Google Gemini)
  const functionCall = getObj(part, "functionCall");
  if (functionCall) {
    const id = getString(functionCall, "id");
    const name = getString(functionCall, "name");
    const args = get(functionCall, "args") ?? get(functionCall, "arguments");
    if (name) {
      return [
        {
          type: "tool_call",
          id: id ?? null,
          name,
          arguments: parseArguments(args),
        },
      ];
    }
  }

  // Function response (Google Gemini)
  const functionResponse = getObj(part, "functionResponse");
  if (functionResponse) {
    const id = getString(functionResponse, "id");
    const name = getString(functionResponse, "name");
    const response = get(functionResponse, "response");
    // Store toolName in known fields
    const metadata = name ? storeMetadata(undefined, {}, { toolName: name }) : undefined;
    return [
      {
        type: "tool_call_response",
        id: id ?? null,
        response,
        ...(metadata ? { _provider_metadata: metadata } : {}),
      },
    ];
  }

  // Executable code (Google Gemini)
  if (get(part, "executableCode")) {
    return [{ type: "executable_code", ...part } as GenAIPart];
  }

  // Code execution result (Google Gemini)
  if (get(part, "codeExecutionResult")) {
    return [{ type: "code_execution_result", ...part } as GenAIPart];
  }

  // Fallback: if there's any content-like field, use it
  const content = getString(part, "content");
  if (content) {
    return [{ type: "text", content }];
  }

  // Last resort: serialize the part as a generic part
  return [{ type: "unknown", ...part } as GenAIPart];
}

/** Converts an OpenAI-style tool_calls array item */
function convertToolCall(toolCall: Obj): GenAIPart[] {
  const normalized = normalizeKeys(toolCall);
  const id = getString(normalized, "id");
  const type = getString(normalized, "type");

  // OpenAI function tool call: { id, type: "function", function: { name, arguments } }
  if (type === "function") {
    const func = getObj(normalized, "function");
    if (func) {
      const name = getString(func, "name");
      const args = get(func, "arguments");
      if (name) {
        return [
          {
            type: "tool_call",
            id: id ?? null,
            name,
            arguments: parseArguments(args),
          },
        ];
      }
    }
  }

  // OpenAI custom tool call: { id, type: "custom", custom: { name, input } }
  if (type === "custom") {
    const custom = getObj(normalized, "custom");
    if (custom) {
      const name = getString(custom, "name");
      const input = get(custom, "input");
      if (name) {
        return [
          {
            type: "tool_call",
            id: id ?? null,
            name,
            arguments: parseArguments(input),
          },
        ];
      }
    }
  }

  // Fallback: try to extract name and args directly (simpler format)
  const name = getString(normalized, "name") ?? getString(normalized, "toolName");
  const args = get(normalized, "arguments") ?? get(normalized, "args") ?? get(normalized, "input");
  if (name) {
    return [
      {
        type: "tool_call",
        id: id ?? null,
        name,
        arguments: parseArguments(args),
      },
    ];
  }

  return [];
}

/** Converts a legacy OpenAI function_call object */
function convertLegacyFunctionCall(functionCall: Obj): GenAIPart[] {
  const normalized = normalizeKeys(functionCall);
  const name = getString(normalized, "name");
  const args = get(normalized, "arguments");

  if (name) {
    return [
      {
        type: "tool_call",
        id: null,
        name,
        arguments: parseArguments(args),
      },
    ];
  }

  return [];
}

/** Converts an Anthropic image source to GenAI part */
function convertAnthropicImageSource(source: Obj, _part: Obj): GenAIPart {
  const normalized = normalizeKeys(source);
  const sourceType = getString(normalized, "type");

  if (sourceType === "base64") {
    const data = getString(normalized, "data");
    const mediaType = getString(normalized, "mediaType") ?? getString(normalized, "mimeType");
    if (data) {
      return {
        type: "blob",
        modality: "image",
        content: data,
        ...(mediaType ? { mime_type: mediaType } : {}),
      };
    }
  }

  if (sourceType === "url") {
    const url = getString(normalized, "url") ?? getString(normalized, "uri");
    if (url) {
      return { type: "uri", modality: "image", uri: url };
    }
  }

  // Fallback
  return { type: "blob", modality: "image", content: "" };
}

/** Converts an Anthropic document source to GenAI part */
function convertAnthropicDocumentSource(source: Obj, _part: Obj): GenAIPart {
  const normalized = normalizeKeys(source);
  const sourceType = getString(normalized, "type");
  const mediaType = getString(normalized, "mediaType") ?? getString(normalized, "mimeType");
  const modality = inferModality(mediaType);

  if (sourceType === "base64") {
    const data = getString(normalized, "data");
    if (data) {
      return {
        type: "blob",
        modality,
        content: data,
        ...(mediaType ? { mime_type: mediaType } : {}),
      };
    }
  }

  if (sourceType === "url") {
    const url = getString(normalized, "url") ?? getString(normalized, "uri");
    if (url) {
      return {
        type: "uri",
        modality,
        uri: url,
        ...(mediaType ? { mime_type: mediaType } : {}),
      };
    }
  }

  // Fallback
  return { type: "blob", modality, content: "" };
}

/** Converts a URL string to appropriate GenAI part (uri or blob for data URLs) */
function convertImageUrl(url: string, _part: Obj): GenAIPart {
  // Check for data URL (base64)
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
    if (match) {
      const mimeType = match[1] || "image/png";
      const data = match[2] || "";
      return { type: "blob", modality: "image", mime_type: mimeType, content: data };
    }
  }

  // Regular URL
  return { type: "uri", modality: "image", uri: url };
}

/** Parses tool arguments, handling JSON strings */
/** Alias for parseJsonIfString - parses tool arguments */
const parseArguments = parseJsonIfString;
