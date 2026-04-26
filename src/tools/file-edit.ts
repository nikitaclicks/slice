import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';

export const fileEditTool = tool({
  name: 'file_edit',
  description: 'Edit a file by replacing a matched string with new content',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to the file'),
    oldString: z.string().describe('Exact string to find and replace'),
    newString: z.string().describe('Replacement string'),
  }),
  execute: async ({ path, oldString, newString }) => {
    try {
      const content = await readFile(path, 'utf-8');
      if (!content.includes(oldString)) {
        return { error: `String not found in file: ${path}` };
      }
      const newContent = content.replace(oldString, newString);
      await writeFile(path, newContent, 'utf-8');
      return { success: true, path };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});