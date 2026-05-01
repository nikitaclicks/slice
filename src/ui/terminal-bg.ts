import { emitKeypressEvents, createInterface } from 'readline';
import { Writable } from 'stream';

const FALLBACK = '\x1b[100m';

function blend(
  fg: [number, number, number],
  bg: [number, number, number],
  alpha: number,
): [number, number, number] {
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ];
}

function isLight(r: number, g: number, b: number): boolean {
  return 0.299 * r + 0.587 * g + 0.114 * b > 128;
}

function toAnsi(r: number, g: number, b: number): string {
  const ct = process.env.COLORTERM ?? '';
  if (ct.includes('truecolor') || ct.includes('24bit')) {
    return `\x1b[48;2;${r};${g};${b}m`;
  }
  const ri = Math.round((r / 255) * 5);
  const gi = Math.round((g / 255) * 5);
  const bi = Math.round((b / 255) * 5);
  return `\x1b[48;5;${16 + 36 * ri + 6 * gi + bi}m`;
}

function queryTerminalBg(timeoutMs = 200): Promise<[number, number, number] | null> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(null);
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();

    let buf = '';
    const onData = (data: Buffer) => {
      buf += data.toString();
      const match = buf.match(
        /\x1b\]11;rgb:([0-9a-fA-F]+)\/([0-9a-fA-F]+)\/([0-9a-fA-F]+)/,
      );
      if (match) {
        cleanup();
        resolve([
          parseInt(match[1].slice(0, 2), 16),
          parseInt(match[2].slice(0, 2), 16),
          parseInt(match[3].slice(0, 2), 16),
        ]);
      }
    };

    function cleanup() {
      clearTimeout(timer);
      process.stdin.off('data', onData);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
    }

    process.stdin.on('data', onData);
    process.stdout.write('\x1b]11;?\x07');
  });
}

export async function detectBg(): Promise<string> {
  const bg = await queryTerminalBg();
  if (!bg) return FALLBACK;
  const [r, g, b] = bg;
  const [top, alpha]: [[number, number, number], number] = isLight(r, g, b)
    ? [[0, 0, 0], 0.04]
    : [[255, 255, 255], 0.12];
  const [br, bg2, bb] = blend(top, [r, g, b], alpha);
  return toAnsi(br, bg2, bb);
}

/** Try to complete `line` against `candidates`. Returns new line string on match, or null. */
function tryComplete(
  line: string,
  candidates: string[],
): { line: string; suggestions: string[] } | null {
  if (!line) return null;
  const hits = candidates.filter((c) => c.startsWith(line));
  if (!hits.length) return null;
  if (hits.length === 1) return { line: hits[0], suggestions: [] };
  // Find common prefix
  let prefix = hits[0];
  for (const h of hits) {
    let i = 0;
    while (i < prefix.length && i < h.length && prefix[i] === h[i]) i++;
    prefix = prefix.slice(0, i);
  }
  return { line: prefix.length > line.length ? prefix : line, suggestions: hits };
}

const WHITE = '\x1b[97m';
const RESET = '\x1b[0m';
const GRAY = '\x1b[90m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

export interface RawInputOptions {
  completions?: string[];
}

/**
 * Core raw input using readline.createInterface with a null output stream
 * (suppresses echo) + keypress events for live rendering.
 * Throws if stdin is not a TTY.
 */
function rawInput(
  opts: RawInputOptions,
  onDraw: (line: string, isFirstDraw: boolean) => void,
  onResolve: (line: string) => void,
): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error('stdin is not a TTY — use plain input style');
  }
  return new Promise((resolve) => {
    let line = '';

    // Null writable — discards readline's own character output so terminal doesn't echo
    const nullStream = new Writable({ write(_chunk, _enc, cb) { cb(); } });

    // Creating an interface with this null output causes readline to suppress terminal echo
    const rl = createInterface({
      input: process.stdin,
      output: nullStream,
      terminal: true,
    });

    // Enable keypress events on stdin
    emitKeypressEvents(process.stdin, rl);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    // Initial draw
    onDraw(line, true);

    const onKeypress = (
      _char: string | undefined,
      key: { name: string; ctrl?: boolean; sequence: string },
    ) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write(`${RESET}${SHOW_CURSOR}\n`);
        process.exit(0);
      }

      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        onResolve(line);
        resolve(line);
        return;
      }

      if (key.name === 'backspace') {
        if (line.length > 0) {
          line = line.slice(0, -1);
          onDraw(line, false);
        }
        return;
      }

      if (key.name === 'tab') {
        const result = tryComplete(line, opts.completions ?? []);
        if (result !== null) {
          line = result.line;
          // Show suggestions on a line below the prompt, then force full redraw
          if (result.suggestions.length > 1) {
            const dim = '\x1b[2m';
            const reset = '\x1b[0m';
            const hint = result.suggestions.join('  ');
            process.stdout.write(`\n${dim}  ${hint}${reset}\n`);
            // Signal full redraw by passing first=true (styles reset their own flag on first=true)
            onDraw(line, true);
          } else {
            onDraw(line, false);
          }
        }
        return;
      }

      if (key.name === 'space') {
        line += ' ';
        onDraw(line, false);
        return;
      }

      // Ignore special keys (arrows, F-keys, etc.)
      if (key.name && key.name.length > 1) return;

      // Printable character
      const ch = key.sequence;
      if (ch && ch.charCodeAt(0) >= 32) {
        line += ch;
        onDraw(line, false);
      }
    };

    process.stdin.on('keypress', onKeypress);

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      rl.close();
    }
  });
}

export function styledReadLine(bg: string, opts: RawInputOptions = {}): Promise<string> {
  let firstDraw = true;

  function draw(line: string, isFirst: boolean) {
    if (isFirst && firstDraw) {
      firstDraw = false;
      process.stdout.write(
        `${HIDE_CURSOR}\n${bg}\x1b[K${RESET}\n` +
        `${bg}\x1b[K ${WHITE}›${RESET}${bg}${WHITE} ${line}${RESET}\n` +
        `${bg}\x1b[K${RESET}\x1b[1A\r\x1b[4G${SHOW_CURSOR}`,
      );
    } else {
      process.stdout.write(
        `${HIDE_CURSOR}\r\x1b[2K${bg}\x1b[K ${WHITE}›${RESET}${bg}${WHITE} ${line}${RESET}${SHOW_CURSOR}`,
      );
    }
  }

  return rawInput(opts, draw, () => {
    process.stdout.write(`${RESET}\n`);
  });
}

export function borderedReadLine(
  borderColor = GRAY,
  opts: RawInputOptions = {},
): Promise<string> {
  const width = process.stdout.columns || 80;
  const border = `${borderColor}${'─'.repeat(width)}${RESET}`;
  let firstDraw = true;

  function draw(line: string, isFirst: boolean) {
    if (isFirst && firstDraw) {
      firstDraw = false;
      process.stdout.write(
        `${HIDE_CURSOR}\n${border}\n› ${line}\n${border}\x1b[1A\r\x1b[${3 + line.length}G${SHOW_CURSOR}`,
      );
    } else {
      process.stdout.write(`${HIDE_CURSOR}\r\x1b[2K› ${line}${SHOW_CURSOR}`);
    }
  }

  return rawInput(opts, draw, (line) => {
    if (!line) {
      process.stdout.write(`\x1b[1A\x1b[2K\x1b[1A\x1b[2K\r`);
    } else {
      process.stdout.write(`\x1b[1B\x1b[2K\r`);
    }
  });
}
