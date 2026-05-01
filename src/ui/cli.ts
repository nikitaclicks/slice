import 'dotenv/config';
import { createInterface, type Interface } from 'readline';
import { loadConfig } from '../core/config.js';
import { runAgentWithRetry, type AgentEvent, type ChatMessage } from '../core/agent.js';
import { printBanner } from './banner.js';
import { startLoader, stopLoader } from './loader.js';
import { handleSlashCommand, commands, type CommandContext } from './commands.js';
import { setQuestionReader, setAskAbortCallback, clearAskAbortCallback } from '../tools/ask-question.js';
import { renderToolCall, renderToolResult, formatTokens } from './renderer.js';
import { detectBg, styledReadLine, borderedReadLine } from './terminal-bg.js';
import { ensureRtk } from '../infra/rtk-install.js';
import { loadMcpTools, shutdownMcp } from '../infra/mcp-client.js';
import { runDeviceCodeFlow, saveTokenToConfig } from '../infra/copilot-auth.js';
import { startCopilotProxy, stopCopilotProxy } from '../infra/copilot-proxy.js';
import { selfHeal, getGitDiff } from '../infra/self-heal.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';

async function promptYesNo(question: string, makeRl: () => Interface): Promise<boolean> {
  return new Promise((resolve) => {
    const r = makeRl();
    r.question(question, (answer) => {
      r.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function isContextTooLargeError(err: any): boolean {
  const msg = String(err?.message ?? '').toLowerCase();
  return msg.includes('too large') || msg.includes('context length') || msg.includes('max size') || msg.includes('context_length_exceeded');
}

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

  await ensureRtk();

  if (config.provider === 'copilot' && !config.apiKey) {
    process.stdout.write(`${DIM}No Copilot token found — starting GitHub device auth…${RESET}\n`);
    const token = await runDeviceCodeFlow();
    saveTokenToConfig(token, profile || 'copilot');
    config.apiKey = token;
    process.stdout.write(`${GREEN}Authenticated! Token saved to agent.${profile || 'copilot'}.config.local.json${RESET}\n\n`);
  }

  if (config.copilotApi) {
    process.stdout.write(`${DIM}Starting copilot-api proxy… (complete GitHub auth if prompted)${RESET}\n`);
    await startCopilotProxy();
    process.stdout.write(`${DIM}Proxy ready on :4141${RESET}\n\n`);
  }

  const mcpTools = await loadMcpTools();

  const cleanup = () => { shutdownMcp().catch(() => {}); stopCopilotProxy(); };
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
    setQuestionReader((q) => new Promise((resolve) => {
      rl!.question(`\x1b[33m[?] ${q}\x1b[0m\n> `, resolve);
    }));
  } else {
    // Block/bordered: after rawInput exits, emitKeypressEvents leaves a keypress
    // decoder on stdin. Use terminal:false so readline reads data events directly
    // (OS cooked mode) without touching raw mode or managing its own prompt drawing.
    // Write the prompt manually so it appears exactly once.
    setQuestionReader((q) => new Promise((resolve) => {
      const tempRl = createInterface({ input: process.stdin, terminal: false });
      process.stdout.write(`\x1b[33m[?] ${q}\x1b[0m\n> `);
      tempRl.once('line', (answer) => {
        tempRl.close();
        resolve(answer);
      });
    }));
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
    resetSession: () => { messages.length = 0; },
  };

  const toolStart = new Map<string, number>();

  const handleEvent = (event: AgentEvent) => {
    if (event.type === 'tool_call') {
      toolStart.set(event.callId, Date.now());
      if (event.name === 'ask_question' && event.args.answer) {
        console.log(`\n${event.args.answer}\n`);
      }
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
    if (effectiveStyle !== 'plain') {
      const cwd = process.cwd().replace(process.env.HOME ?? '', '~');
      process.stdout.write(`\x1b[K  ${DIM}${cwd}${RESET}\n`);
    }

    if (input === 'exit' || input === 'quit') process.exit(0);

    if (input.startsWith('/')) {
      await handleSlashCommand(input, cmdCtx);
      continue;
    }

    console.log();
    startLoader();
    messages.push({ role: 'user', content: input });

    // AbortController triggered only when the user escapes ask_question
    // (empty Enter or /stop). Normal answers stay in the same streamText call.
    const askAbort = new AbortController();
    setAskAbortCallback(() => askAbort.abort());

    for (let attempt = 0; attempt <= 1; attempt++) {
      let responseText = '';
      let flushedText = '';
      let hadToolCall = false;

      const flushText = () => {
        stopLoader();
        if (responseText) {
          console.log(`\n${responseText}\n`);
          flushedText += responseText;
          responseText = '';
        }
      };

      const eventHandler = (event: AgentEvent) => {
        if (event.type === 'text') {
          responseText += event.delta;
        } else {
          // Stop spinner before printing any tool indicator so they don't interleave
          if (event.type === 'tool_call') { flushText(); hadToolCall = true; }
          else { stopLoader(); }
          handleEvent(event);
          // Restart spinner after tool_result so it shows while model processes the answer
          if (event.type === 'tool_result') startLoader();
        }
      };

      // commitMessages is used for abort/error paths where we only have partial text.
      // The normal success path uses res.responseMessages directly (includes tool calls).
      const commitMessages = (text: string) => {
        if (text) {
          messages.push({ role: 'assistant', content: text });
        } else if (hadToolCall) {
          messages.push({ role: 'assistant', content: '...' });
        } else if (messages[messages.length - 1]?.role === 'user') {
          messages.pop();
        }
      };

      const agentInput: ChatMessage[] | string = messages.length > 1 ? [...messages] : input;

      try {
        const res = await runAgentWithRetry(config, agentInput, {
          onEvent: eventHandler,
          extraTools: mcpTools,
          excludeTools: [],
          signal: askAbort.signal,
        });
        clearAskAbortCallback();
        stopLoader();

        // User escaped ask_question — commit whatever was produced (text + tool messages).
        if (askAbort.signal.aborted) {
          flushText();
          const abortMessages = res?.responseMessages ?? [];
          if (abortMessages.length) {
            messages.push(...abortMessages);
          } else {
            commitMessages(flushedText + responseText);
          }
          break;
        }

        if (responseText) {
          console.log(`\n${responseText}\n`);
        }

        const inT = res?.usage?.inputTokens ?? 0;
        const outT = res?.usage?.outputTokens ?? 0;
        console.log(`${formatTokens(inT, outT)}\n`);

        totalTokens.input += inT;
        totalTokens.output += outT;

        const fullText = flushedText + responseText;
        const resMessages = res?.responseMessages ?? [];
        if (resMessages.length) {
          messages.push(...resMessages);
        } else {
          commitMessages(fullText);
        }

        break;
      } catch (err: any) {
        clearAskAbortCallback();
        stopLoader();

        if (askAbort.signal.aborted) {
          flushText();
          commitMessages(flushedText + responseText);
          break;
        }

        if (messages[messages.length - 1]?.role === 'user') messages.pop();

        if (attempt === 0 && isContextTooLargeError(err) && messages.length >= 2) {
          const trimTo = Math.max(2, Math.floor(messages.length / 2));
          messages.splice(0, messages.length - trimTo);
          if (input) messages.push({ role: 'user', content: input });
          process.stdout.write(`${YELLOW}Context too large — trimmed history, retrying…${RESET}\n\n`);
          startLoader();
          continue;
        }

        const hint = isContextTooLargeError(err) ? ` Use /clear to reset or switch to a model with a larger context window.` : '';
        console.log(`\n${YELLOW}Error: ${err.message}${hint}${RESET}\n`);

        const shouldHeal = await promptYesNo('Self-heal? [y/N] ', makeRl);
        if (shouldHeal) {
          startLoader();
          try {
            const healText = await selfHeal(err, input, config, mcpTools, handleEvent);
            stopLoader();
            if (healText) console.log(`\n${healText}\n`);
            const diff = getGitDiff();
            if (diff) {
              console.log(diff);
              const apply = await promptYesNo('Apply these changes? [y/N] ', makeRl);
              if (apply) {
                console.log(`${GREEN}Changes saved — restart Slice to apply.${RESET}\n`);
              }
            } else {
              console.log(`${DIM}No changes made.${RESET}\n`);
            }
          } catch (healErr: any) {
            stopLoader();
            console.log(`${YELLOW}Self-heal failed: ${healErr.message}${RESET}\n`);
          }
        }
        break;
      }
    }
  }
}

main();
