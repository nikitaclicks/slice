## Context

`src/` currently has 9 top-level files and two subdirectories (`modules/`, `tools/`). The top-level files span multiple concerns (entry point, UI rendering, config, the agent loop), and `modules/` is a catch-all that mixes authentication, proxy infrastructure, session state, and error recovery. There are no enforced layer boundaries, so import direction is unconstrained.

## Goals / Non-Goals

**Goals:**
- Introduce three clearly named layer directories (`core/`, `ui/`, `infra/`) to group top-level files and current `modules/` entries
- Define a stable rule for where new files go so the structure stays clean over time
- Preserve `tools/` as-is (already well-organized)
- Zero behavior change — pure file moves and import path updates

**Non-Goals:**
- Splitting individual files or refactoring logic within files
- Changing export shapes or public APIs
- Adding index/barrel files beyond what already exists
- Modifying `tsconfig.json` path aliases (none currently exist)

## Decisions

**Decision 1: Three named layers — `core/`, `ui/`, `infra/`**

| Layer | Contents | Rationale |
|-------|----------|-----------|
| `core/` | `agent.ts`, `agent.test.ts`, `config.ts`, `modules/session.ts`, `modules/compaction.ts` | Pure business logic with no I/O or UI coupling |
| `ui/` | `cli.ts`, `commands.ts`, `banner.ts`, `loader.ts`, `renderer.ts`, `terminal-bg.ts` | Everything the user directly sees or interacts with |
| `infra/` | All remaining `modules/` files: `approval.ts`, `copilot-auth.ts`, `copilot-proxy.ts`, `mcp-client.ts`, `rtk-install.ts`, `rtk-rewrite.ts`, `self-heal.ts`, `toon-wrap.ts` | External integrations and cross-cutting infrastructure |

Alternatives considered:
- **Keep `modules/` as-is, only move top-level files**: doesn't fix the core problem — `modules/` remains a grab-bag.
- **Four layers with a separate `commands/` dir**: commands.ts is small and tightly coupled to `cli.ts`; splitting adds indirection without clarity.

**Decision 2: Flat files within each layer (no sub-subdirectories)**

Each layer dir holds flat `.ts` files. No nested grouping within layers. Reason: the file count per layer is small (≤8); nested dirs would over-engineer for current scale.

**Decision 3: Entry point (`cli.ts`) moves to `ui/`, `tsconfig` unchanged**

`cli.ts` is the user-facing shell; it belongs in `ui/`. The `package.json` `main`/`bin` field references the compiled output path, which may need updating after the move. `tsconfig.json` compiles `src/**` so no changes needed there.

## Risks / Trade-offs

- **Import churn**: Every file in `src/` will have updated import paths. Risk of missing an import → Mitigation: TypeScript compiler will catch all broken imports; run `tsc --noEmit` after the move.
- **`package.json` bin path**: If `package.json` points to `dist/cli.js`, it needs to change to `dist/ui/cli.js` → Mitigation: update `package.json` as part of the task list.
- **Editor history / git blame**: `git mv` preserves history; plain copy-delete does not → Mitigation: use `git mv` for all moves.

## Migration Plan

1. Move files with `git mv` in the order that minimizes broken intermediate states (leaf files first, then files that import them)
2. Update import paths in each moved file
3. Update import paths in files that import the moved files
4. Run `tsc --noEmit` to verify zero type errors
5. Run existing tests (`npm test`) to verify no regressions
6. Update `package.json` `bin`/`main` if needed

Rollback: `git revert` — the change is a single atomic commit with no data migration.
