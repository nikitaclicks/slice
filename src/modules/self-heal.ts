import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import type { Tool } from 'ai';
import type { AgentConfig } from '../config.js';
import type { AgentEvent } from '../agent.js';
import { runAgentWithRetry } from '../agent.js';

const __filename = fileURLToPath(import.meta.url);
// src/modules/self-heal.ts -> src/modules -> src -> slice root
const SLICE_ROOT = dirname(dirname(dirname(__filename)));
const SRC_DIR = join(SLICE_ROOT, 'src');

const SYSTEM = `You are in SELF-HEAL mode for the Slice CLI agent.

An error occurred in Slice itself. Your job:
1. Read the relevant source files in ${SRC_DIR}/ to diagnose the issue
2. Apply a minimal, targeted fix using file_edit
3. Briefly explain what you changed and why

Rules:
- Only modify TypeScript files in ${SRC_DIR}/
- Never touch config files, node_modules, or anything outside ${SRC_DIR}/
- Make the smallest change that fixes the problem
- Be terse — diagnose and fix, skip lengthy explanations`;

export async function selfHeal(
  err: Error,
  userInput: string,
  config: AgentConfig,
  mcpTools: Record<string, Tool>,
  onEvent: (event: AgentEvent) => void,
): Promise<string> {
  const healConfig: AgentConfig = {
    ...config,
    systemPrompt: SYSTEM,
    maxSteps: 20,
  };

  const prompt = [
    `Error: ${err.message}`,
    userInput ? `User was trying to: ${userInput}` : '',
    'Diagnose the root cause in the Slice source and apply a fix.',
  ].filter(Boolean).join('\n');

  const result = await runAgentWithRetry(healConfig, prompt, { onEvent, extraTools: mcpTools });
  return result.text;
}

export function getGitDiff(): string {
  try {
    return execSync('git diff src/', { cwd: SLICE_ROOT, encoding: 'utf-8' });
  } catch {
    return '';
  }
}

