## Why

The Slice CLI UI has grown organically and is now brittle and hard to use: tool calls display as unreadable one-liners, the input widget lacks arrow keys / history / paste / cancellation, and Ctrl+C exits the whole process instead of cancelling the current request. Users cannot tell what the agent is doing or stop it mid-flight without killing the session.

## What Changes

- Replace the spinner + raw `console.log` output with a component-based render loop that draws to a fixed viewport and redraws on change
- Replace the hand-rolled raw-mode input (`styledReadLine`, `borderedReadLine`) with a proper input widget that supports cursor movement, history, word navigation, bracketed paste, and Ctrl+C to cancel (not exit)
- Redesign tool call rendering: each call shows in a bordered panel with name, summarised args, live elapsed timer, and a ✓/✗ completion line
- Stream model text to the terminal as it arrives instead of buffering until the turn ends
- Wire Ctrl+C to abort the in-flight request; double Ctrl+C (or Ctrl+C when idle) exits

## Capabilities

### New Capabilities
- `tui-render-engine`: Minimal component-based render loop that writes differential output to a fixed region at the bottom of the scroll buffer
- `tui-input-widget`: Single-line input with cursor movement, input history, word-delete, bracketed paste, Tab completion, and Ctrl+C / Escape keybindings
- `tui-tool-call-display`: Bordered panel renderer for tool calls showing name, arg summary, elapsed time, and status

### Modified Capabilities
- (none — no existing spec-level requirements change)

## Impact

- `src/ui/cli.ts` — main loop rewired to use new input widget and render engine
- `src/ui/renderer.ts` — replaced by tui-tool-call-display component
- `src/ui/loader.ts` — replaced by render-engine's loader primitive
- `src/ui/terminal-bg.ts` — removed; raw-mode input consolidated into tui-input-widget
- No API or tool interface changes; agent core is untouched
- New dev dependency: none (all implemented in-tree to avoid external TUI lib lock-in)
