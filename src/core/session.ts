import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { cwd } from 'process';

export interface SessionData {
  id: string;
  model: string;
  created: string;
  messages: Array<{ role: string; content: string }>;
}

export async function getSessionPath(sessionDir: string): Promise<string> {
  const dir = join(sessionDir, '.sessions');
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  return dir;
}

export async function saveSession(
  sessionDir: string,
  data: SessionData,
): Promise<void> {
  const dir = await getSessionPath(sessionDir);
  const line = JSON.stringify(data) + '\n';
  await appendFile(join(dir, `${data.id}.jsonl`), line);
}

export async function listSessions(sessionDir: string): Promise<string[]> {
  const dir = await getSessionPath(sessionDir);
  const { readdir } = await import('fs/promises');
  const files = await readdir(dir);
  return files.filter((f) => f.endsWith('.jsonl')).map((f) => f.replace('.jsonl', ''));
}