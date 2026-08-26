# Rosetta

The translation layer for LLM provider messages.

Rosetta converts messages between different LLM providers using [**GenAI**](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/model/gen-ai), a standardized intermediate format. Just pass in messages from any provider—OpenAI, Anthropic, Google, or even custom formats—and get consistent output. No manual mapping required.

> Rosetta was made by [Latitude](https://latitude.so?utm_source=github&utm_medium=oss&utm_campaign=rosetta_ai) as an effort to standardize the observability layer for any LLM application!

## Features

- 🔄 Convert messages from any supported provider to a unified GenAI format
- 🔀 Convert GenAI messages to any supported provider format
- 🪄 **Universal fallback** - Pass messages from *any* LLM provider or framework, even unsupported ones, and we'll attempt best-effort conversion
- 🔍 Automatic provider detection when source is not specified
- 📝 Full TypeScript support with strict types
- ✅ Runtime validation with Zod schemas
- 💾 Preserve provider-specific metadata for lossless round-trips
- 📌 System message order preservation - system messages retain their original position in conversation when translating between providers
- 🌐 Works in Node.js and browsers
- 🌳 Tree-shakeable ESM build

## Installation

```bash
npm install rosetta-ai
# or
pnpm add rosetta-ai
# or
yarn add rosetta-ai
```

## Quick Start

```typescript
import { translate } from "rosetta-ai";

// Translate any LLM messages - provider is auto-detected
const openAIMessages = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Hello!" },
  { role: "assistant", content: "Hi there! How can I help you today?" },
];

const { messages, system } = translate(openAIMessages);
// messages: GenAI format messages (user + assistant)
// system: extracted system instructions
```

Works with messages from any provider:

```typescript
// OpenAI Chat Completions
const openAI = [{ role: "user", content: "Hello" }];
translate(openAI); // Just works

// Anthropic
const anthropic = [{ role: "user", content: [{ type: "text", text: "Hello" }] }];
translate(anthropic); // Just works

// Vercel AI SDK
const vercelAI = [{ role: "user", content: "Hello" }];
translate(vercelAI); // Just works

// More providers...

// Unknown provider? Also works (uses Compat fallback)
const unknown = [{ role: "user", content: "Hello" }];
translate(unknown); // Still works
```

## API

### translate

The main function for translating messages between providers.

```typescript
import { translate, Provider } from "rosetta-ai";

const { messages, system } = translate(inputMessages, {
  from: Provider.OpenAICompletions, // Source provider (optional, auto-detected if omitted)
  to: Provider.GenAI,               // Target provider (optional, defaults to GenAI)
  system: "You are helpful",        // Separated system instructions (optional)
  direction: "input",               // "input" (default) or "output"
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `from` | `Provider` | auto-detected | Source provider format |
| `to` | `Provider` | `Provider.GenAI` | Target provider format |
| `system` | `string \| object \| object[]` | - | System instructions (for providers that separate them) |
| `direction` | `"input" \| "output"` | `"input"` | Affects role interpretation when translating strings |
| `inferPriority` | `Provider[]` | `DEFAULT_INFER_PRIORITY` | Priority order for provider auto-detection |
| `filterEmptyMessages` | `boolean` | `false` | Remove empty messages (no parts, or only blank `text`/`reasoning`/`compaction` content) during translation |
| `providerMetadata` | `"preserve" \| "passthrough" \| "strip"` | `"preserve"` | How to handle provider metadata (extra fields) in translation |

**Returns:** `{ messages, system? }` - translated messages and optional system instructions

### safeTranslate

Same as `translate`, but returns an error object instead of throwing.

```typescript
import { safeTranslate } from "rosetta-ai";

const result = safeTranslate(messages, options);

if (result.error) {
  // Handle error: result.error is Error
} else {
  // Use result.messages (properly typed)
}
```

### Input Flexibility

Messages and system instructions accept flexible formats:

```typescript
// Messages: string, object, or array
translate("Hello!");                              // String → single message
translate({ role: "user", content: "Hello!" });   // Single provider message
translate([{ role: "user", content: "Hello!" }]); // Array of provider messages

// System: string, object, or array
translate(messages, { system: "You are helpful" });
translate(messages, { system: { type: "text", content: "Be helpful" } });
translate(messages, { system: [{ type: "text", content: "Part 1" }, { type: "text", content: "Part 2" }] });
```

## Common Use Cases

### Translate API responses for storage or display

```typescript
import OpenAI from "openai";
import { translate, Provider } from "rosetta-ai";

const openai = new OpenAI();
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "What's the weather?" }],
});

