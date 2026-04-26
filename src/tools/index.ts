import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { fileEditTool } from './file-edit.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { listDirTool } from './list-dir.js';
import { shellTool } from './shell.js';
import { toToon } from '../modules/toon-wrap.js';

/**
 * Wrap a tool's execute() so its return is auto-encoded as TOON
 * (token-efficient, lossless JSON encoding).
 */
function wrapToon<T extends { function: { execute?: (input: any) => any } }>(t: T): T {
  const orig = t.function.execute;
  if (typeof orig === 'function') {
    t.function.execute = async (input: any) => {
      const result = await orig(input);
      return toToon(result);
    };
  }
  return t;
}

export const tools = [
  wrapToon(fileReadTool),
  wrapToon(fileWriteTool),
  wrapToon(fileEditTool),
  wrapToon(globTool),
  wrapToon(grepTool),
  wrapToon(listDirTool),
  // shellTool already TOON-encodes its own return so it can include rtk metadata.
  shellTool,
];

export { wrapToon };
