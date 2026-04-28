import { streamText, generateText } from 'ai';
import type { Tool, LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { AgentConfig } from './config.js';
import { tools, makeStrict } from './tools/index.js';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; name: string; callId: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; callId: string; output: string }
  | { type: 'reasoning'; delta: string };

export function createModel(config: AgentConfig): LanguageModelV1 {
  const { apiKey, baseURL, headers, reasoningEffort, model } = config;
  const client = createOpenAI({
    apiKey: apiKey || 'no-key',
    ...(baseURL && { baseURL }),
    ...(headers && { headers }),
  });
  return client(model, { ...(reasoningEffort && { reasoningEffort }) });
}

export async function runAgent(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: {
    onEvent?: (event: AgentEvent) => void;
    signal?: AbortSignal;
    extraTools?: Record<string, Tool>;
  },
) {
  const model = createModel(config);

  const messages: ChatMessage[] = typeof input === 'string'
    ? [{ role: 'user', content: input }]
    : input;

  const extraTools = Object.fromEntries(
    Object.entries(options?.extraTools ?? {}).map(([k, t]) => [k, makeStrict(t)])
  );
  const allTools: Record<string, Tool> = { ...tools, ...extraTools };

  const signals: AbortSignal[] = [];
  if (options?.signal) signals.push(options.signal);
  if (config.timeout) signals.push(AbortSignal.timeout(config.timeout));
  const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];

  const result = streamText({
    model,
    system: config.systemPrompt.replace('{cwd}', process.cwd()),
    messages,
    tools: allTools,
    maxSteps: config.maxSteps,
    ...(signal && { abortSignal: signal }),
  });

  let streamInputTokens = 0;
  let streamOutputTokens = 0;

  const toInt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

  for await (const part of result.fullStream) {
    if (options?.signal?.aborted) break;

    // Cast to any: ToolResultUnion resolves to `never` with generic Record<string, Tool>,
    // causing false TypeScript narrowing errors despite correct runtime behavior.
    const p = part as any;

    if (p.type === 'finish' && p.usage) {
      streamInputTokens += toInt(p.usage.promptTokens ?? p.usage.inputTokens);
      streamOutputTokens += toInt(p.usage.completionTokens ?? p.usage.outputTokens);
    }

    if (!options?.onEvent) continue;

    if (p.type === 'error') {
      throw new Error(String(p.error?.message ?? p.error ?? 'Stream error'));
    } else if (p.type === 'text-delta') {
      options.onEvent({ type: 'text', delta: p.textDelta });
    } else if (p.type === 'tool-call') {
      options.onEvent({
        type: 'tool_call',
        name: p.toolName,
        callId: p.toolCallId,
        args: p.args as Record<string, unknown>,
      });
    } else if (p.type === 'tool-result') {
      const raw = typeof p.result === 'string' ? p.result : JSON.stringify(p.result);
      const output = raw.length > 200 ? raw.slice(0, 200) + '…' : raw;
      options.onEvent({
        type: 'tool_result',
        name: p.toolName,
        callId: p.toolCallId,
        output,
      });
    } else if (p.type === 'reasoning') {
      options.onEvent({ type: 'reasoning', delta: p.textDelta });
    }
  }

  const text = await result.text;
  const usage = await result.usage;
  const sdkInputTokens = toInt((usage as any)?.promptTokens ?? (usage as any)?.inputTokens);
  const sdkOutputTokens = toInt((usage as any)?.completionTokens ?? (usage as any)?.outputTokens);
  return {
    text,
    usage: {
      inputTokens: sdkInputTokens || streamInputTokens,
      outputTokens: sdkOutputTokens || streamOutputTokens,
    },
  };
}

export async function runAgentWithRetry(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: {
    onEvent?: (event: AgentEvent) => void;
    signal?: AbortSignal;
    maxRetries?: number;
    extraTools?: Record<string, Tool>;
  },
) {
  for (let attempt = 0, max = options?.maxRetries ?? 3; attempt <= max; attempt++) {
    try { return await runAgent(config, input, options); }
    catch (err: any) {
      const s = err?.statusCode ?? err?.status ?? err?.statusCode;
      if (!(s === 429 || (s >= 500 && s < 600)) || attempt === max) throw err;
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 30000)));
    }
  }
  throw new Error('Unreachable');
}
