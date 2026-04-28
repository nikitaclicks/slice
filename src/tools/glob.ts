import { tool } from 'ai';
import { z } from 'zod';
import { glob as globImpl } from 'glob';
import { cwd } from 'process';

export const globTool = tool({
  description: 'Find files matching a glob pattern',
  parameters: z.object({
    pattern: z.string().describe('Glob pattern (e.g., **/*.ts, src/*.js)'),
    path: z.string().describe('Root directory to search from, or empty string for cwd'),
  }),
  execute: async ({ pattern, path }) => {
    try {
      const root = path && path.trim() ? path : cwd();
      const files = await globImpl(pattern, { cwd: root, absolute: true });
      return { files: files.sort() };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});