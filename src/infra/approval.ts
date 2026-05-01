import type { ChatMessage } from '../core/agent.js';

export const DESTRUCTIVE_TOOLS = ['file_write', 'file_edit', 'shell'];

export async function checkApproval(
  toolName: string,
  toolArgs: Record<string, unknown>,
  messages: ChatMessage[],
): Promise<boolean> {
  if (!DESTRUCTIVE_TOOLS.includes(toolName)) return true;
  if (toolName === 'shell') {
    const cmd = String(toolArgs.command || '').toLowerCase();
    if (cmd.includes('rm -rf') || cmd.includes('git reset --hard')) {
      return confirm(`Dangerous command: ${cmd}\nType 'yes' to proceed: `);
    }
  }
  if (toolName === 'file_write' || toolName === 'file_edit') return true;
  return true;
}

function confirm(prompt: string): boolean {
  return prompt.toLowerCase().startsWith('y');
}