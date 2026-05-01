## 1. Create Layer Directories

- [x] 1.1 Create `src/core/`, `src/ui/`, and `src/infra/` directories

## 2. Move Files to core/

- [x] 2.1 `git mv src/agent.ts src/core/agent.ts`
- [x] 2.2 `git mv src/agent.test.ts src/core/agent.test.ts`
- [x] 2.3 `git mv src/config.ts src/core/config.ts`
- [x] 2.4 `git mv src/modules/session.ts src/core/session.ts`
- [x] 2.5 `git mv src/modules/compaction.ts src/core/compaction.ts`

## 3. Move Files to ui/

- [x] 3.1 `git mv src/cli.ts src/ui/cli.ts`
- [x] 3.2 `git mv src/commands.ts src/ui/commands.ts`
- [x] 3.3 `git mv src/banner.ts src/ui/banner.ts`
- [x] 3.4 `git mv src/loader.ts src/ui/loader.ts`
- [x] 3.5 `git mv src/renderer.ts src/ui/renderer.ts`
- [x] 3.6 `git mv src/terminal-bg.ts src/ui/terminal-bg.ts`

## 4. Move Files to infra/

- [x] 4.1 `git mv src/modules/approval.ts src/infra/approval.ts`
- [x] 4.2 `git mv src/modules/copilot-auth.ts src/infra/copilot-auth.ts`
- [x] 4.3 `git mv src/modules/copilot-proxy.ts src/infra/copilot-proxy.ts`
- [x] 4.4 `git mv src/modules/mcp-client.ts src/infra/mcp-client.ts`
- [x] 4.5 `git mv src/modules/rtk-install.ts src/infra/rtk-install.ts`
- [x] 4.6 `git mv src/modules/rtk-rewrite.ts src/infra/rtk-rewrite.ts`
- [x] 4.7 `git mv src/modules/self-heal.ts src/infra/self-heal.ts`
- [x] 4.8 `git mv src/modules/toon-wrap.ts src/infra/toon-wrap.ts`
- [x] 4.9 Remove now-empty `src/modules/` directory

## 5. Update Imports in core/

- [x] 5.1 Update `src/core/compaction.ts`: change `../agent.js` → `./agent.js`
- [x] 5.2 Update `src/core/agent.ts`: audit and fix any relative imports (config, etc.)

## 6. Update Imports in ui/

- [x] 6.1 Update `src/ui/cli.ts`: change all `./config` → `../core/config`, `./agent` → `../core/agent`, `./banner` → `./banner`, `./loader` → `./loader`, `./commands` → `./commands`, `./renderer` → `./renderer`, `./terminal-bg` → `./terminal-bg`, `../tools/` → `../tools/`, `./modules/rtk-install` → `../infra/rtk-install`, `./modules/mcp-client` → `../infra/mcp-client`, `./modules/copilot-auth` → `../infra/copilot-auth`, `./modules/copilot-proxy` → `../infra/copilot-proxy`, `./modules/self-heal` → `../infra/self-heal`
- [x] 6.2 Update `src/ui/commands.ts`: change `./config` → `../core/config`, `./agent` → `../core/agent`
- [x] 6.3 Audit remaining ui/ files (`banner.ts`, `loader.ts`, `renderer.ts`, `terminal-bg.ts`) and fix any relative imports

## 7. Update Imports in infra/

- [x] 7.1 Update `src/infra/approval.ts`: change `../agent.js` → `../core/agent.js`
- [x] 7.2 Update `src/infra/self-heal.ts`: change `../config.js` → `../core/config.js`, `../agent.js` → `../core/agent.js`
- [x] 7.3 Update `src/infra/mcp-client.ts`: change `../tools/index.js` → `../tools/index.js` (no change needed — tools/ path is the same)
- [x] 7.4 Audit remaining infra/ files for any relative imports that need updating

## 8. Update Imports in tools/

- [x] 8.1 Update `src/tools/shell.ts`: change `../modules/rtk-rewrite.js` → `../infra/rtk-rewrite.js`, `../modules/toon-wrap.js` → `../infra/toon-wrap.js`
- [x] 8.2 Update `src/tools/index.ts`: change `../modules/toon-wrap.js` → `../infra/toon-wrap.js`

## 9. Update Package Configuration

- [x] 9.1 Check `package.json` `bin`/`main` fields — if they reference a compiled `cli.js` at the root of `dist/`, update to `dist/ui/cli.js`
- [x] 9.2 Check any npm scripts that reference the old paths (e.g., `node dist/cli.js`) and update them

## 10. Verify

- [x] 10.1 Run `tsc --noEmit` — must exit with 0 errors
- [x] 10.2 Run `npm test` — all tests must pass
- [x] 10.3 Smoke-test the CLI (`node dist/ui/cli.js` or equivalent) to confirm it starts correctly
