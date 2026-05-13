## Purpose
Reorganize `src/` into three named layer directories (`core/`, `ui/`, `infra/`) alongside the existing `tools/` directory to enforce clear separation of business logic, user-facing code, and external integrations.

## Requirements

### Requirement: Source directory has three named layer directories
The `src/` directory SHALL contain exactly three layer subdirectories — `core/`, `ui/`, and `infra/` — in addition to the existing `tools/` directory. No top-level `.ts` files SHALL exist in `src/` outside of these four directories (except `tsconfig`-generated outputs).

#### Scenario: Layer directories exist after reorganization
- **WHEN** the reorganization is complete
- **THEN** `src/core/`, `src/ui/`, `src/infra/`, and `src/tools/` all exist as directories

#### Scenario: No loose TypeScript files at src/ root
- **WHEN** inspecting `src/` directly
- **THEN** there are no `.ts` files directly in `src/` (only subdirectories)

### Requirement: core/ layer contains business logic only
The `src/core/` directory SHALL contain `agent.ts`, `agent.test.ts`, `config.ts`, `session.ts`, and `compaction.ts`. Files in `core/` SHALL NOT import from `ui/` or `infra/`.

#### Scenario: core/ contains expected files
- **WHEN** listing `src/core/`
- **THEN** it contains agent.ts, agent.test.ts, config.ts, session.ts, and compaction.ts

#### Scenario: core/ does not import ui/ or infra/
- **WHEN** analyzing import statements in any file under `src/core/`
- **THEN** no import resolves to a path under `src/ui/` or `src/infra/`

### Requirement: ui/ layer contains all user-facing code
The `src/ui/` directory SHALL contain `cli.ts`, `commands.ts`, `banner.ts`, `loader.ts`, `renderer.ts`, and `terminal-bg.ts`.

#### Scenario: ui/ contains expected files
- **WHEN** listing `src/ui/`
- **THEN** it contains cli.ts, commands.ts, banner.ts, loader.ts, renderer.ts, and terminal-bg.ts

### Requirement: infra/ layer contains external integrations
The `src/infra/` directory SHALL contain `approval.ts`, `mcp-client.ts`, `rtk-install.ts`, `rtk-rewrite.ts`, `self-heal.ts`, and `toon-wrap.ts`.

#### Scenario: infra/ contains all former modules/ files
- **WHEN** listing `src/infra/`
- **THEN** it contains the expected external integration files for the current architecture

### Requirement: TypeScript compilation succeeds after reorganization
After all files are moved and import paths updated, the project SHALL compile without errors.

#### Scenario: tsc --noEmit passes
- **WHEN** running `tsc --noEmit` in the project root after the reorganization
- **THEN** the command exits with code 0 and produces no errors

### Requirement: package.json bin path is updated
If `package.json` references a compiled output path for the CLI entry point, that path SHALL reflect the new location of `cli.ts` under `src/ui/`.

#### Scenario: CLI entry point path is correct
- **WHEN** inspecting `package.json` bin or main fields
- **THEN** they reference the path corresponding to the compiled output of `src/ui/cli.ts`