// Translate OpenAI response to unified GenAI format
const { messages } = translate([completion.choices[0].message], {
  from: Provider.OpenAICompletions,
});

// Now you have a consistent format regardless of which provider you used
console.log(messages[0].parts[0]); // { type: "text", content: "..." }
```

### Cross-provider translation

```typescript
import { translate, Provider } from "rosetta-ai";

// Translate OpenAI messages to Vercel AI SDK format
const openAIMessages = [
  { role: "system", content: "You are helpful." },
  { role: "user", content: "Hello!" },
];

const { messages } = translate(openAIMessages, {
  from: Provider.OpenAICompletions,
  to: Provider.VercelAI,
});
// Result: Vercel AI SDK compatible messages
```

### Handle tool calls across providers

```typescript
import { translate, Provider } from "rosetta-ai";

// OpenAI tool call format
const openAIWithToolCall = [
  {
    role: "assistant",
    content: null,
    tool_calls: [{
      id: "call_abc123",
      type: "function",
      function: { name: "get_weather", arguments: '{"location":"Paris"}' },
    }],
  },
  {
    role: "tool",
    tool_call_id: "call_abc123",
    content: '{"temp": 20}',
  },
];

// Translates to unified GenAI format with tool_call and tool_call_response parts
const { messages } = translate(openAIWithToolCall, {
  from: Provider.OpenAICompletions,
});

// Tool call part
messages[0].parts[0]; // { type: "tool_call", id: "call_abc123", name: "get_weather", arguments: { location: "Paris" }, ... }

// Tool response part
messages[1].parts[0]; // { type: "tool_call_response", id: "call_abc123", response: {...}, ... }
```

### Translate multimodal content

```typescript
import { translate, Provider } from "rosetta-ai";

const anthropicWithImage = [
  {
    role: "user",
    content: [
      { type: "text", text: "What's in this image?" },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: "iVBORw0KGgo...",
        },
      },
    ],
  },
];

const { messages } = translate(anthropicWithImage, {
  from: Provider.Anthropic,
});

// Image converted to blob part
messages[0].parts[1]; // { type: "blob", modality: "image", mime_type: "image/png", content: "..." }
```

### Safe translation with error handling

```typescript
import { safeTranslate } from "rosetta-ai";

const result = safeTranslate(unknownMessages);

if (result.error) {
  console.error("Translation failed:", result.error.message);
} else {
  console.log("Translated:", result.messages);
}
```

## Supported Providers

| Provider | toGenAI | fromGenAI | System In | System Out | Description |
|----------|---------|-----------|-----------|------------|-------------|
| GenAI | ✅ | ✅ | Both | Separated | Intermediate format (default target) |
| Promptl | ✅ | ✅ | Inline | Inline | [promptl-ai](https://github.com/latitude-dev/promptl) format |
| Vercel AI | ✅ (v6/7) | ✅ (v6) | Both | Inline | Vercel AI SDK messages |
| OpenAI Completions | ✅ | - | Inline | - | Chat Completions API |
| OpenAI Responses | ✅ | - | Inline | - | Responses API |
| Anthropic | ✅ | - | Both | - | Messages API |
| Google Gemini | ✅ | - | Both | - | GenerateContent API |
| Compat | ✅ | - | Both | - | Universal fallback |

- **toGenAI** = Can translate *from* this provider to GenAI (source)
- **fromGenAI** = Can translate *to* this provider from GenAI (target)
- **System In** = How system instructions are accepted as input: *Inline* (`system` messages within the conversation), *Separated* (`system` field), or *Both*
- **System Out** = Where system instructions are emitted as output: *Inline* (`system` messages within the conversation), *Separated* (`system` field)

**System message order preservation**: When translating to a provider that separates system instructions (like GenAI), system messages are extracted from the conversation and returned in the `system` field. Rosetta preserves the original position of each system message so that when translating back to a provider with inline system messages (like Promptl or Vercel AI), the system messages are re-inserted at their original positions in the conversation.

### Universal Compatibility

The **Compat** provider is a universal fallback that handles messages from *any* LLM provider—even ones not explicitly supported. When you call `translate()` without specifying a source provider, Rosetta tries to match against known provider schemas. If none match, it automatically falls back to Compat, which:

- Normalizes field names across conventions (`tool_calls`, `toolCalls`, `tool-calls` all work)
- Detects common patterns: roles, content arrays, tool calls, images, reasoning, etc.
- Handles formats from Cohere, Mistral, Ollama, AWS Bedrock, LangChain, and more
- Preserves unrecognized data so nothing is lost

```typescript
// Works with any provider - no need to specify the source
const messages = [
  { role: "user", content: "Hello" },
  { role: "assistant", toolCalls: [{ id: "1", function: { name: "search", arguments: "{}" } }] },
];

