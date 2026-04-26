# Slice

A token-efficient AI coding assistant built with OpenRouter.

## Features

- **Token-saving design** — Minimal context, targeted reads, terse responses
- **File tools** — Read, write, edit, glob, grep, list, shell
- **Session persistence** — JSONL conversation logs
- **Context compaction** — Summarizes long conversations
- **Tool approval** — Gates destructive operations
- **Slash commands** — `/model`, `/new`, `/help`, `/compact`, `/session`, `/export`

## Setup

```bash
# Install dependencies
npm install

# Copy env example
cp .env.example .env
```

Add your OpenRouter API key:

```bash
# In .env
OPENROUTER_API_KEY=sk-or-...
```

Or set via environment variable:

```bash
export OPENROUTER_API_KEY=sk-or-...
```

## Run

```bash
npm run dev
```

## Commands

| Command | Description |
|---------|-------------|
| `/model` | Switch model |
| `/new` | Start fresh conversation |
| `/help` | List commands |
| `/compact` | Compact context |
| `/session` | Show session info |
| `/export` | Export as Markdown |
| `exit` | Quit |

## Config

Edit `agent.config.json` or use environment variables:

| Variable | Description |
|----------|-------------|
| `AGENT_MODEL` | Model (default: anthropic/claude-opus-4.7) |
| `AGENT_MAX_STEPS` | Max steps per turn |
| `AGENT_MAX_COST` | Max cost per turn |

## Tools

| Tool | Description |
|------|-------------|
| `file_read` | Read file with offset/limit |
| `file_write` | Write file |
| `file_edit` | Search-replace |
| `glob` | Find files by pattern |
| `grep` | Search content |
| `list_dir` | List directory |
| `shell` | Run command |