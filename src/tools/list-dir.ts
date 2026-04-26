import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readdir, stat } from 'fs/promises';

export const listDirTool = tool({
  name: 'list_dir',
  description: 'List directory contents with file type indicators',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to directory'),
  }),
  execute: async ({ path }) => {
    try {
      const entries = await readdir(path);
      const items = await Promise.all(
        entries.map(async (name) => {
          const isDir = (await stat(`${path}/${name}`)).isDirectory();
          return { name, type: isDir ? 'dir' : 'file' };
        }),
      );
      return { entries: items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }) };
    } catch (err: any) {
      if (err.code === 'ENOENT') return { error: `Directory not found: ${path}` };
      if (err.code === 'EACCES') return { error: `Permission denied: ${path}` };
      return { error: err.message };
    }
  },
});