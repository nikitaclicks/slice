import type { ChatMessage } from './agent.js';

export interface CompactionOptions {
  maxMessages: number;
  summarizeModel: string;
}

export async function compactContext(
  messages: ChatMessage[],
  _options: CompactionOptions,
): Promise<ChatMessage[]> {
  if (messages.length < 10) return messages;
  const summaryMsgs = messages.slice(0, 2);
  const toCompact = messages.slice(2, -2);
  const finalMsgs = messages.slice(-2);
  const compactedContent = `[${toCompact.length} messages summarized]`;
  return [
    ...summaryMsgs,
    { role: 'user', content: compactedContent },
    ...finalMsgs,
  ];
}