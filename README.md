# Slice

A token-efficient, terminal-based AI coding assistant powered by the [Vercel AI SDK](https://sdk.vercel.ai). Run it against OpenRouter, OpenAI, Anthropic, Ollama, or any OpenAI-compatible endpoint.

Slice keeps context small, reads only what it needs, and responds tersely — designed for developers who want a fast assistant that stays out of the way.

## Features

- **Block/bordered/plain input styles** — Adaptive terminal background, Tab completion for commands
- **Multi-turn conversation** — Full history passed to the model for context continuity
- **File tools** — `file_read`, `file_write`, `file_edit`, `glob`, `grep`, `list_dir`, `shell`
- **Slash commands** — `/model`, `/new`, `/help`, `/compact`, `/session`, `/export`
- **Context compaction** — LLM-powered summarization of long conversations via `/compact`
- **Provider-agnostic** — OpenRouter (default), OpenAI, Anthropic, Ollama, or any OpenAI-compatible endpoint

## Requirements

- Node.js 18+
- An API key for your chosen provider (or a local Ollama instance — no key needed)

## Setup

```bash
git clone https://github.com/nikitaclicks/slice.git
cd slice
npm install
```

## Provider Configuration

Slice uses **OpenRouter** by default. Set `provider` in `agent.config.json` to switch.

### OpenRouter (default)

```bash
export OPENROUTER_API_KEY=sk-or-...
```

```json
{ "provider": "openrouter", "model": "nvidia/nemotron-3-super-120b-a12b:free" }
```

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
```

```json
{ "provider": "openai", "model": "gpt-4o" }
```

### Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

```json
{ "provider": "anthropic", "model": "claude-sonnet-4-6" }
```

### Ollama (local, no API key)

Start Ollama locally, then:

```json
{ "provider": "ollama", "model": "llama3.2" }
```

Optionally override the endpoint with `"baseURL": "http://localhost:11434"`.

## Run

```bash
npm start
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/model` | Search and switch to a different OpenRouter model |
| `/new` | Start a fresh conversation (clears history) |
| `/compact` | Summarize older messages to reduce context size |
| `/session` | Show current model, message count, and token usage |
| `/export [file]` | Save conversation as a Markdown file |
| `/help` | List all commands |
| `exit` | Quit |

Type `/` and press **Tab** to see available commands. Partial matches (e.g. `/mo` → Tab → `/model`) are supported.

## Configuration

Create `agent.config.json` in the project root to override defaults:

```json
{
  "provider": "openrouter",
  "model": "nvidia/nemotron-3-super-120b-a12b:free",
  "maxSteps": 20,
  "sessionDir": ".sessions",
  "showBanner": true,
  "display": {
    "inputStyle": "block",
    "toolDisplay": "grouped",
    "reasoning": false
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `provider` | `openrouter` | AI provider: `openrouter`, `openai`, `anthropic`, `ollama` |
| `model` | `nvidia/nemotron-3-super-120b-a12b:free` | Model ID (format depends on provider) |
| `baseURL` | — | Override the provider's default API endpoint |
| `maxSteps` | `20` | Max tool-use steps per turn |
| `sessionDir` | `.sessions` | Directory for session JSONL logs |
| `showBanner` | `true` | Show ASCII banner at startup |
| `display.inputStyle` | `block` | `block` / `bordered` / `plain` |
| `display.toolDisplay` | `grouped` | `grouped` / `emoji` / `minimal` / `hidden` |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | API key for OpenRouter (default provider) |
| `OPENAI_API_KEY` | API key for OpenAI provider |
| `ANTHROPIC_API_KEY` | API key for Anthropic provider |
| `AGENT_MODEL` | Model override |
| `AGENT_MAX_STEPS` | Max steps override |

## Tools Available to the Agent

| Tool | Description |
|------|-------------|
| `file_read` | Read file contents with optional offset/limit |
| `file_write` | Write or create files |
| `file_edit` | Search-and-replace edits |
| `glob` | Find files by glob pattern |
| `grep` | Search file contents by regex |
| `list_dir` | List directory contents |
| `shell` | Run shell commands |

## License

MIT
