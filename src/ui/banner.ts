const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';

const LOGO = `
   _____ __    ________________
  / ___// /   /  _/ ____/ ____/
  \\__ \\/ /    / // /   / __/   
 ___/ / /____/ // /___/ /___   
/____/_____/___/\\____/_____/  
`;

export function printBanner(model: string): void {
  console.log(CYAN + BOLD + LOGO + RESET);
  console.log(`  ${DIM}model  ${RESET}${model}\n`);
}