const { messages: translated } = translate(messages); // Auto-detected and translated
```

More providers will be added. See [AGENTS.md](./AGENTS.md) for contribution guidelines.

## GenAI Format

GenAI is the intermediate format used for translation, and it tracks the [OpenTelemetry GenAI message schemas](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/model/gen-ai). A single schema covers both input and output messages, so `finish_reason` is optional (it only applies to output messages). It provides a unified representation of LLM messages across all providers:

```typescript
import type { GenAIMessage, GenAISystem } from "rosetta-ai";

const message: GenAIMessage = {
  role: "user",           // "user" | "assistant" | "system" | "tool" | string
  parts: [                // Array of content parts
    { type: "text", content: "What's in this image?" },
    { type: "uri", uri: "https://example.com/cat.jpg", modality: "image" },
  ],
  name: "Alice",          // Optional: participant name
  finish_reason: "stop",  // Optional (output messages only): why the model stopped
};

const system: GenAISystem = [
  { type: "text", content: "You are a helpful assistant." },
];
```

Roles, modalities and finish reasons accept the named values below, plus any other string for provider-specific values:

| Field | Named values |
|-------|--------------|
| `role` | `system`, `user`, `assistant`, `tool` |
| `modality` | `image`, `video`, `audio`, `document` |
| `finish_reason` | `stop`, `length`, `content_filter`, `tool_call`, `compaction`, `error` |

### Part Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `text` | Plain text content | `content` |
| `blob` | Binary data (base64) | `content`, `mime_type`, `modality` |
| `file` | File reference by ID | `file_id`, `modality` |
| `uri` | URL reference | `uri`, `modality` |
| `reasoning` | Model thinking/reasoning | `content` |
| `tool_call` | Tool/function call request | `id`, `name`, `arguments` |
| `tool_call_response` | Tool/function result | `id`, `response` |
| `server_tool_call` | Provider-executed tool call (e.g. web search) | `id`, `name`, `server_tool_call` |
| `server_tool_call_response` | Provider-executed tool result | `id`, `server_tool_call_response` |
| `compaction` | Compacted conversation state | `id`, `content` |
| `generic` | Custom/extensible type | `type`, any additional fields |

Unknown part types are always accepted as generic parts, so messages using parts that Rosetta doesn't model yet still translate.

### Unsupported Parts

GenAI covers more part types than any single provider format. Rosetta never drops the extras silently: every part a target cannot represent is converted to the closest part it can, with the source type recorded in `_knownFields.originalType` so you can still tell what it was.

| Part | GenAI target | Promptl target | Vercel AI target |
|------|--------------|----------------|------------------|
| `server_tool_call` | kept as-is | `tool-call` | `tool-call` with `providerExecuted: true` |
| `server_tool_call_response` | kept as-is | `tool-result` | `tool-result` with `providerExecuted: true` |
| `compaction` | kept as-is | `text` part | `text` part |

Compaction becomes text because the summary is conversation content: the model is given it in place of the turns it replaced, so dropping it from a translated prompt would discard the whole history it stands for.

```typescript
const { messages } = translate(genAIMessages, { to: Provider.Promptl });

messages[0].content[0];
// { type: "text", text: "Summary of the earlier turns.",
//   _providerMetadata: { _knownFields: { originalType: "compaction" } } }
```

When a provider only exposes an encrypted compaction item there is no summary to carry, so it becomes an **empty** text part — the compaction stays visible in the conversation, and [`filterEmptyMessages`](#translate) drops the message if that is all it contained.

Translating to GenAI is always lossless: every part is kept, whatever its type.

### Provider Metadata

All GenAI entities support `_provider_metadata` to preserve extra fields during translation. The metadata has two types of fields:

1. **`_known_fields`**: Cross-provider semantic data (`toolName`, `isError`, `isRefusal`, `originalType`) used to build accurate translations
2. **Extra fields**: Provider-specific data preserved for round-trips

Reserved fields are written in the target's casing (`_known_fields` vs `_knownFields`, `_parts_metadata` vs `_partsMetadata`) and read in either, so messages stay translatable no matter which provider produced them.

```typescript
const message: GenAIMessage = {
  role: "tool",
  parts: [{
    type: "tool_call_response",
    id: "call_123",
    response: "Error occurred",
    _provider_metadata: {
      // Known fields - used by target providers to build accurate translations
      _known_fields: {
        toolName: "get_weather",  // Tool name (GenAI schema doesn't include it)
        isError: true,            // Error indicator
      },
      // Parts metadata - collapsed part-level metadata (for providers with string-only content)
      _partsMetadata: {
        _promptlSourceMap: [...], // Part metadata moved to message level
      },
      // Extra fields - any other provider-specific data
      annotations: [...],
    },
  }],
};
```

**Note on `_partsMetadata`**: Some providers require string content for certain message types (e.g., VercelAI system messages). When translating to these providers, part-level metadata is collected and stored in `_partsMetadata` at the message level. When translating back to a provider that supports structured content, this metadata is automatically restored to the first content part. **Important**: In passthrough mode, if the target provider doesn't support structured content (like VercelAI system messages), part-level metadata stored in `_partsMetadata` will be lost. Use **preserve** mode if you need to retain this metadata through round-trips.

#### Provider Metadata Mode

The `providerMetadata` option controls how metadata (extra fields) is handled in the output.

| Mode | Description |
|------|-------------|
| `"preserve"` (default) | Keep `_provider_metadata` nested in output entities |
| `"passthrough"` | Spread extra fields as direct properties on output entities |
| `"strip"` | Don't include metadata (only use `_known_fields` for translation) |

```typescript
import { translate, Provider } from "rosetta-ai";

