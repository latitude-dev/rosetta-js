# Rosetta E2E Tests

This folder contains E2E tests for each provider supported by the rosetta-ai package. These tests use real provider libraries to ensure translations work correctly in practice.

## Setup

```bash
cd examples
pnpm install
```

## Running Tests

```bash
# Run all E2E tests
pnpm test
```

**No rebuild needed!** The tests import directly from the source code (`../src`), so you can edit the library and immediately run tests without rebuilding.

## Test Files

### GenAI (`genai.test.ts`)

Tests the core GenAI format with hardcoded messages. Since GenAI is the intermediate format, this validates:

- Identity translation (GenAI → GenAI)
- Auto-inference of GenAI provider
- Translation to Promptl
- Tool calls
- Reasoning parts
- String input convenience
- Round-trip translations

### Promptl (`promptl.test.ts`)

Uses the [promptl-ai](https://github.com/latitude-dev/promptl) package to test real library output:

- Simple conversations compiled from PromptL syntax
- Auto-inference of Promptl provider
- Dynamic prompts with variables
- Legacy `toolArguments` field (backwards compatibility)
- New `args` field
- Legacy tool message format (`toolName`/`toolId` at message level)
- New `tool-result` content format
- Reasoning and redacted-reasoning content
- `toolCalls` array in assistant messages
- Round-trip translations with extended types
- System message extraction

### OpenAI Completions (`openai_completions.test.ts`)

**Note**: The OpenAI Completions provider is not yet fully implemented. Contains placeholder tests that will be enabled once the provider is complete.

## Auto-Inference Testing

Each test suite includes tests for the auto-inference feature. When you pass messages to `translate()` without specifying the `from` option, Rosetta automatically detects the provider format:

```typescript
// Explicit provider specification
const result = translate(messages, { from: Provider.GenAI });

// Auto-inference (Rosetta detects the provider automatically)
const autoResult = translate(messages);
```

## Configuration

The `vitest.config.ts` is configured to:

1. Import `rosetta-ai` from source (`../src/index.ts`)
2. Support the `$package` alias for internal imports
3. Run all `*.test.ts` files

This allows rapid development: edit source → run tests → see results immediately.
