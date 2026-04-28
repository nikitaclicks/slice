import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const CLIENT_ID = 'Ov23liJ4lYAfAZubi2Rb';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
}

export async function runDeviceCodeFlow(): Promise<string> {
  const dcRes = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: 'read:user' }),
  });
  const dc = await dcRes.json() as DeviceCodeResponse & { error?: string };
  if (dc.error) throw new Error(`Device code error: ${dc.error}`);

  process.stdout.write(`\nOpen ${dc.verification_uri} and enter code: ${dc.user_code}\n\n`);

  let interval = dc.interval;
  while (true) {
    await new Promise((r) => setTimeout(r, (interval + 3) * 1000));
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: dc.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const token: TokenResponse = await res.json() as TokenResponse;
    if (token.access_token) return token.access_token;
    if (token.error === 'slow_down') interval += 5;
    else if (token.error !== 'authorization_pending') throw new Error(`Auth failed: ${token.error}`);
  }
}

export function saveTokenToConfig(token: string, profile = 'copilot'): void {
  const path = resolve(`agent.${profile}.config.local.json`);
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : {};
  writeFileSync(path, JSON.stringify({ ...existing, apiKey: token }, null, 2) + '\n');
}
