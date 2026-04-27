## 1. Dependencies

- [x] 1.1 Remove `@openrouter/agent` from `package.json` and install `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `ollama-ai-provider`
- [x] 1.2 Run `npm install` and verify no import errors from removed package

## 2. Tool Migration

- [x] 2.1 Update `src/tools/file-read.ts`: change import from `@openrouter/agent/tool` to `ai`, rename `inputSchema` → `parameters`, remove `name` field
- [x] 2.2 Update `src/tools/file-write.ts`: same migration as 2.1
- [x] 2.3 Update `src/tools/file-edit.ts`: same migration as 2.1
- [x] 2.4 Update `src/tools/glob.ts`: same migration as 2.1
- [x] 2.5 Update `src/tools/grep.ts`: same migration as 2.1
- [x] 2.6 Update `src/tools/list-dir.ts`: same migration as 2.1
- [x] 2.7 Update `src/tools/shell.ts`: same migration as 2.1
- [x] 2.8 Update `src/tools/index.ts`: change `tools` export from array to named-key record (`{ file_read: fileReadTool, ... }`) to satisfy Vercel AI SDK tool name convention

## 3. Config Update

- [x] 3.1 Add `provider` field to `AgentConfig` interface with type `"openai" | "anthropic" | "ollama" | "openrouter" | "azure"` and default `"openrouter"`
- [x] 3.2 Add `baseURL` optional field to `AgentConfig` interface
- [x] 3.3 Update `loadConfig` in `src/config.ts`: resolve API key from provider-specific env var (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) in addition to `OPENROUTER_API_KEY`
- [x] 3.4 Update the "missing API key" error message to reference the correct env var for the selected provider (ollama gets no error)
- [x] 3.5 Mark `maxCost` as deprecated in the interface (keep field for config file compat, but stop enforcing it)

## 4. Agent Runtime Rewrite

- [x] 4.1 Add provider factory function in `src/agent.ts` that maps `config.provider` to a Vercel AI SDK model instance (using `createOpenAI`, `createAnthropic`, `createOllama`, etc.)
- [x] 4.2 Replace `client.callModel(...)` with `streamText({ model, system, messages, tools, maxSteps })` from `ai`
- [x] 4.3 Rewrite the streaming event adapter: map `textDelta` → `AgentEvent.text`, `toolCall` → `AgentEvent.tool_call`, `toolResult` → `AgentEvent.tool_result`, `reasoning` → `AgentEvent.reasoning`
- [x] 4.4 Update `runAgent` return value to pull `text` and `usage` from the `streamText` result object
- [x] 4.5 Verify `runAgentWithRetry` still works (error shape may differ; check for HTTP status codes from AI SDK errors)

## 5. MCP Tool Compatibility

- [x] 5.1 Audit `src/modules/mcp-client.ts` to verify that MCP-injected extra tools also use the `ai` tool format (or adapt them in `commands.ts` where `extraTools` is assembled)

## 6. Verification

- [x] 6.1 Run `npx tsc --noEmit` and fix all TypeScript errors
- [ ] 6.2 Manually test with `provider: "openrouter"` (default) to confirm existing users are unbroken
- [ ] 6.3 Manually test with `provider: "ollama"` and a locally running Ollama instance
- [x] 6.4 Update README: replace `OPENROUTER_API_KEY` setup section with provider configuration guide covering openrouter (default), openai, anthropic, and ollama
