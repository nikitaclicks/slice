# Slice

A token-efficient, terminal-based AI coding assistant built on [OpenRouter](https://openrouter.ai).

Slice keeps context small, reads only what it needs, and responds tersely — designed for developers who want a fast assistant that stays out of the way.

## Features

- **Block/bordered/plain input styles** — Adaptive terminal background, Tab completion for commands
- **Multi-turn conversation** — Full history passed to the model for context continuity
- **File tools** — `file_read`, `file_write`, `file_edit`, `glob`, `grep`, `list_dir`, `shell`
- **Slash commands** — `/model`, `/new`, `/help`, `/compact`, `/session`, `/export`
- **Context compaction** — LLM-powered summarization of long conversations via `/compact`
- **Model switching** — Search and switch OpenRouter models interactively via `/model`
- **Web search** — Built-in via OpenRouter server tools (no extra setup)

## Requirements

- Node.js 18+
- An [OpenRouter API key](https://openrouter.ai/settings/keys)

## Setup

```bash
git clone https://github.com/nikitaclicks/slice.git
cd slice
npm install
cp .env.example .env
```

Edit `.env` and add your key:

```
OPENROUTER_API_KEY=sk-or-...
```

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
  "model": "anthropic/claude-opus-4.7",
  "maxSteps": 20,
  "maxCost": 1.0,
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
| `model` | `nvidia/nemotron-3-super-120b-a12b:free` | OpenRouter model ID |
| `maxSteps` | `20` | Max tool-use steps per turn |
| `maxCost` | `1.0` | Max USD cost per turn |
| `sessionDir` | `.sessions` | Directory for session JSONL logs |
| `showBanner` | `true` | Show ASCII banner at startup |
| `display.inputStyle` | `block` | `block` / `bordered` / `plain` |
| `display.toolDisplay` | `grouped` | `grouped` / `emoji` / `minimal` / `hidden` |

You can also use environment variables:

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key (required) |
| `AGENT_MODEL` | Model override |
| `AGENT_MAX_STEPS` | Max steps override |
| `AGENT_MAX_COST` | Max cost override |

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
| `web_search` | Search the web (OpenRouter server tool) |
| `datetime` | Get current date/time (OpenRouter server tool) |

## License

MIT
