## ADDED Requirements

### Requirement: Provider is configurable via config field
The system SHALL support a `provider` field in `AgentConfig` and `agent.config.json` that selects the active AI provider. Supported values SHALL be: `openai`, `anthropic`, `ollama`, `openrouter`, `azure`. When no `provider` is specified, the system SHALL default to `openrouter` for backwards compatibility.

#### Scenario: User sets provider to anthropic in config file
- **WHEN** `agent.config.json` contains `{ "provider": "anthropic", "model": "claude-3-5-sonnet-20241022" }`
- **THEN** the agent SHALL use the Anthropic provider and read `ANTHROPIC_API_KEY` from the environment

#### Scenario: User sets provider to ollama for local inference
- **WHEN** `agent.config.json` contains `{ "provider": "ollama", "model": "llama3.2" }` and no API key is set
- **THEN** the agent SHALL use the Ollama provider pointed at `http://localhost:11434` and require no API key

#### Scenario: Default provider preserves OpenRouter compatibility
- **WHEN** no `provider` field is set and `OPENROUTER_API_KEY` is present in the environment
- **THEN** the agent SHALL use the OpenAI-compatible adapter with OpenRouter's base URL and the existing API key

### Requirement: Provider-specific API keys are resolved from environment
The system SHALL resolve API keys from standard per-provider environment variables rather than a single shared variable. The mapping SHALL be: `openai` → `OPENAI_API_KEY`, `anthropic` → `ANTHROPIC_API_KEY`, `openrouter` → `OPENROUTER_API_KEY` (or `OPENAI_API_KEY`), `azure` → `AZURE_OPENAI_API_KEY`. `ollama` SHALL require no API key.

#### Scenario: Missing API key for a keyed provider
- **WHEN** `provider` is set to `openai` but `OPENAI_API_KEY` is not set
- **THEN** the system SHALL throw a clear error: `OPENAI_API_KEY is required for provider "openai"`

#### Scenario: Ollama requires no API key
- **WHEN** `provider` is `ollama` and no API key env var is set
- **THEN** the system SHALL start the agent without error

### Requirement: Custom base URL overrides provider endpoint
The system SHALL support a `baseURL` field in `AgentConfig` and `agent.config.json` that overrides the provider's default API endpoint. This SHALL enable self-hosted models and proxy endpoints.

#### Scenario: User points openai provider at a local proxy
- **WHEN** `agent.config.json` contains `{ "provider": "openai", "baseURL": "http://localhost:8080/v1" }`
- **THEN** all inference requests SHALL be sent to `http://localhost:8080/v1` instead of `api.openai.com`

### Requirement: Tool definitions use Vercel AI SDK format
All tools in `src/tools/*.ts` SHALL use the `tool()` helper from the `ai` package with `description`, `parameters` (Zod schema), and `execute` fields. The `name` field SHALL be removed from the tool definition; the tool name SHALL be the object key when assembling the tools record.

#### Scenario: Tool executes correctly with new format
- **WHEN** the agent invokes a tool by its object-key name (e.g. `file_read`)
- **THEN** the tool's `execute` function SHALL be called with validated parameters matching the Zod schema

### Requirement: Agent streaming events preserve existing shape
The agent runtime SHALL emit `AgentEvent` values (`text`, `tool_call`, `tool_result`, `reasoning`) with the same structure as before, regardless of which provider is active.

#### Scenario: Text streaming with a new provider
- **WHEN** the agent runs with `provider: "anthropic"` and produces a text response
- **THEN** the `onEvent` callback SHALL receive `{ type: "text", delta: "..." }` events in streaming order

#### Scenario: Tool call event emitted
- **WHEN** the agent invokes a tool during inference
- **THEN** the `onEvent` callback SHALL receive `{ type: "tool_call", name, callId, args }` followed by `{ type: "tool_result", name, callId, output }`
