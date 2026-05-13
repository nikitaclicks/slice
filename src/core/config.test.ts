import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  AGENT_MODEL: process.env.AGENT_MODEL,
  AGENT_MAX_STEPS: process.env.AGENT_MAX_STEPS,
  AGENT_MAX_COST: process.env.AGENT_MAX_COST,
  AGENT_TIMEOUT: process.env.AGENT_TIMEOUT,
};

let tempDir = '';

describe('loadConfig', () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'slice-config-'));
    process.chdir(tempDir);
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AGENT_MODEL;
    delete process.env.AGENT_MAX_STEPS;
    delete process.env.AGENT_MAX_COST;
    delete process.env.AGENT_TIMEOUT;
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    rmSync(tempDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('rejects unsupported providers from config files', () => {
    writeFileSync('agent.config.json', JSON.stringify({ provider: 'copilot', model: 'gpt-4o' }));

    expect(() => loadConfig()).toThrow(/Unsupported provider "copilot"/);
  });
});
