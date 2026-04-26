import { createInterface } from 'readline';
import { Writable } from 'stream';

export async function detectBg(): Promise<string> {
  return '';
}

export async function styledReadLine(bg: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let line = '';
    rl.on('line', (input) => { rl.close(); resolve(input); });
    rl.on('keypress', (_, chunk) => {
      if (chunk?.toString() === '\r') return;
      line += chunk?.toString() ?? '';
    });
  });
}

export async function borderedReadLine(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write('─'.repeat(Math.min(process.stdout.columns || 60, 60)) + '\n');
    rl.question('> ', (answer) => { rl.close(); resolve(answer); });
  });
}