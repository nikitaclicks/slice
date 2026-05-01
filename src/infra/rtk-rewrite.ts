import { rtkState } from './rtk-install.js';

/**
 * Maps a leading shell command (token-1, optionally token-2) to its `rtk` form.
 * Mirrors the official RTK supported commands — see https://github.com/rtk-ai/rtk
 *
 * Returns null when no rewrite applies.
 */

// Single-token commands: `<cmd>` -> `rtk <cmd>`
const SINGLE = new Set<string>([
  // files
  'ls', 'cat', 'head', 'tail', 'find', 'grep', 'rg', 'tree', 'diff',
  // node ecosystem
  'jest', 'vitest', 'playwright', 'tsc', 'prettier', 'eslint',
  // python
  'pytest', 'ruff', 'pip', 'uv',
  // rust
  'cargo',
  // go
  'go',
  // ruby
  'rspec', 'rake', 'rubocop', 'bundle',
  // js package mgr
  'pnpm', 'npm', 'yarn',
  // build/build tools
  'next', 'biome',
  // containers / cloud
  'docker', 'kubectl', 'aws',
  // misc
  'curl', 'wget', 'json', 'log', 'env', 'deps',
  // generic helpers
  'err', 'test', 'summary', 'proxy', 'smart', 'read',
]);

// Two-token commands where token-1 is a multiplexer (e.g. `git status`)
// We accept any subcommand under these.
const TWO_TOKEN = new Set<string>(['git', 'gh']);

// Commands we should never rewrite (interactive, special semantics, etc.)
const SKIP = new Set<string>([
  'rtk', 'sudo', 'cd', 'export', 'source', 'eval', 'exec', 'bash', 'sh',
  'zsh', 'fish', 'tmux', 'screen', 'vi', 'vim', 'nvim', 'nano', 'less',
  'more', 'man', 'ssh', 'scp', 'rsync',
]);

function firstShellSegment(command: string): string {
  // Take only what runs first: stop at unquoted `;`, `&&`, `||`, `|`, `&`
  // This is a heuristic; we only need the leading argv0/argv1.
  let depth = 0;
  let inS = false;
  let inD = false;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (c === '\\') { i++; continue; }
    if (!inD && c === "'") inS = !inS;
    else if (!inS && c === '"') inD = !inD;
    else if (!inS && !inD) {
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0) {
        if (c === ';' || c === '|' || c === '&') return command.slice(0, i);
      }
    }
  }
  return command;
}

/**
 * If `rtk` is available and the leading command is in our supported set,
 * return a rewritten command. Otherwise return null.
 */
export function rewriteWithRtk(command: string): { rewritten: string; original: string } | null {
  if (!rtkState.available) return null;
  const trimmed = command.trimStart();
  if (!trimmed) return null;

  // Strip env-var prefix like `FOO=bar baz cmd` — we don't try to be clever
  // here; if the first token contains `=`, skip rewrite to stay safe.
  const head = firstShellSegment(trimmed);
  const tokens = head.trim().split(/\s+/);
  const t0 = tokens[0];
  if (!t0 || t0.includes('=')) return null;
  if (SKIP.has(t0)) return null;

  // Already prefixed
  if (t0 === 'rtk') return null;

  if (TWO_TOKEN.has(t0)) {
    // git, gh — always rewrite
    const rewritten = `rtk ${trimmed}`;
    return { rewritten, original: command };
  }

  if (SINGLE.has(t0)) {
    const rewritten = `rtk ${trimmed}`;
    return { rewritten, original: command };
  }

  return null;
}
