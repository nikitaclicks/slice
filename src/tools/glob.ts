import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { glob as globImpl } from 'glob';
import { cwd } from 'process';

export const globTool = tool({
  name: 'glob',
  description: 'Find files matching a glob pattern',
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern (e.g., **/*.ts, src/*.js)'),
    path: z.string().optional().describe('Root directory to search from'),
  }),
  execute: async ({ pattern, path }) => {
    try {
      const root = path || cwd();
      const files = await globImpl(pattern, { cwd: root, absolute: true });
      return { files: files.sort() };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});