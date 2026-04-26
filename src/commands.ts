import type { AgentConfig } from './config.js';

export interface Command {
  name: string;
  description: string;
  execute: (args: string[], config: AgentConfig) => Promise<string> | string;
}

export const commands: Command[] = [
  {
    name: '/model',
    description: 'Switch the active model',
    execute: async (args, config) => {
      if (!args[0]) return `Current model: ${config.model}`;
      const newModel = args.join(' ');
      config.model = newModel;
      return `Switched to ${newModel}`;
    },
  },
  {
    name: '/new',
    description: 'Start a fresh conversation',
    execute: async () => {
      return 'session_cleared';
    },
  },
  {
    name: '/help',
    description: 'List available commands',
    execute: async () => {
      return commands.map((c) => `${c.name} - ${c.description}`).join('\n');
    },
  },
  {
    name: '/compact',
    description: 'Compact context to save tokens',
    execute: async () => {
      return 'compacted';
    },
  },
  {
    name: '/session',
    description: 'Show session info',
    execute: async (_, config) => {
      return `model: ${config.model}\nsessionDir: ${config.sessionDir}`;
    },
  },
  {
    name: '/export',
    description: 'Export conversation as Markdown',
    execute: async () => {
      return 'exported';
    },
  },
];