// Preserve metadata (default) - keeps _provider_metadata in output
translate(messages, { from: Provider.Promptl, to: Provider.GenAI });

// Passthrough - spread extra fields on output entities for lossless round-trips
translate(messages, { from: Provider.GenAI, to: Provider.Promptl, providerMetadata: "passthrough" });

// Strip - clean output without metadata
translate(messages, { to: Provider.VercelAI, providerMetadata: "strip" });
```

**Note**: When translating between the same provider (e.g., GenAI → GenAI), `providerMetadata` is automatically set to `"passthrough"` to ensure lossless round-trips, regardless of the configured setting.

## TypeScript Support

All types are exported for type-safe usage:

```typescript
import {
  // Core types
  type GenAIMessage,
  type GenAIPart,
  type GenAISystem,
  
  // API types
  type TranslateOptions,
  type TranslateResult,
  
  // Provider types
  Provider,
  type ProviderMessage,
  type ProviderSystem,
} from "rosetta-ai";

// Type-safe translation
const result: TranslateResult<Provider.GenAI> = translate(messages);

// Access provider-specific message types
type OpenAIMsg = ProviderMessage<Provider.OpenAICompletions>;
```

## Examples

The [examples](./examples) folder contains E2E tests demonstrating real-world usage with actual provider SDKs:

```bash
cd examples
pnpm install
pnpm test  # Runs tests (imports directly from src, no build needed)
```

Tests include:
- **Real API calls** (when API keys are set) - validates against actual provider responses
- **Hardcoded messages** - runs without API keys for fast iteration

## Development

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/latitude-dev/rosetta-ts.git
cd rosetta-ts

# Install dependencies
pnpm install
```

### Commands

| Command        | Description                            |
| -------------- | -------------------------------------- |
| `pnpm install` | Install dependencies                   |
| `pnpm build`   | Build the package                      |
| `pnpm dev`     | Build in watch mode                    |
| `pnpm test`    | Run tests                              |
| `pnpm lint`    | Check for lint, format and type errors |
| `pnpm format`  | Format code and fixable lint errors    |

## Adding a New Provider

The [AGENTS.md](./AGENTS.md) file contains extensively curated guidelines for AI coding agents, including detailed step-by-step instructions for adding new providers. The easiest way to add a provider is to give a coding agent (like Cursor, Claude, or similar) the provider's message schema along with a prompt like this:

```
Based on the attached [Provider Name] message schema (see attached), add a
[Provider Name] provider to the package. Follow ALL the guidelines in AGENTS.md.

- This provider will be source-only / source and target.
- This provider does / does not separate system instructions from the message list.
- Build a unified schema if the provider has separate types for input and output.
```

The schema can be in any format the agent can understand: TypeScript SDK types, JSON Schema, OpenAPI definitions, Python types, or even API documentation.

**Example prompt for adding Google Gemini:**

```
Based on the attached Google Gemini TypeScript SDK types (specifically the
messages and system instructions for the GenerateContent function), add a
Google provider to the package. Follow ALL the guidelines in AGENTS.md.

- This provider will be source-only, not a target.
- This provider separates system instructions from the message list.
- Build a unified schema since the provider has different types for input and output.
```

The agent will handle creating the schema files, implementing the specification, registering the provider, writing tests, and updating documentation—all following the project's conventions.

## License

MIT - see [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome! Please read [AGENTS.md](./AGENTS.md) for detailed contribution guidelines, including architecture decisions, coding standards, and the step-by-step process for adding new providers.
