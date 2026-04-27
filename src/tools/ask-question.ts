import { tool } from 'ai';
import { z } from 'zod';
import { stopLoader, startLoader } from '../loader.js';

export const askQuestionTool = tool({
  description: 'Ask the user a clarifying question and wait for their answer before continuing',
  parameters: z.object({
    question: z.string().describe('The question to ask the user'),
  }),
  execute: async ({ question }) => {
    if (!process.stdin.isTTY) {
      return 'User input unavailable (non-interactive environment). Proceed without user input.';
    }

    stopLoader();

    // Drain any data buffered in stdin from before the prompt appears
    // (the \r from rawInput's Enter keypress leaks into our buffer otherwise)
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    await new Promise<void>(resolve => setImmediate(resolve));
    process.stdin.pause();

    process.stdout.write(`\x1b[33m[?] ${question}\x1b[0m\n> `);

    return new Promise<string>((resolve) => {
      let buffer = '';
      const onData = (chunk: string) => {
        buffer += chunk;
        const nlIdx = buffer.search(/\r?\n|\r/);
        if (nlIdx !== -1) {
          process.stdin.removeListener('data', onData);
          process.stdin.pause();
          startLoader();
          resolve(buffer.slice(0, nlIdx));
        }
      };

      // Register listener before resuming to avoid missing the first chunk
      process.stdin.on('data', onData);
      process.stdin.resume();
    });
  },
});
