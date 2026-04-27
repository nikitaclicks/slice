import type { AgentEvent } from './agent.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const GRAY = '\x1b[90m';

function summarizeArgs(name: string, args: Record<string, unknown>): string {
  const key: Record<string, string> = {
    shell: 'command', file_read: 'path', file_write: 'path',
    file_edit: 'path', glob: 'pattern', grep: 'pattern',
  };
  const k = key[name];
  if (!k || !(k in args)) return '';
  const val = String(args[k]);
  return val.length > 40 ? val.slice(0, 40) + '…' : val;
}

export function renderToolCall(name: string, args: Record<string, unknown>): string {
  const argsStr = summarizeArgs(name, args);
  return `  ${YELLOW}⚡${RESET} ${DIM}${name}${argsStr ? ' ' + argsStr : ''}${RESET}`;
}

export function renderToolResult(name: string, ms: number, truncated?: boolean): string {
  return `  ${GREEN}✓${RESET} ${DIM}${name} (${(ms / 1000).toFixed(1)}s)${truncated ? ' [truncated]' : ''}${RESET}`;
}

export function formatTokens(inTokens: number, outTokens: number): string {
  if (!inTokens && !outTokens) return `${GRAY}  -- in · -- out${RESET}`;
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  return `${GRAY}  ${fmt(inTokens)} in · ${fmt(outTokens)} out${RESET}`;
}