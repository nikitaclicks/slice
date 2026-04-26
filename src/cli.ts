import 'dotenv/config';
import { createInterface } from 'readline';
import { loadConfig, type AgentConfig } from './config.js';
import { runAgentWithRetry, type AgentEvent } from './agent.js';
import { printBanner } from './banner.js';
import { startLoader, stopLoader } from './loader.js';
import { commands, type Command } from './commands.js';
import { renderToolCall, renderToolResult, formatTokens } from './renderer.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';

let config: AgentConfig;
let sessionCleared = false;

async function handleSlashCommand(input: string): Promise<string | null> {
  for (const cmd of commands) {
    if (input.startsWith(cmd.name)) {
      const args = input.slice(cmd.name.length).trim().split(/\s+/).filter(Boolean);
      const result = await cmd.execute(args, config);
      if (result === 'session_cleared') {
        sessionCleared = true;
        return null;
      }
      console.log(result + '\n');
      return '';
    }
  }
  return input;
}

async function getInput(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    (rl as any).completer = (line: string) => {
      const cmds = commands.map((c) => c.name);
      const hits = cmds.filter((c) => c.startsWith(line));
      return [hits.length ? hits : cmds, line];
    };
    rl.setPrompt(GREEN + '> ' + RESET);
    rl.prompt();
    rl.on('line', (line) => { rl.close(); resolve(line); });
  });
}

async function main() {
  config = loadConfig();

  if (config.showBanner) {
    printBanner(config.model);
  } else {
    const width = Math.min(process.stdout.columns || 60, 60);
    const line = GRAY + '─'.repeat(width) + RESET;
    console.log(`\n${line}`);
    console.log(`  ${BOLD}Slice${RESET}  ${DIM}v0.1.0${RESET}`);
    console.log(`  ${DIM}model${RESET}  ${config.model}${RESET}`);
    console.log(`${line}\n`);
  }

  const toolStart = new Map<string, number>();
  let responseText = '';

  const handleEvent = (event: AgentEvent) => {
    if (event.type === 'text') {
      responseText += event.delta;
    } else if (event.type === 'tool_call') {
      toolStart.set(event.callId, Date.now());
      console.log(renderToolCall(event.name, event.args));
    } else if (event.type === 'tool_result') {
      const ms = Date.now() - (toolStart.get(event.callId) ?? Date.now());
      console.log(renderToolResult(event.name, ms));
    }
  };

  while (true) {
    responseText = '';
    const rawInput = await getInput();
    const input = rawInput.trim();
    if (!input) continue;

    if (input.startsWith('/')) {
      const result = await handleSlashCommand(input);
      if (result === null || result === '') continue;
    }

    if (sessionCleared) {
      sessionCleared = false;
    }

    console.log();
    startLoader();

    try {
      const res = await runAgentWithRetry(config, input, { onEvent: handleEvent });
      stopLoader();
      if (responseText) console.log(`\n${responseText}\n`);

      const inT = res?.usage?.inputTokens ?? 0;
      const outT = res?.usage?.outputTokens ?? 0;
      console.log(`${formatTokens(inT, outT)}\n`);
    } catch (err: any) {
      stopLoader();
      console.log(`\n${YELLOW}Error: ${err.message}${RESET}\n`);
    }
  }
}

main();