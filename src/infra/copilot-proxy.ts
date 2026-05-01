import { spawn, type ChildProcess } from 'child_process';
import { createConnection } from 'net';

let proc: ChildProcess | null = null;

function waitForPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const attempt = () => {
      const sock = createConnection(port, '127.0.0.1');
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => { sock.destroy(); setTimeout(attempt, 500); });
    };
    attempt();
  });
}

export async function startCopilotProxy(): Promise<void> {
  proc = spawn('npx', ['copilot-api@latest', 'start'], {
    // inherit stderr so device-auth prompts are visible; suppress stdout (request logs)
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: true,
  });

  proc.on('error', (err) => {
    process.stderr.write(`[copilot-proxy] ${err.message}\n`);
  });

  await waitForPort(4141); // waits indefinitely — first run requires GitHub device auth on stderr
}

export function stopCopilotProxy(): void {
  if (proc) {
    proc.kill();
    proc = null;
  }
}
