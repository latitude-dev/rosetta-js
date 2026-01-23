# Rosetta

The translation layer for LLM provider messages.

Rosetta converts messages between different LLM providers using [**GenAI**](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/), a standardized intermediate format. Just pass in messages from any provider—OpenAI, Anthropic, Google, or even custom formats—and get consistent output. No manual mapping required.

## Features

- 🔄 Convert messages from any supported provider to a unified GenAI format
- 🔀 Convert GenAI messages to any supported provider format
- 🪄 **Universal fallback** - Pass messages from *any* LLM provider or framework, even unsupported ones, and we'll attempt best-effort conversion
- 🔍 Automatic provider detection when source is not specified
- 📝 Full TypeScript support with strict types
- ✅ Runtime validation with Zod schemas
- 💾 Preserve provider-specific metadata for lossless round-trips
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

### Translator Class

For advanced configuration, create a `Translator` instance:

```typescript
import { Translator, Provider } from "rosetta-ai";

const translator = new Translator({
  // Custom priority order for provider auto-detection
  inferPriority: [Provider.OpenAICompletions, Provider.Anthropic, Provider.GenAI],
});

const { messages } = translator.translate(inputMessages);
const safeResult = translator.safeTranslate(inputMessages);
```

### Input Flexibility

Messages and system instructions accept flexible formats:

```typescript
// Messages: string or array
translate("Hello!");                              // String → single message
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
messages[0].parts[0]; // { type: "tool_call", name: "get_weather", arguments: { location: "Paris" }, ... }

// Tool response part  
messages[1].parts[0]; // { type: "tool_call_response", call_id: "call_abc123", content: {...}, ... }
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

| Provider | toGenAI | fromGenAI | Separated System | Description |
|----------|---------|-----------|-----------------|-------------|
| GenAI | ✅ | ✅ | Optional | Intermediate format (default target) |
| Promptl | ✅ | ✅ | - | [promptl-ai](https://github.com/latitude-dev/promptl) format |
| Vercel AI | ✅ | ✅ | - | Vercel AI SDK messages |
| OpenAI Completions | ✅ | - | - | Chat Completions API |
| OpenAI Responses | ✅ | - | - | Responses API |
| Anthropic | ✅ | - | Yes | Messages API |
| Google Gemini | ✅ | - | Yes | GenerateContent API |
| Compat | ✅ | - | Optional | Universal fallback |

- **toGenAI** = Can translate *from* this provider to GenAI (source)
- **fromGenAI** = Can translate *to* this provider from GenAI (target)
- **Separated System** = Provider separates system instructions from messages (use the `system` option if needed)

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

GenAI is the intermediate format used for translation, inspired by the [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/). It provides a unified representation of LLM messages across all providers:

```typescript
import type { GenAIMessage, GenAISystem } from "rosetta-ai";

const message: GenAIMessage = {
  role: "user",           // "user" | "assistant" | "system" | "tool" | string
  parts: [                // Array of content parts
    { type: "text", content: "What's in this image?" },
    { type: "uri", uri: "https://example.com/cat.jpg", modality: "image" },
  ],
  name: "Alice",          // Optional: participant name
  finish_reason: "stop",  // Optional: why the model stopped
};

const system: GenAISystem = [
  { type: "text", content: "You are a helpful assistant." },
];
```

### Part Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `text` | Plain text content | `content` |
| `blob` | Binary data (base64) | `content`, `mime_type`, `modality` |
| `file` | File reference by ID | `file_id`, `modality` |
| `uri` | URL reference | `uri`, `modality` |
| `reasoning` | Model thinking/reasoning | `content` |
| `tool_call` | Tool/function call request | `call_id`, `name`, `arguments` |
| `tool_call_response` | Tool/function result | `call_id`, `content` |
| `generic` | Custom/extensible type | `content`, any additional fields |

### Provider Metadata

All GenAI entities support `_provider_metadata` to preserve provider-specific data during translation. This enables lossless round-trips:

```typescript
const message: GenAIMessage = {
  role: "assistant",
  parts: [{
    type: "text",
    content: "I cannot help with that.",
    _provider_metadata: {
      openai_completions: { isRefusal: true },  // Preserved from OpenAI
    },
  }],
};
```

Metadata keys match the provider enum values: `openai_completions`, `anthropic`, `google`, `vercel_ai`, etc.

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
