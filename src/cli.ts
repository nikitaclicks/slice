import 'dotenv/config';
import { createInterface, type Interface } from 'readline';
import { loadConfig } from './config.js';
import { runAgentWithRetry, type AgentEvent, type ChatMessage } from './agent.js';
import { printBanner } from './banner.js';
import { startLoader, stopLoader } from './loader.js';
import { handleSlashCommand, commands, type CommandContext } from './commands.js';
import { renderToolCall, renderToolResult, formatTokens } from './renderer.js';
import { detectBg, styledReadLine, borderedReadLine } from './terminal-bg.js';
import { ensureRtk } from './modules/rtk-install.js';
import { loadMcpTools, shutdownMcp } from './modules/mcp-client.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';

// Catch unhandled rejections so they don't silently restart the loop
process.on('unhandledRejection', (reason) => {
  process.stdout.write(`\n${YELLOW}[unhandled] ${String(reason)}${RESET}\n`);
});
process.on('uncaughtException', (err) => {
  process.stdout.write(`\n${YELLOW}[uncaught] ${err.message}\n${err.stack ?? ''}${RESET}\n`);
});

async function main() {
  const args = process.argv.slice(2);
  const printPrompt = args.includes('--print-system-prompt');
  const profile = args.find((a) => !a.startsWith('--'));
  const config = loadConfig({}, profile);

  if (printPrompt) {
    process.stdout.write(config.systemPrompt.replace('{cwd}', process.cwd()) + '\n');
    process.exit(0);
  }

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

  // Token-optimization bootstrap: install rtk binary, spawn context-cutter MCP.
  // Both are best-effort; failures only print warnings.
  await ensureRtk();
  const mcpTools = await loadMcpTools();

  // Ensure MCP subprocess is killed on exit
  const cleanup = () => { shutdownMcp().catch(() => {}); };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  const cmdNames = commands.map((c) => c.name);

  // If stdin is not a TTY (piped, redirected, or non-interactive terminal),
  // raw mode input is unavailable — fall back to plain readline.
  const isTTY = Boolean(process.stdin.isTTY);
  const effectiveStyle = isTTY ? config.display.inputStyle : 'plain';

  // Detect terminal background once at startup (only needed for block style)
  const BG_INPUT = effectiveStyle === 'block' ? await detectBg() : '';

  // Only create a readline interface for plain mode.
  // Block/bordered use raw stdin directly — having an active readline.Interface
  // alongside raw mode causes stdin conflicts and "return key" flicker.
  let rl: Interface | null = null;
  if (effectiveStyle === 'plain') {
    rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${GREEN}> ${RESET}`,
      completer: (line: string) => {
        const hits = cmdNames.filter((c) => c.startsWith(line));
        return [hits.length ? hits : cmdNames, line];
      },
    });
  }

  // For slash commands that need rl.question (e.g. /model), we create a
  // temporary readline on demand and close it right after.
  function makeRl(): Interface {
    return createInterface({ input: process.stdin, output: process.stdout });
  }

  async function getInput(): Promise<string> {
    switch (effectiveStyle) {
      case 'block':
        return styledReadLine(BG_INPUT, { completions: cmdNames });
      case 'bordered':
        return borderedReadLine(undefined, { completions: cmdNames });
      case 'plain':
      default:
        return new Promise((resolve) => {
          rl!.prompt();
          rl!.once('line', resolve);
        });
    }
  }

  // Conversation history — enables multi-turn context
  const messages: ChatMessage[] = [];
  const totalTokens = { input: 0, output: 0 };

  const cmdCtx: CommandContext = {
    config,
    makeRl,
    messages,
    totalTokens,
    resetSession: () => {
      messages.length = 0;
    },
  };

  const toolStart = new Map<string, number>();

  const handleEvent = (event: AgentEvent) => {
    if (event.type === 'tool_call') {
      toolStart.set(event.callId, Date.now());
      console.log(renderToolCall(event.name, event.args));
    } else if (event.type === 'tool_result') {
      const ms = Date.now() - (toolStart.get(event.callId) ?? Date.now());
      console.log(renderToolResult(event.name, ms));
    }
  };

  while (true) {
    let rawInput: string;
    try {
      rawInput = await getInput();
    } catch (err: any) {
      process.stdout.write(`\n${YELLOW}[input error] ${err.message}${RESET}\n`);
      continue;
    }
    const input = rawInput.trim();
    if (!input) continue;

    // Write cwd status line after styled inputs
    if (config.display.inputStyle !== 'plain') {
      const cwd = process.cwd().replace(process.env.HOME ?? '', '~');
      process.stdout.write(`\x1b[K  ${DIM}${cwd}${RESET}\n`);
    }

    if (input === 'exit' || input === 'quit') {
      process.exit(0);
    }

    if (input.startsWith('/')) {
      await handleSlashCommand(input, cmdCtx);
      continue;
    }

    console.log();
    startLoader();

    // Build agent input: pass full conversation history for multi-turn context
    messages.push({ role: 'user', content: input });
    const agentInput: ChatMessage[] | string =
      messages.length > 1 ? [...messages] : input;

    let responseText = '';
    const eventHandler = (event: AgentEvent) => {
      if (event.type === 'text') {
        responseText += event.delta;
      } else {
        handleEvent(event);
      }
    };

    try {
      const res = await runAgentWithRetry(config, agentInput, { onEvent: eventHandler, extraTools: mcpTools });
      stopLoader();

      if (responseText) {
        console.log(`\n${responseText}\n`);
      }

      const inT = res?.usage?.inputTokens ?? 0;
      const outT = res?.usage?.outputTokens ?? 0;
      console.log(`${formatTokens(inT, outT)}\n`);

      totalTokens.input += inT;
      totalTokens.output += outT;

      // Store assistant reply in history
      if (responseText) {
        messages.push({ role: 'assistant', content: responseText });
      }
    } catch (err: any) {
      stopLoader();
      // Remove the user message we optimistically pushed if the call failed
      if (messages[messages.length - 1]?.role === 'user') {
        messages.pop();
      }
      console.log(`\n${YELLOW}Error: ${err.message}${RESET}\n`);
    }
  }
}

main();
