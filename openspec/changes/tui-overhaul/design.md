## Context

Slice's UI layer (`src/ui/`) has accumulated three independent, conflicting mechanisms for talking to the terminal:

1. **`loader.ts`** — a `setInterval` spinner that writes `\r` to overwrite a single line.
2. **`terminal-bg.ts`** — a hand-rolled raw-mode reader that manages cursor hide/show, background detection, and text rendering directly.
3. **`cli.ts`** — `console.log` calls that fire between loader state changes, causing interleaving and flicker.

There is no concept of "regions" — the spinner line, tool call lines, and streamed model text all compete for the same cursor position. Cancellation is wired only to `ask_question`'s `AbortController`; pressing Ctrl+C exits the process.

The reference implementation (pi-mono/tui) shows how a minimal component-based render loop eliminates all of these conflicts without pulling in a heavy framework.

## Goals / Non-Goals

**Goals:**
- Single unified render path: one place writes to stdout, everything else calls `requestRender()`
- Input widget that behaves like a real terminal editor (arrows, history, paste, Ctrl+C = cancel)
- Tool call panels that are readable and clearly show status + elapsed time
- Ctrl+C during generation cancels the request; Ctrl+C at idle (or second press) exits
- Streamed model text appears immediately as it arrives, not buffered until turn end

**Non-Goals:**
- Full TUI framework (overlays, focus management, mouse) — not needed here
- Switching to an external TUI dependency (risk of version churn, we only need ~10% of any library)
- Changing the agent core, tool interfaces, or config format
- Multi-line input / editor widget

## Decisions

### D1: In-tree minimal render engine over external library

**Decision**: Implement a ~200-line render engine in `src/ui/render-engine.ts` instead of importing pi-mono TUI or ink.

**Rationale**: Slice only needs three primitives — a scrolling content region, a single-line input widget, and a loader slot. A full TUI library introduces ~15k LOC of dependency surface with Kitty protocol, overlays, and image support that are irrelevant. The render engine can be a direct port of the differential-rendering pattern from pi-mono without any npm dependency.

**Alternative considered**: `ink` (React for CLIs) — rejected because it requires JSX transpilation, adds Yoga layout overhead, and makes streaming output harder to control.

### D2: AbortController per request, Ctrl+C hooks into it

**Decision**: Each agent run gets a fresh `AbortController`. The input widget emits a `cancel` event on Ctrl+C. The CLI loop:
1. If a request is in flight → abort it, show "Cancelled." partial output
2. If idle → exit (same as before)

**Rationale**: The current "Ctrl+C = process.exit" is the biggest UX pain point. Users frequently want to stop a runaway tool chain without losing the session.

**Alternative considered**: SIGINT handler at process level — rejected because it doesn't distinguish idle vs. in-flight state.

### D3: Render engine writes to a fixed bottom zone, content scrolls above

**Decision**: The render engine reserves `N` lines at the bottom of the visible terminal for the "live" zone (input widget + active tool call slot + loader). All completed content (model text, finished tool calls) is printed to the normal scroll buffer above this zone using simple `process.stdout.write`.

**Rationale**: This avoids the complexity of full-screen re-rendering while still allowing the live zone to redraw without flicker. Pi-mono uses this same pattern.

**Alternative considered**: Full-screen mode (alternate buffer) — rejected because it hides scroll history, which users rely on.

### D4: History stored in-memory per session, not persisted

**Decision**: Up/down arrow cycles through the current session's input history only. No `~/.slice_history` file.

**Rationale**: Keeps the scope small; persistent history can be a follow-up. The main pain is having no history at all.

## Risks / Trade-offs

- **ANSI escape sequence reliability** → The render engine uses standard VT100 sequences (cursor-up, erase-line). Works on all major terminals; we already depend on these in the existing code. Risk is low.
- **Raw mode + readline coexistence** → The existing code has fragile patterns around this. New code must own raw mode exclusively during input; we remove `terminal-bg.ts` and the old readline setup entirely. Risk: regression in non-TTY (piped) mode → mitigation: non-TTY falls back to line-buffered stdin, same as before.
- **Spinner line count** → If the live zone grows past the viewport height, rendering breaks. Mitigation: cap the live zone to 4 lines (loader + 1 tool call + 1 blank + input); overflow is clipped.

## Migration Plan

1. Add `src/ui/render-engine.ts`, `src/ui/input-widget.ts`, `src/ui/tool-panel.ts` as new files
2. Update `src/ui/cli.ts` to use new components; keep the agent core unchanged
3. Delete `src/ui/loader.ts`, `src/ui/terminal-bg.ts`, `src/ui/renderer.ts` once cli.ts is updated
4. No config changes required; `display.inputStyle` option becomes a no-op and can be removed in a follow-up

## Open Questions

- Should we persist input history between sessions? (deferred — out of scope)
- Should tool call panels support expanding to show full args on a keypress? (nice-to-have, not required for this change)
