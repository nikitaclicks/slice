import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { load as parseYaml } from 'js-yaml';

export type Provider = 'openai' | 'anthropic' | 'ollama' | 'openrouter' | 'omlx';

interface PromptsConfig {
  default?: string;
  profiles?: Record<string, string>;
  providers?: Partial<Record<Provider, {
    default?: string;
    models?: Record<string, string>;
  }>>;
}

function resolvePromptFromFile(provider: Provider, model: string, profile?: string): string | null {
  const yamlPath = resolve('prompts.config.yaml');
  const jsonPath = resolve('prompts.config.json');
  const promptsPath = existsSync(yamlPath) ? yamlPath : existsSync(jsonPath) ? jsonPath : null;
  if (!promptsPath) return null;
  const raw = readFileSync(promptsPath, 'utf-8');
  const p: PromptsConfig = (promptsPath.endsWith('.yaml') ? parseYaml(raw) : JSON.parse(raw)) as PromptsConfig;
  const pick = (v: string | undefined): string | null => (v && v.trim() ? v : null);
  return (
    (profile ? pick(p.profiles?.[profile]) : null) ??
    pick(p.providers?.[provider]?.models?.[model]) ??
    pick(p.providers?.[provider]?.default) ??
    pick(p.default) ??
    null
  );
}

export interface DisplayConfig {
  toolDisplay: 'emoji' | 'grouped' | 'minimal' | 'hidden';
  reasoning: boolean;
  inputStyle: 'block' | 'bordered' | 'plain';
}

export interface AgentConfig {
  apiKey: string;
  model: string;
  provider: Provider;
  baseURL?: string;
  headers?: Record<string, string>;
  reasoningEffort?: 'low' | 'medium' | 'high';
  systemPrompt: string;
  maxSteps: number;
  /** @deprecated No equivalent in Vercel AI SDK; kept for config file compatibility only. */
  maxCost: number;
  /** Total agent run timeout in milliseconds. Omit for no timeout. */
  timeout?: number;
  sessionDir: string;
  showBanner: boolean;
  display: DisplayConfig;
  slashCommands: boolean;
}

const DEFAULTS: AgentConfig = {
  apiKey: '',
  model: 'nvidia/nemotron-3-super-120b-a12b:free',
  provider: 'openrouter',
  systemPrompt: [
    'You are Slice, a coding assistant that helps you save tokens while accomplishing tasks.',
    'You have access to tools for reading, writing, editing, and searching files, and running shell commands.',
    '',
    'Current working directory: {cwd}',
    '',
    'Guidelines:',
    '- Be extremely terse and efficient. Use as few tokens as possible.',
    '- Read only what you need. Use offset/limit to avoid reading entire files.',
    '- Prefer targeted grep glob searches over reading entire files.',
    '- When editing, make minimal changes. Never rewrite entire files.',
    '- Skip explanations unless asked. Show only what changed.',
    '- Explore the codebase proactively rather than asking questions.',
  ].join('\n'),
  maxSteps: 20,
  maxCost: 1.0,
  sessionDir: '.sessions',
  showBanner: true,
  display: { toolDisplay: 'grouped', reasoning: false, inputStyle: 'block' },
  slashCommands: true,
};

const PROVIDER_ENV_VARS: Record<Provider, string | null> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  ollama: null,
  omlx: null,
};

const PROVIDER_DEFAULT_BASE_URLS: Partial<Record<Provider, string>> = {
  anthropic: 'https://api.anthropic.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434/v1',
  omlx: 'http://127.0.0.1:8000/v1',
};

export function loadConfig(overrides: Partial<AgentConfig> = {}, profile?: string): AgentConfig {
  let config = { ...DEFAULTS };

  const configFile = profile ? `agent.${profile}.config.json` : 'agent.config.json';
  const configPath = resolve(configFile);
  let fileHasSystemPrompt = false;
  if (existsSync(configPath)) {
    const file = JSON.parse(readFileSync(configPath, 'utf-8'));
    fileHasSystemPrompt = 'systemPrompt' in file;
    if (file.display) {
      config.display = { ...config.display, ...file.display };
    }
    config = { ...config, ...file, display: config.display };
  }

  const provider = config.provider ?? 'openrouter';

  if (!fileHasSystemPrompt) {
    const fromFile = resolvePromptFromFile(provider, config.model, profile);
    if (fromFile) config.systemPrompt = fromFile;
  }

  const envVar = PROVIDER_ENV_VARS[provider];

  if (envVar && process.env[envVar]) {
    config.apiKey = process.env[envVar]!;
  } else if (provider === 'openrouter' && process.env.OPENAI_API_KEY) {
    config.apiKey = process.env.OPENAI_API_KEY;
  }

  if (process.env.AGENT_MODEL) config.model = process.env.AGENT_MODEL;
  if (process.env.AGENT_MAX_STEPS) config.maxSteps = Number(process.env.AGENT_MAX_STEPS);
  if (process.env.AGENT_MAX_COST) config.maxCost = Number(process.env.AGENT_MAX_COST);
  if (process.env.AGENT_TIMEOUT) config.timeout = Number(process.env.AGENT_TIMEOUT);

  if (overrides.display) {
    config.display = { ...config.display, ...overrides.display };
  }
  config = { ...config, ...overrides, display: config.display };

  if (!config.baseURL) {
    const defaultBase = PROVIDER_DEFAULT_BASE_URLS[provider as Provider];
    if (defaultBase) config.baseURL = defaultBase;
  }

  const requiresApiKey = PROVIDER_ENV_VARS[provider as Provider] !== null;
  if (requiresApiKey && !config.apiKey) {
    const varName = PROVIDER_ENV_VARS[provider as Provider] ?? 'API key';
    throw new Error(`${varName} is required for provider "${provider}".`);
  }

  return config;
}
