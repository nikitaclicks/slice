## Why

The agent runtime is hard-coupled to `@openrouter/agent`, which forces all model traffic through OpenRouter and requires an `OPENROUTER_API_KEY`. Switching to the Vercel AI SDK decouples provider selection from the SDK, enabling users to point Slice at local models (Ollama), GitHub Copilot, Anthropic, Azure, or any other AI SDK-compatible provider without changing application code.

## What Changes

- Replace `@openrouter/agent` with `ai` (Vercel AI SDK) and provider packages
- Replace `OPENROUTER_API_KEY` env var with provider-specific env vars (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or none for local)
- Replace `maxCost` stop condition (OpenRouter-specific) with `maxSteps`-only stopping **BREAKING**
- Model string format changes from `provider/model-name` OpenRouter style to Vercel AI SDK provider instances **BREAKING**
- Config gains a `provider` field to select which AI SDK provider to use
- Remove `@openrouter/agent` dependency entirely

## Capabilities

### New Capabilities

- `provider-selection`: Runtime selection of AI provider (OpenAI, Anthropic, Ollama, Copilot, etc.) via config or environment variable, replacing the hardcoded OpenRouter client

### Modified Capabilities

<!-- No existing spec files found in openspec/specs/ — no delta specs needed -->

## Impact

- `src/agent.ts`: Full rewrite of agent loop using Vercel AI SDK `generateText` / `streamText` with tool use
- `src/config.ts`: Add `provider` field, replace `OPENROUTER_API_KEY` check with flexible provider env resolution, remove `maxCost` or make it no-op
- `package.json`: Remove `@openrouter/agent`, add `ai`, add initial provider packages (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `ollama-ai-provider`)
- README: Update setup instructions for provider configuration
