import { exec } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { join, delimiter } from 'path';

const execAsync = promisify(exec);

const RTK_INSTALL_URL =
  'https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh';
const LOCAL_BIN = join(homedir(), '.local', 'bin');

/** State exposed for downstream modules (e.g. shell rewrite). */
export const rtkState = { available: false, path: '' as string };

async function which(bin: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`command -v ${bin}`, { shell: 'bash' });
    const p = stdout.trim();
    return p || null;
  } catch {
    return null;
  }
}

function ensureLocalBinOnPath(): void {
  const parts = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  if (!parts.includes(LOCAL_BIN)) {
    process.env.PATH = [LOCAL_BIN, ...parts].join(delimiter);
  }
}

/**
 * Detect or install the `rtk` CLI (https://github.com/rtk-ai/rtk).
 * Updates rtkState. Never throws — best-effort.
 */
export async function ensureRtk(opts?: { silent?: boolean }): Promise<void> {
  ensureLocalBinOnPath();

  let path = await which('rtk');
  if (path) {
    rtkState.available = true;
    rtkState.path = path;
    if (!opts?.silent) {
      try {
        const { stdout } = await execAsync('rtk --version', { shell: 'bash' });
        process.stdout.write(`\x1b[90m[rtk] ${stdout.trim()} (${path})\x1b[0m\n`);
      } catch {
        process.stdout.write(`\x1b[90m[rtk] available at ${path}\x1b[0m\n`);
      }
    }
    return;
  }

  if (!opts?.silent) {
    process.stdout.write('\x1b[90m[rtk] not found, installing...\x1b[0m\n');
  }

  try {
    // Mirrors README quick install
    await execAsync(`curl -fsSL ${RTK_INSTALL_URL} | sh`, {
      shell: 'bash',
      timeout: 120_000,
    });
  } catch (err: any) {
    if (!opts?.silent) {
      process.stdout.write(
        `\x1b[33m[rtk] install failed: ${err?.message ?? err}\x1b[0m\n`,
      );
    }
    return;
  }

  ensureLocalBinOnPath();
  path = await which('rtk');
  if (path) {
    rtkState.available = true;
    rtkState.path = path;
    if (!opts?.silent) {
      process.stdout.write(`\x1b[90m[rtk] installed at ${path}\x1b[0m\n`);
    }
  } else if (!opts?.silent) {
    process.stdout.write(
      '\x1b[33m[rtk] installer ran but binary still not on PATH\x1b[0m\n',
    );
  }
}
