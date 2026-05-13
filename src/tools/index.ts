import type { Tool } from 'ai';
import { jsonSchema } from 'ai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { fileEditTool } from './file-edit.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { listDirTool } from './list-dir.js';
import { shellTool } from './shell.js';
import { askQuestionTool } from './ask-question.js';
import { toToon } from '../infra/toon-wrap.js';

// Some providers enforce strict JSON schema where every
// property must appear in `required`. The Vercel AI SDK converts Zod schemas
// at call time, so we convert + patch here and replace parameters with a
// pre-built jsonSchema() that the SDK uses as-is.
// Schema key containers whose values are schemas but whose container object
// itself is NOT a schema and must not have fallback type injection.
const SCHEMA_CONTAINERS = new Set(['properties', '$defs', 'definitions', 'patternProperties']);

function cleanSchema(node: any, isContainer = false): any {
  if (Array.isArray(node)) return node.map((n) => cleanSchema(n));
  if (typeof node !== 'object' || node === null) return node;
  const out: any = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === '$schema') continue;
    if (SCHEMA_CONTAINERS.has(k)) {
      // Process each child schema but don't apply fallback to the container itself
      const container: any = {};
      for (const [pk, pv] of Object.entries(v as any)) {
        container[pk] = cleanSchema(pv);
      }
      out[k] = container;
      continue;
    }
    // Collapse type:[X,"null"] → type:X (drop null, strict validators reject array types)
    if (k === 'type' && Array.isArray(v)) {
      const base = (v as string[]).filter((t) => t !== 'null');
      if (base.length === 1) { out.type = base[0]; continue; }
    }
    out[k] = cleanSchema(v);
  }
  // Collapse anyOf:[{type:X},{type:"null"}] → type:X
  if (out.anyOf && Array.isArray(out.anyOf)) {
    const nonNull = out.anyOf.filter((s: any) => s?.type !== 'null');
    if (nonNull.length === 1 && out.anyOf.length === 2) {
      Object.assign(out, nonNull[0]);
      delete out.anyOf;
    }
  }
  // Some strict validators require every schema node to have a 'type' key.
  // Fall back to 'string' for untyped leaf schemas (e.g. z.any() → {}).
  if (!isContainer && !out.type && !out.anyOf && !out.oneOf && !out.allOf && !out.$ref && !out.properties && !out.enum) {
    out.type = 'string';
  }
  // Some strict validators require every object schema to declare properties/required.
  // Object schemas without properties get an empty declaration so they are schema-valid.
  if (out.type === 'object' && !out.properties) {
    out.properties = {};
    out.required = [];
    out.additionalProperties = false;
  }
  // Sync required with properties — must run after anyOf collapse, which may
  // have overwritten out.properties and left required pointing to stale keys.
  if (out.properties) {
    out.required = Object.keys(out.properties);
    out.additionalProperties = false;
  } else {
    delete out.required;
  }
  return out;
}

function makeStrict<T extends Tool>(t: T): T {
  const params = (t as any).parameters;
  // Handle both Zod schemas (have _def) and already-converted Schema objects
  const raw: any = params?._def !== undefined
    ? zodToJsonSchema(params)
    : (params?.jsonSchema ?? params);
  if (!raw || typeof raw !== 'object') return t;
  const cleaned = cleanSchema(raw);
  if (cleaned?.properties) {
    cleaned.required = Object.keys(cleaned.properties);
    cleaned.additionalProperties = false;
  }
  (t as any).parameters = jsonSchema(cleaned);
  return t;
}

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
  file_read: makeStrict(wrapToon(fileReadTool)),
  file_write: makeStrict(wrapToon(fileWriteTool)),
  file_edit: makeStrict(wrapToon(fileEditTool)),
  glob: makeStrict(wrapToon(globTool)),
  grep: makeStrict(wrapToon(grepTool)),
  list_dir: makeStrict(wrapToon(listDirTool)),
  shell: makeStrict(shellTool),
  ask_question: makeStrict(askQuestionTool),
};

export { wrapToon, makeStrict };
