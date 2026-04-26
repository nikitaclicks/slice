import { encode } from '@toon-format/toon';

/**
 * Encode a tool result as TOON text. TOON is a token-efficient JSON encoding
 * (https://github.com/toon-format/toon) — typically ~30–60% smaller than JSON
 * for arrays of objects, while remaining lossless and LLM-readable.
 *
 * Strings, numbers, booleans, null, and undefined are passed through unchanged
 * so primitive returns aren't needlessly re-encoded.
 */
export function toToon(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value;

  try {
    // encode requires a JSON-serializable value at the root.
    return encode(value as any);
  } catch {
    // Fallback to original on any encoding failure.
    return value;
  }
}

/**
 * Wrap a tool's `execute` function so its return value is TOON-encoded.
 * Use as: `execute: withToon(async (input) => { ... })`
 */
export function withToon<I, R>(fn: (input: I) => Promise<R> | R): (input: I) => Promise<unknown> {
  return async (input: I) => toToon(await fn(input));
}
