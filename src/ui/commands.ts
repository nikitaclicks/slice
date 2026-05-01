import { writeFileSync } from 'fs';
import { generateText } from 'ai';
import type { Interface } from 'readline';
import type { AgentConfig } from '../core/config.js';
import type { ChatMessage } from '../core/agent.js';
import { createModel } from '../core/agent.js';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

export interface CommandContext {
  config: AgentConfig;
  /** Creates a fresh readline interface for interactive prompts. Caller must close it. */
  makeRl: () => Interface;
  messages: ChatMessage[];
  totalTokens: { input: number; output: number };
  resetSession: () => void;
}

export interface Command {
  name: string;
  description: string;
  execute: (args: string[], ctx: CommandContext) => Promise<void>;
}

function ask(rl: Interface, prompt: string): Promise<string> {
  return new Promise((r) => rl.question(prompt, r));
}

export const commands: Command[] = [
  {
    name: '/model',
    description: 'Switch the active model (fetches from configured provider)',
    execute: async (_args, ctx) => {
      console.log(`  ${DIM}Current:${RESET} ${CYAN}${ctx.config.model}${RESET}`);
      const rl = ctx.makeRl();
      try {
        const query = await ask(rl, `  ${DIM}Search models:${RESET} `);
        if (!query.trim()) { rl.close(); return; }
        process.stdout.write(`  ${DIM}Fetching…${RESET}`);

        const base = ctx.config.baseURL ?? 'https://openrouter.ai/api/v1';
        const url = base.replace(/\/$/, '') + '/models';
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${ctx.config.apiKey}`,
            ...ctx.config.headers,
          },
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json() as any;
        // OpenAI-compatible: { data: [...] } or flat array
        const list: { id: string; name?: string }[] = Array.isArray(json) ? json : (json.data ?? []);

        process.stdout.write('\r\x1b[K');
        const q = query.toLowerCase();
        const matches = list
          .filter((m) => m.id.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q))
          .slice(0, 15);
        if (!matches.length) {
          console.log(`  ${DIM}No models matching "${query}".${RESET}`);
          rl.close();
          return;
        }
        matches.forEach((m, i) =>
          console.log(`  ${DIM}${String(i + 1).padStart(2)})${RESET} ${m.id}`),
        );
        const pick = await ask(rl, `\n  ${DIM}Select (1-${matches.length}):${RESET} `);
        const idx = parseInt(pick) - 1;
        if (idx >= 0 && idx < matches.length) {
          ctx.config.model = matches[idx].id;
          console.log(`  ${DIM}Model →${RESET} ${CYAN}${ctx.config.model}${RESET}\n`);
        } else {
          console.log(`  ${DIM}Cancelled.${RESET}\n`);
        }
      } catch (err: any) {
        process.stdout.write('\r\x1b[K');
        console.log(`  ${YELLOW}Failed to fetch models: ${err.message}${RESET}\n`);
      } finally {
        rl.close();
      }
    },
  },
  {
    name: '/new',
    description: 'Start a fresh conversation',
    execute: async (_args, ctx) => {
      ctx.resetSession();
      console.log(`  ${GREEN}✓${RESET} ${DIM}New session started.${RESET}\n`);
    },
  },
  {
    name: '/help',
    description: 'List available commands',
    execute: async () => {
      for (const cmd of commands) {
        console.log(`  ${CYAN}${cmd.name.padEnd(12)}${RESET}${DIM}${cmd.description}${RESET}`);
      }
      console.log();
    },
  },
  {
    name: '/compact',
    description: 'Compress conversation context via LLM summarization',
    execute: async (_args, ctx) => {
      if (ctx.messages.length < 4) {
        console.log(`  ${DIM}Nothing to compact (${ctx.messages.length} messages).${RESET}\n`);
        return;
      }
      const before = ctx.messages.length;
      process.stdout.write(`  ${DIM}Compacting…${RESET}`);
      try {
        const keepRecent = Math.min(10, Math.floor(ctx.messages.length / 2));
        const toSummarize = ctx.messages.slice(0, -keepRecent);
        const toKeep = ctx.messages.slice(-keepRecent);

        const { text: summary } = await generateText({
          model: createModel(ctx.config),
          system: 'Summarize the following conversation concisely. Preserve key facts, decisions, file paths mentioned, and tool results. Output only the summary.',
          messages: [{ role: 'user', content: toSummarize.map((m) => `${m.role}: ${m.content}`).join('\n\n') }],
        });

        ctx.messages.length = 0;
        ctx.messages.push(
          { role: 'user', content: `[Conversation summary]\n${summary}` },
          ...toKeep,
        );
        process.stdout.write('\r\x1b[K');
        console.log(
          `  ${GREEN}✓${RESET} ${DIM}Compacted ${before} → ${ctx.messages.length} messages.${RESET}\n`,
        );
      } catch (err: any) {
        process.stdout.write('\r\x1b[K');
        console.log(`  ${YELLOW}Compact failed: ${err.message}${RESET}\n`);
      }
    },
  },
  {
    name: '/session',
    description: 'Show session info and token usage',
    execute: async (_args, ctx) => {
      const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
      console.log(`  ${DIM}model${RESET}     ${CYAN}${ctx.config.model}${RESET}`);
      console.log(`  ${DIM}messages${RESET}  ${ctx.messages.length}`);
      console.log(
        `  ${DIM}tokens${RESET}    ${fmt(ctx.totalTokens.input)} in · ${fmt(ctx.totalTokens.output)} out`,
      );
      console.log();
    },
  },
  {
    name: '/export',
    description: 'Export full AI context as JSON (system prompt + messages)',
    execute: async (args, ctx) => {
      if (!ctx.messages.length) {
        console.log(`  ${DIM}No messages to export.${RESET}\n`);
        return;
      }
      const file =
        args[0] ||
        `session-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const context = [
        { role: 'system', content: ctx.config.systemPrompt.replace('{cwd}', process.cwd()) },
        ...ctx.messages,
      ];
      writeFileSync(file, JSON.stringify(context, null, 2), 'utf-8');
      console.log(`  ${GREEN}✓${RESET} ${DIM}Exported to ${file}${RESET}\n`);
    },
  },
];

export async function handleSlashCommand(
  input: string,
  ctx: CommandContext,
): Promise<boolean> {
  const cmd = commands.find((c) => input === c.name || input.startsWith(c.name + ' '));
  if (!cmd) {
    console.log(
      `  ${DIM}Unknown command: ${input.split(' ')[0]}. Type /help for available commands.${RESET}\n`,
    );
    return true;
  }
  const args = input.slice(cmd.name.length).trim().split(/\s+/).filter(Boolean);
  await cmd.execute(args, ctx);
  return true;
}
