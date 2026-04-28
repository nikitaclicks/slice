import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import { readdir } from 'fs/promises';
import { stat } from 'fs/promises';

export const grepTool = tool({
  description: 'Search file contents using a regex pattern',
  parameters: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z.string().describe('Directory or file to search in, or empty string for cwd'),
  }),
  execute: async ({ pattern, path }) => {
    try {
      const root = path && path.trim() ? path : process.cwd();
      const results: Array<{ file: string; matches: string[] }> = [];

      const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'coverage', '__pycache__']);

      async function searchDir(dir: string) {
        const entries = await readdir(dir);
        for (const entry of entries.slice(0, 50)) {
          if (SKIP_DIRS.has(entry)) continue;
          const fullPath = `${dir}/${entry}`;
          const st = await stat(fullPath);
          if (st.isDirectory()) {
            await searchDir(fullPath);
          } else if (fullPath.match(/\.(ts|js|tsx|jsx|json|md)$/)) {
            const content = await readFile(fullPath, 'utf-8');
            const lines = content.split('\n');
            const matches: string[] = [];
            for (const line of lines) {
              // Create a fresh regex per test to avoid stateful 'g' flag issues
              if (new RegExp(pattern).test(line)) matches.push(line.slice(0, 200));
            }
            if (matches.length) results.push({ file: fullPath, matches: matches.slice(0, 5) });
          }
        }
      }
      
      await searchDir(root);
      return { results: results.slice(0, 20) };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});