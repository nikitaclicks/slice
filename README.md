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

Create `agent.config.json` in the project root (it's gitignored):

```json
{
  "provider": "openrouter",
  "baseURL": "https://openrouter.ai/api/v1",
  "apiKey": "sk-or-...",
  "model": "minimax/minimax-m2.5:free"
}
```

Then run:

```bash
npm start
```

## Provider Configuration

All config lives in `agent.config.json`. Set `provider`, `apiKey`, `baseURL`, and `model` together.

### OpenRouter

```json
{
  "provider": "openrouter",
  "baseURL": "https://openrouter.ai/api/v1",
  "apiKey": "sk-or-...",
  "model": "minimax/minimax-m2.5:free"
}
```

### OpenAI

```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o"
}
```

### Anthropic

```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "model": "claude-sonnet-4-6"
}
```

### Any OpenAI-compatible endpoint (local or proxy)

```json
{
  "provider": "openai",
  "baseURL": "http://localhost:1234/v1",
  "apiKey": "your-key",
  "model": "your-model-name"
}
```

### Ollama (no API key needed)

```json
{
  "provider": "ollama",
  "model": "llama3.2"
}
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/new` | Start a fresh conversation (clears history) |
| `/compact` | Summarize older messages to reduce context size |
| `/session` | Show current model, message count, and token usage |
| `/export [file]` | Save conversation as a Markdown file |
| `/help` | List all commands |
| `exit` | Quit |

Type `/` and press **Tab** to see available commands.

## Configuration Reference

| Field | Default | Description |
|-------|---------|-------------|
| `provider` | `openrouter` | AI provider: `openrouter`, `openai`, `anthropic`, `ollama` |
| `apiKey` | — | API key for the selected provider |
| `baseURL` | — | Override the provider's default API endpoint |
| `model` | `nvidia/nemotron-3-super-120b-a12b:free` | Model ID (format depends on provider) |
| `maxSteps` | `20` | Max tool-use steps per turn |
| `sessionDir` | `.sessions` | Directory for session JSONL logs |
| `showBanner` | `true` | Show ASCII banner at startup |
| `display.inputStyle` | `block` | `block` / `bordered` / `plain` |
| `display.toolDisplay` | `grouped` | `grouped` / `emoji` / `minimal` / `hidden` |

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
