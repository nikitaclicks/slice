import { describe, it, expect, beforeEach } from 'vitest';
import type { LanguageModelV1, LanguageModelV1StreamPart } from '@ai-sdk/provider';
import { setQuestionReader } from './tools/ask-question.js';
import { runAgent } from './agent.js';
import type { AgentConfig } from './config.js';

const testConfig: AgentConfig = {
  apiKey: 'test',
  model: 'test-model',
  provider: 'openai',
  systemPrompt: 'You are a test assistant.',
  maxSteps: 5,
  maxCost: 1,
  sessionDir: '.sessions',
  showBanner: false,
  display: { toolDisplay: 'minimal', reasoning: false, inputStyle: 'plain' },
  slashCommands: false,
};

function streamOf(...parts: LanguageModelV1StreamPart[]): ReadableStream<LanguageModelV1StreamPart> {
  return new ReadableStream({
    start(controller) {
      for (const p of parts) controller.enqueue(p);
      controller.close();
    },
  });
}

const rawCall = { rawPrompt: '', rawSettings: {} };

function mockModel(
  steps: Array<(prompt: unknown[]) => LanguageModelV1StreamPart[]>,
): { model: LanguageModelV1; capturedPrompts: unknown[][] } {
  const capturedPrompts: unknown[][] = [];
  let idx = 0;
  const model: LanguageModelV1 = {
    specificationVersion: 'v1',
    provider: 'test',
    modelId: 'test-model',
    defaultObjectGenerationMode: undefined,
    doGenerate: async () => { throw new Error('doGenerate not implemented in mock'); },
    doStream: async (options) => {
      const prompt = options.prompt as unknown[];
      capturedPrompts.push(prompt);
      const step = steps[Math.min(idx++, steps.length - 1)];
      return { rawCall, stream: streamOf(...step(prompt)) };
    },
  };
  return { model, capturedPrompts };
}

describe('ask_question tool — context threading', () => {
  beforeEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    setQuestionReader(async (_question: string) => '2+2');
  });

  it('passes the ask_question tool result back to the model in the same streamText call', async () => {
    const { model, capturedPrompts } = mockModel([
      // Step 1: model writes text first, then calls ask_question
      (_prompt) => [
        { type: 'text-delta', textDelta: 'Let me help.' },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'tc-1',
          toolName: 'ask_question',
          args: JSON.stringify({ question: 'What do you want to calculate?' }),
        },
        { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 10, completionTokens: 5 } },
      ],
      // Step 2: model should receive the tool result with the user's answer
      (_prompt) => [
        { type: 'text-delta', textDelta: 'The answer is 4' },
        { type: 'finish', finishReason: 'stop', usage: { promptTokens: 20, completionTokens: 10 } },
      ],
    ]);

    const result = await runAgent(testConfig, 'What is 2+2?', { _testModel: model });

    expect(result.text).toContain('The answer is 4');
    // Two model calls: one for the initial turn, one after tool result
    expect(capturedPrompts).toHaveLength(2);

    // The second call's prompt must include a tool-result message with the user's answer
    const step2Prompt = capturedPrompts[1] as any[];
    const toolResultMsg = step2Prompt.find((m: any) =>
      Array.isArray(m.content) &&
      m.content.some((c: any) => c.type === 'tool-result' && c.toolCallId === 'tc-1'),
    );

    expect(toolResultMsg, 'tool-result message missing from step 2 prompt').toBeDefined();
    const toolResult = toolResultMsg.content.find((c: any) => c.type === 'tool-result');
    expect(toolResult.result).toBe('2+2');
  });

  it('original user message is visible to the model alongside the tool result', async () => {
    const { model, capturedPrompts } = mockModel([
      (_prompt) => [
        { type: 'text-delta', textDelta: 'Here is my answer.' },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'tc-2',
          toolName: 'ask_question',
          args: JSON.stringify({ question: 'Clarify?' }),
        },
        { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 10, completionTokens: 5 } },
      ],
      (_prompt) => [
        { type: 'text-delta', textDelta: 'done' },
        { type: 'finish', finishReason: 'stop', usage: { promptTokens: 20, completionTokens: 10 } },
      ],
    ]);

    await runAgent(testConfig, 'what is 2+2', { _testModel: model });

    expect(capturedPrompts).toHaveLength(2);
    const step2Prompt = capturedPrompts[1] as any[];

    const userMessages = step2Prompt.filter((m: any) => m.role === 'user');
    const hasOriginalMessage = userMessages.some((m: any) =>
      (typeof m.content === 'string' && m.content.includes('what is 2+2')) ||
      (Array.isArray(m.content) && m.content.some((c: any) => c.text?.includes('what is 2+2'))),
    );

    expect(hasOriginalMessage, 'original user message missing from step 2 prompt').toBe(true);
  });
});
