import { streamText, generateText } from 'ai';
import type { Tool, LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOllama } from 'ollama-ai-provider';
import type { AgentConfig } from './config.js';
import { tools } from './tools/index.js';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; name: string; callId: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; callId: string; output: string }
  | { type: 'reasoning'; delta: string };

export function createModel(config: AgentConfig): LanguageModelV1 {
  const { provider, model, apiKey, baseURL } = config;
  switch (provider) {
    case 'openai': {
      const client = createOpenAI({ apiKey, ...(baseURL && { baseURL }) });
      return client(model);
    }
    case 'anthropic': {
      const client = createAnthropic({ apiKey, ...(baseURL && { baseURL }) });
      return client(model);
    }
    case 'ollama': {
      const client = createOllama({ baseURL: baseURL ?? 'http://localhost:11434' });
      return client(model);
    }
    case 'azure': {
      throw new Error('Azure provider requires @ai-sdk/azure. Install it and use createAzure directly.');
    }
    case 'openrouter':
    default: {
      const client = createOpenAI({
        apiKey,
        baseURL: baseURL ?? 'https://openrouter.ai/api/v1',
      });
      return client(model);
    }
  }
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

  const allTools: Record<string, Tool> = { ...tools, ...(options?.extraTools ?? {}) };

  const result = streamText({
    model,
    system: config.systemPrompt.replace('{cwd}', process.cwd()),
    messages,
    tools: allTools,
    maxSteps: config.maxSteps,
    abortSignal: options?.signal,
  });

  for await (const part of result.fullStream) {
    if (options?.signal?.aborted) break;
    if (!options?.onEvent) continue;

    // Cast to any: ToolResultUnion resolves to `never` with generic Record<string, Tool>,
    // causing false TypeScript narrowing errors despite correct runtime behavior.
    const p = part as any;
    if (p.type === 'text-delta') {
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
  return {
    text,
    usage: {
      inputTokens: (usage as any).promptTokens ?? (usage as any).inputTokens ?? 0,
      outputTokens: (usage as any).completionTokens ?? (usage as any).outputTokens ?? 0,
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
