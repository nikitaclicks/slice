## ADDED Requirements

### Requirement: Single render owner
The render engine SHALL be the sole writer to `process.stdout` during an active session. All other modules SHALL call `renderEngine.print(text)` or `renderEngine.requestRender()` rather than writing to stdout directly.

#### Scenario: Tool call output does not interleave with spinner
- **WHEN** the agent emits a tool_call event while the spinner is active
- **THEN** the spinner is cleared before the tool call panel is written and the spinner redrawn after, with no partial frames visible

#### Scenario: Streamed model text appears immediately
- **WHEN** the agent emits a text delta event
- **THEN** the delta is written to the scroll region above the live zone within 50 ms of the event

### Requirement: Live zone at bottom of terminal
The render engine SHALL maintain a fixed-height "live zone" at the bottom of the visible terminal (max 4 lines) containing the active loader slot, the current tool call slot, and the input widget. The rest of the terminal SHALL scroll normally.

#### Scenario: Live zone redraws without clearing scroll history
- **WHEN** the live zone content changes
- **THEN** only the live zone lines are overwritten using cursor-up and erase-line sequences; no content above the live zone is erased

#### Scenario: Live zone is cleared on session exit
- **WHEN** the process exits cleanly
- **THEN** the live zone is erased and the cursor is left on a clean line

### Requirement: Non-TTY fallback
The render engine SHALL detect non-TTY stdin and fall back to line-buffered input with plain stdout writes, without enabling raw mode or maintaining a live zone.

#### Scenario: Pipe input works without ANSI errors
- **WHEN** stdin is a pipe (`process.stdin.isTTY === false`)
- **THEN** the render engine skips raw mode, the live zone, and all ANSI cursor sequences
