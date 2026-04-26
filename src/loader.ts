const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let frame = 0;
let interval: NodeJS.Timeout | null = null;

export function startLoader(text = 'Working'): void {
  frame = 0;
  interval = setInterval(() => {
    process.stdout.write(`\r${text}${SPINNER_FRAMES[frame++ % SPINNER_FRAMES.length]}`);
  }, 80);
}

export function stopLoader(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
    process.stdout.write('\r\x1b[K');
  }
}