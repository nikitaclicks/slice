import type { Tool } from 'ai';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { fileEditTool } from './file-edit.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { listDirTool } from './list-dir.js';
import { shellTool } from './shell.js';
import { askQuestionTool } from './ask-question.js';
import { toToon } from '../modules/toon-wrap.js';

function wrapToon<T extends Tool>(t: T): T {
  const orig = t.execute;
  if (typeof orig === 'function') {
    (t as any).execute = async (input: any, options: any) => {
      const result = await orig(input, options);
      return toToon(result);
    };
  }
  return t;
}

export const tools: Record<string, Tool> = {
  file_read: wrapToon(fileReadTool),
  file_write: wrapToon(fileWriteTool),
  file_edit: wrapToon(fileEditTool),
  glob: wrapToon(globTool),
  grep: wrapToon(grepTool),
  list_dir: wrapToon(listDirTool),
  // shellTool already TOON-encodes its own return so it can include rtk metadata.
  shell: shellTool,
  ask_question: askQuestionTool,
};

export { wrapToon };
