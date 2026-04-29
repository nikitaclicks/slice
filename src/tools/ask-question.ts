import { tool } from 'ai';
import { z } from 'zod';
import { stopLoader, startLoader } from '../loader.js';

// Injected by cli.ts in plain mode so ask_question uses readline instead of
// raw stdin — prevents the readline interface from double-buffering the answer
// as a pending 'line' event that becomes the next user message.
let rlReader: ((question: string) => Promise<string>) | null = null;

export function setQuestionReader(fn: (question: string) => Promise<string>) {
  rlReader = fn;
}

// Called only when the user escapes (empty Enter or /stop) to abort the
// current streamText call and return to the normal prompt.
let abortCallback: (() => void) | null = null;

export function setAskAbortCallback(fn: () => void) {
  abortCallback = fn;
}

export function clearAskAbortCallback() {
  abortCallback = null;
}

export async function readAnswer(question: string): Promise<string> {
  // Yield to the event loop so the `tool-call` event can be processed first
  // (flushing model text and printing ⚡) before [?] is written.
  // The AI SDK starts execute() before yielding tool-call to fullStream consumers,
  // so without this yield [?] would appear before the model's text response.
  await new Promise<void>(resolve => setImmediate(resolve));

  if (rlReader) {
    return rlReader(question);
  }

  // Drain any data buffered in stdin from before the prompt appears
  // (the \r from rawInput's Enter keypress leaks into our buffer otherwise)
  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  process.stdin.pause();

  process.stdout.write(`\x1b[33m[?] ${question}\x1b[0m\n\x1b[2m(empty Enter or /stop to exit)\x1b[0m\n> `);

  return new Promise<string>((resolve) => {
    let buffer = '';
    const onData = (chunk: string) => {
      buffer += chunk;
      const nlIdx = buffer.search(/\r?\n|\r/);
      if (nlIdx !== -1) {
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        resolve(buffer.slice(0, nlIdx));
      }
    };
    process.stdin.on('data', onData);
    process.stdin.resume();
  });
}

export const askQuestionTool = tool({
  description: 'Ask the user a follow-up question. Always set "answer" to your response or result for the current turn — it is displayed to the user before the question. Never omit "answer".',
  parameters: z.object({
    answer: z.string().describe('Your response or result for the current turn, shown to the user before the follow-up question'),
    question: z.string().describe('The follow-up question to ask the user'),
  }),
  execute: async ({ question }) => {
    if (!process.stdin.isTTY) {
      return 'User input unavailable (non-interactive environment). Proceed without user input.';
    }

    stopLoader();
    const answer = await readAnswer(question);
    startLoader();

    const trimmed = answer.trim();
    if (trimmed === '' || trimmed === '/stop') {
      // User wants to escape — abort the current streamText call.
      // Return a message so the SDK can complete this tool step cleanly
      // before the abort signal stops the next request.
      if (abortCallback) abortCallback();
      return 'User ended the session.';
    }

    // Return the answer as a tool result so the model continues in the same
    // streamText call with full context — this is the point of the tool.
    return answer;
  },
});
