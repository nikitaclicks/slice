## Context

Slice's agent runtime (`src/agent.ts`) is built on `@openrouter/agent`, a thin wrapper around the OpenRouter API. This creates two problems: (1) all inference must route through OpenRouter, requiring an account and API key; (2) the `@openrouter/agent/tool` helper is used in every tool file, so the entire tools layer is coupled to the same dependency.

The [Vercel AI SDK](https://sdk.vercel.ai) (`ai` package) is a provider-agnostic TypeScript SDK. It ships first-party adapters for OpenAI (`@ai-sdk/openai`), Anthropic (`@ai-sdk/anthropic`), Google, Azure, and community adapters for Ollama (`ollama-ai-provider`), GitHub Copilot (via Azure OpenAI), and any OpenAI-compatible endpoint. Switching gives users a single consistent interface regardless of where their model runs.

**Current state summary**:
- `@openrouter/agent` used in: `src/agent.ts`, `src/tools/*.ts` (via `@openrouter/agent/tool`)
- Config holds `apiKey` (OpenRouter key) and `model` (OpenRouter model string e.g. `nvidia/...`)
- `maxCost` stop condition is an OpenRouter-specific feature (cost per response)
- Tool format: `tool({ name, description, inputSchema, execute })`

## Goals / Non-Goals

**Goals:**
- Replace `@openrouter/agent` with `ai` (Vercel AI SDK) + provider packages
- Support local models (Ollama), Anthropic, OpenAI, OpenRouter (via OpenAI-compat base URL), and any future AI SDK provider
- Preserve the streaming `AgentEvent` interface consumed by the CLI renderer
- Preserve the `tools` array shape so MCP-injected tools continue to work
- Migrate all tool files off `@openrouter/agent/tool` → `ai`'s `tool()`

**Non-Goals:**
- Supporting non-AI-SDK providers (custom HTTP clients, raw WebSockets, etc.)
- Cost tracking / `maxCost` enforcement (no equivalent in AI SDK; remove for now)
- UI changes to the CLI renderer

## Decisions

### D1: Provider resolution via `provider` config field + env vars

Instead of a single `OPENROUTER_API_KEY`, config gains a `provider` string (`openai` | `anthropic` | `ollama` | `openrouter` | `azure`) plus a `baseURL` override for custom endpoints. Provider-specific API keys are read from standard env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.).

**Alternatives considered:**
- *Single `AI_API_KEY` shim*: Simpler but doesn't allow provider-specific options (Ollama needs no key; Azure needs tenant config).
- *Model URI scheme (`ollama://llama3.2`)*: Clever but non-standard and harder to document.

**Chosen**: Explicit `provider` field is the most transparent and matches Vercel AI SDK's own docs pattern.

### D2: `streamText` with `maxSteps` for the agentic loop

Vercel AI SDK's `streamText` with `maxSteps > 1` handles the tool-call → tool-result → continue loop internally, emitting stream events we can map to `AgentEvent`. This replaces the manual `for await` loop over `getItemsStream()`.

**Alternatives considered:**
- *`generateText` (non-streaming)*: No streaming support; breaks the CLI live output.
- *Manual tool loop with `generateText`*: More control but re-implements what `streamText({ maxSteps })` already does.

**Chosen**: `streamText` + `maxSteps` is the canonical AI SDK agentic pattern.

### D3: Tool format migration — `ai`'s `tool()` helper

Vercel AI SDK's `tool()` takes `{ description, parameters, execute }` (uses `parameters` instead of `inputSchema`, no `name` field — name comes from the object key when passed to `streamText`). All tool files need to update the import and rename `inputSchema` → `parameters`.

**Alternatives considered:**
- *Wrapper shim to keep old format*: Adds indirection and maintenance burden.

**Chosen**: Direct migration; the change is mechanical and keeps the codebase clean.

### D4: OpenRouter remains supported via OpenAI-compat adapter

`@ai-sdk/openai` accepts a `baseURL` override. Setting `baseURL: "https://openrouter.ai/api/v1"` and `OPENAI_API_KEY = <openrouter key>` restores full OpenRouter compatibility. The `provider: "openrouter"` config value handles this automatically.

### D5: Remove `maxCost`, keep `maxSteps`

The Vercel AI SDK has no built-in cost tracking. `maxCost` in config becomes a no-op field (kept in the interface for backwards compat with `agent.config.json` files) but is not enforced. A comment in config documents this.

## Risks / Trade-offs

- **Tool name collision** → AI SDK derives tool names from object keys; if two tools share a key, the last one silently wins. Mitigation: keep tool names as the object key (same as current `name` field), add a uniqueness check in `tools/index.ts`.
- **Streaming event shape differs** → `streamText` emits `textDelta`, `toolCallStreamingStart`, `toolCallDelta`, `toolResult` events, not `message`/`function_call` items. The `AgentEvent` adapter in `agent.ts` must be rewritten carefully. Mitigation: unit-test the event adapter with mock streams.
- **Ollama doesn't support all tool-call features** → Some local models don't return structured tool calls. Mitigation: document this as a known limitation; no runtime workaround needed.
- **`maxCost` removed** → Users relying on cost caps lose that safety net. Mitigation: document removal in changelog; `maxSteps` still bounds runaway agents.

## Migration Plan

1. Install `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `ollama-ai-provider`; remove `@openrouter/agent`
2. Migrate all `src/tools/*.ts` files: change import, rename `inputSchema` → `parameters`, remove `name` field (name becomes object key in index)
3. Rewrite `src/agent.ts` using `streamText` + event adapter
4. Update `src/config.ts`: add `provider` field, replace `OPENROUTER_API_KEY` with provider resolution, deprecate `maxCost`
5. Update README with new provider config instructions

No database migrations or deployment steps needed — this is a local CLI tool.

**Rollback**: `git revert` the migration commit; the old `@openrouter/agent` package is still available on npm.

## Open Questions

- Should the default provider ship as `openai` (most common) or remain `openrouter` for backwards compatibility with existing users? → Recommend keeping `openrouter` default (via OpenAI compat) so existing `OPENROUTER_API_KEY` users aren't broken.
