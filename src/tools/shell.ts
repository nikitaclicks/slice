import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const shellTool = tool({
  name: 'shell',
  description: 'Execute a shell command and return its output',
  inputSchema: z.object({
    command: z.string().describe('Command to execute'),
    timeout: z.number().optional().describe('Timeout in milliseconds'),
  }),
  execute: async ({ command, timeout = 30000 }) => {
    try {
      const { stdout, stderr } = await execAsync(command, { shell: 'bash', timeout });
      const output = stdout + (stderr ? `\n${stderr}` : '');
      return { output: output.slice(0, 10000), truncated: output.length > 10000 };
    } catch (err: any) {
      return { output: err.stdout ?? '', error: err.message, code: err.code };
    }
  },
});