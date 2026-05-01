## 1. Render Engine

- [ ] 1.1 Create `src/ui/render-engine.ts` with a `RenderEngine` class that owns stdout writes, tracks the live zone height, and exposes `print(text)`, `setLiveLines(lines: string[])`, and `clear()` methods
- [ ] 1.2 Implement differential redraw: on `setLiveLines`, move cursor up N lines, erase each line, write new content, and restore cursor
- [ ] 1.3 Add non-TTY fallback: when `process.stdin.isTTY === false`, `setLiveLines` is a no-op and `print` writes directly to stdout
- [ ] 1.4 Add `dispose()` method that erases the live zone and resets the cursor for clean exit

## 2. Input Widget

- [ ] 2.1 Create `src/ui/input-widget.ts` with an `InputWidget` class that owns raw mode and renders a single-line prompt into the render engine's live zone
- [ ] 2.2 Implement basic character input: printable chars insert at cursor, Backspace deletes left, Enter submits
- [ ] 2.3 Implement cursor movement: Left/Right arrows, Home/End keys
- [ ] 2.4 Implement word-level editing: Ctrl+Left / Ctrl+Right for word jump, Ctrl+W / Alt+Backspace for delete-word-left
- [ ] 2.5 Implement Ctrl+U to clear the input line
- [ ] 2.6 Implement session history: store each submitted input, up/down arrows cycle through history, down at newest entry restores the in-progress draft
- [ ] 2.7 Implement bracketed paste: buffer `\x1b[200~…\x1b[201~` sequences and insert at cursor without treating `\n` as submit
- [ ] 2.8 Implement Ctrl+C: emit a `cancel` event; caller decides whether to abort the request or exit
- [ ] 2.9 Implement Tab completion for slash commands (same logic as the existing `tryComplete` in terminal-bg.ts)

## 3. Tool Call Display

- [ ] 3.1 Create `src/ui/tool-panel.ts` with a `ToolPanel` class that tracks active tool calls and returns `string[]` lines for the render engine
- [ ] 3.2 Implement tool call start: add a panel entry with name + arg summary (truncated to 50 chars) and start a 100 ms interval that updates the elapsed timer line in the render engine
- [ ] 3.3 Implement tool call completion: stop the timer, change ⚡ to ✓ (green) or ✗ (red), flush the final line to the scroll buffer via `renderEngine.print()`
- [ ] 3.4 Add yellow coloring when elapsed time exceeds 60 s
- [ ] 3.5 Cap live tool call lines to 3; older completed calls are flushed to scroll immediately

## 4. CLI Integration

- [ ] 4.1 Update `src/ui/cli.ts` to instantiate `RenderEngine`, `InputWidget`, and `ToolPanel`; remove imports of `loader.ts`, `terminal-bg.ts`, and `renderer.ts`
- [ ] 4.2 Wire `InputWidget.cancel` event: if `requestInFlight` → call `abortController.abort()`; else → `process.exit(0)`
- [ ] 4.3 Wire agent `text` events to `renderEngine.print()` instead of buffering to `responseText` (remove the buffer-then-flush pattern)
- [ ] 4.4 Wire agent `tool_call` and `tool_result` events to `ToolPanel`
- [ ] 4.5 Replace `startLoader()` / `stopLoader()` calls with `renderEngine.setLiveLines()`-based loader slot in `ToolPanel`
- [ ] 4.6 Remove `display.inputStyle` option handling (block/bordered/plain branches) — all paths now use `InputWidget`

## 5. Cleanup

- [ ] 5.1 Delete `src/ui/loader.ts`
- [ ] 5.2 Delete `src/ui/terminal-bg.ts`
- [ ] 5.3 Delete `src/ui/renderer.ts`
- [ ] 5.4 Remove `detectBg`, `styledReadLine`, `borderedReadLine` references from config types and `src/core/config.ts`
- [ ] 5.5 Update `src/ui/commands.ts` if it references any removed exports
