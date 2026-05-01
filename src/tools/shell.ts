import { tool } from 'ai';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { rewriteWithRtk } from '../infra/rtk-rewrite.js';
import { toToon } from '../infra/toon-wrap.js';

const execAsync = promisify(exec);

export const shellTool = tool({
  description: 'Execute a shell command and return its output',
  parameters: z.object({
    command: z.string().describe('Command to execute'),
    timeout: z.number().describe('Timeout in milliseconds, or 0 for default (30000ms)'),
  }),
  execute: async ({ command, timeout }) => {
    timeout = timeout > 0 ? timeout : 30000;
    const rewrite = rewriteWithRtk(command);
    const finalCommand = rewrite ? rewrite.rewritten : command;

    if (rewrite && process.env.SLICE_DEBUG_RTK) {
      process.stdout.write(`\x1b[90m[rtk] ${rewrite.original} -> ${rewrite.rewritten}\x1b[0m\n`);
    }

    try {
      const { stdout, stderr } = await execAsync(finalCommand, { shell: 'bash', timeout });
      const output = stdout + (stderr ? `\n${stderr}` : '');
      return toToon({
        output: output.slice(0, 10000),
        truncated: output.length > 10000,
        ...(rewrite && { rtk: true }),
      });
    } catch (err: any) {
      return toToon({
        output: err.stdout ?? '',
        error: err.message,
        code: err.code,
        ...(rewrite && { rtk: true }),
      });
    }
  },
});
