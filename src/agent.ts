import { streamText, generateText } from 'ai';
import type { Tool, LanguageModelV1, CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { AgentConfig } from './config.js';
import { tools, makeStrict } from './tools/index.js';

// CoreMessage covers user/assistant/tool/system — superset of the old ChatMessage.
export type ChatMessage = CoreMessage;

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; name: string; callId: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; callId: string; output: string }
  | { type: 'reasoning'; delta: string };

export function createModel(config: AgentConfig): LanguageModelV1 {
  const { apiKey, baseURL, headers, reasoningEffort, model, provider } = config;

  if (provider === 'copilot') {
    const token = apiKey;
    const copilotFetch: typeof globalThis.fetch = (input, init) => {
      const h = new Headers(init?.headers as HeadersInit | undefined);
      h.delete('authorization');
      h.delete('x-api-key');
      h.set('Authorization', `Bearer ${token}`);
      h.set('User-Agent', 'slice/1.0.0');
      h.set('Openai-Intent', 'conversation-edits');
      h.set('x-initiator', 'agent');
      return globalThis.fetch(input, { ...init, headers: h });
    };
    const client = createOpenAI({
      apiKey: 'unused',
      baseURL: baseURL || 'https://api.githubcopilot.com',
      fetch: copilotFetch,
    });
    return client(model, { ...(reasoningEffort && { reasoningEffort }) });
  }

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
    excludeTools?: string[];
    _testModel?: LanguageModelV1;
    toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: string };
    maxStepsOverride?: number;
  },
) {
  const model = options?._testModel ?? createModel(config);

  const messages: ChatMessage[] = typeof input === 'string'
    ? [{ role: 'user', content: input }]
    : input;

  const extraTools = Object.fromEntries(
    Object.entries(options?.extraTools ?? {}).map(([k, t]) => [k, makeStrict(t)])
  );
  const excluded = new Set(options?.excludeTools ?? []);
  const allTools: Record<string, Tool> = Object.fromEntries(
    Object.entries({ ...tools, ...extraTools }).filter(([k]) => !excluded.has(k))
  );

  const signals: AbortSignal[] = [];
  if (options?.signal) signals.push(options.signal);
  if (config.timeout) signals.push(AbortSignal.timeout(config.timeout));
  const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];

  const result = streamText({
    model,
    system: config.systemPrompt.replace('{cwd}', process.cwd()),
    messages,
    tools: allTools,
    maxSteps: options?.maxStepsOverride ?? config.maxSteps,
    ...(options?.toolChoice && { toolChoice: options.toolChoice as any }),
    ...(signal && { abortSignal: signal }),
  });

  let streamInputTokens = 0;
  let streamOutputTokens = 0;

  const toInt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

  // Track messages as they stream so we can return them even if the signal is aborted
  // (awaiting result.response after abort throws/hangs, so we build this manually).
  const streamMessages: ChatMessage[] = [];
  let stepText = '';
  const stepCalls: Array<{ type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }> = [];

  function flushStep() {
    if (!stepText && !stepCalls.length) return;
    const parts: any[] = [];
    if (stepText) parts.push({ type: 'text', text: stepText });
    parts.push(...stepCalls);
    streamMessages.push({
      role: 'assistant',
      content: parts.length === 1 && parts[0].type === 'text' ? stepText : parts,
    } as ChatMessage);
    stepText = '';
    stepCalls.length = 0;
  }

  for await (const part of result.fullStream) {
    if (options?.signal?.aborted) break;

    // Cast to any: ToolResultUnion resolves to `never` with generic Record<string, Tool>,
    // causing false TypeScript narrowing errors despite correct runtime behavior.
    const p = part as any;

    if (p.type === 'finish' && p.usage) {
      streamInputTokens += toInt(p.usage.promptTokens ?? p.usage.inputTokens);
      streamOutputTokens += toInt(p.usage.completionTokens ?? p.usage.outputTokens);
    }

    if (p.type === 'text-delta') {
      stepText += p.textDelta;
    } else if (p.type === 'tool-call') {
      stepCalls.push({ type: 'tool-call', toolCallId: p.toolCallId, toolName: p.toolName, args: p.args });
    } else if (p.type === 'tool-result') {
      flushStep();
      streamMessages.push({
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: p.toolCallId, toolName: p.toolName, result: p.result }],
      } as unknown as ChatMessage);
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

  flushStep();

  // Return early if the signal was aborted (e.g. by ask_question capturing user input).
  // Awaiting result.text/usage/response after abort would throw or hang.
  if (options?.signal?.aborted) {
    return {
      text: '',
      usage: { inputTokens: streamInputTokens, outputTokens: streamOutputTokens },
      responseMessages: streamMessages,
    };
  }

  const text = await result.text;
  const usage = await result.usage;
  const response = await result.response;
  const sdkInputTokens = toInt((usage as any)?.promptTokens ?? (usage as any)?.inputTokens);
  const sdkOutputTokens = toInt((usage as any)?.completionTokens ?? (usage as any)?.outputTokens);
  return {
    text,
    usage: {
      inputTokens: sdkInputTokens || streamInputTokens,
      outputTokens: sdkOutputTokens || streamOutputTokens,
    },
    responseMessages: response.messages as ChatMessage[],
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
    excludeTools?: string[];
    toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: string };
    maxStepsOverride?: number;
  },
) {
  for (let attempt = 0, max = options?.maxRetries ?? 3; attempt <= max; attempt++) {
    try { return await runAgent(config, input, options); }
    catch (err: any) {
      const s = err?.statusCode ?? err?.status ?? err?.statusCode;
      if (!(s === 429 || (s >= 500 && s < 600)) || attempt === max) throw err;
      const retryAfterMatch = String(err?.message ?? '').match(/wait\s+(\d+)\s+second/i);
      const retryAfterMs = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) * 1000 : 0;
      const backoffMs = Math.min(1000 * 2 ** attempt, 30000);
      await new Promise((r) => setTimeout(r, Math.max(retryAfterMs, backoffMs)));
    }
  }
  throw new Error('Unreachable');
}
