## Context

The agent runs as a CLI tool powered by Vercel AI SDK's `streamText`. Tools are defined in `src/tools/index.ts` as Vercel AI SDK `tool()` objects with Zod schemas and an `execute` function. When the model calls a tool, the SDK invokes `execute`, waits for the result, then feeds it back to the model as a tool-result message — the model then continues its turn.

The `ask_question` tool leverages this built-in pause/resume mechanism: `execute` prompts the user via stdin and returns their answer. No architecture changes are needed — it's just a new tool entry.

## Goals / Non-Goals

**Goals:**
- Allow the model to ask the user a question mid-turn and receive an answer without ending the agent loop
- Surface the question clearly in the CLI so the user knows input is expected
- Return the user's answer as the tool result so the model can proceed

**Non-Goals:**
- Multiple simultaneous questions (one at a time)
- Rich input types (file uploads, multi-select) — plain text only
- Web/GUI frontend support (CLI-only for this change)
- Persisting Q&A history separately from the conversation

## Decisions

### Use tool `execute` for blocking input — not a separate event type

**Decision**: Prompt for user input directly inside the tool's `execute` function using Node's `readline` or `process.stdin`.

**Why**: The Vercel AI SDK already pauses the model turn while `execute` runs. There's no need to introduce a new event type or out-of-band signaling mechanism. The answer returns as a normal tool-result, and the model sees it in context immediately.

**Alternative considered**: Emit a special `ask_question` AgentEvent and handle it in the CLI event loop. Rejected because it requires threading a response callback back into the agent, complicating the data flow with no benefit.

### Add as a built-in tool, always present

**Decision**: Register `ask_question` in `src/tools/index.ts` alongside other built-in tools so it's always available to the model.

**Why**: The tool is universally useful and has no side effects that would require opt-in gating. Always-on keeps the model's system prompt simpler.

**Alternative considered**: Pass it as an `extraTool` from the CLI layer. Rejected — built-in tools have cleaner ergonomics and consistent availability.

## Risks / Trade-offs

- [Nested tool calls] If the model calls `ask_question` inside a `maxSteps` loop, stdin must not be consumed by another concurrent read → Mitigation: Node readline is inherently sequential; no concurrent reads in the current architecture.
- [Non-interactive environments] CI or piped stdin will hang → Mitigation: detect `process.stdin.isTTY`; if false, return an error result instructing the model to proceed without user input.
- [User ignores the prompt] No timeout mechanism → accepted trade-off for v1; can add timeout later.
