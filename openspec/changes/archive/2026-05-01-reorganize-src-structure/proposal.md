## Why

The `src/` directory mixes concerns at the same level — UI/rendering code sits alongside business logic, `modules/` contains a heterogeneous mix of auth, proxies, session management, and utilities, and there are no clear layer boundaries. This makes the codebase hard to navigate and slows down onboarding and feature development.

## What Changes

- Introduce explicit layer directories under `src/` (e.g., `core/`, `ui/`, `infra/`) to separate concerns
- Move top-level files (`cli.ts`, `banner.ts`, `loader.ts`, `renderer.ts`, `terminal-bg.ts`) into appropriate layer directories
- Split `modules/` into cohesive groupings so each directory has a single responsibility
- Update all import paths across the codebase to reflect the new layout
- Keep `tools/` as-is (already well-organized)

## Capabilities

### New Capabilities

- `src-layout`: Defines the canonical directory structure for `src/`, including layer names, what belongs in each layer, and the rules for adding new files

### Modified Capabilities

## Impact

- All `import` statements across `src/` will change — this is a mechanical rename, no behavior changes
- `tsconfig.json` path aliases (if any) may need updating
- No API surface or runtime behavior changes
