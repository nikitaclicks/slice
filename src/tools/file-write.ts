import { tool } from 'ai';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

export const fileWriteTool = tool({
  description: 'Write content to a file, creating directories if needed',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file'),
    content: z.string().describe('Content to write'),
  }),
  execute: async ({ path, content }) => {
    try {
      const dir = dirname(path);
      await mkdir(dir, { recursive: true });
      await writeFile(path, content, 'utf-8');
      return { success: true, path };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});