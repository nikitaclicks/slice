## ADDED Requirements

### Requirement: Tool call panel with name and arg summary
Each tool call SHALL be displayed as a single bordered line showing the tool name and a brief summary of the key argument (truncated to fit the terminal width).

#### Scenario: Shell tool call shows the command
- **WHEN** a tool_call event fires for the `shell` tool with `command: "git status"`
- **THEN** the display shows a line like: `  ⚡ shell  git status`

#### Scenario: Long arg summary is truncated with ellipsis
- **WHEN** a tool_call event fires with an argument value longer than 50 characters
- **THEN** the displayed summary is truncated to 50 characters followed by `…`

### Requirement: Live elapsed time during execution
While a tool call is executing, the display SHALL show an animated elapsed timer (e.g. `0.1s`, `0.2s`, …) updating every 100 ms.

#### Scenario: Elapsed timer ticks during execution
- **WHEN** a tool_call event fires and the tool has not yet returned
- **THEN** the elapsed time displayed in the tool call line increments approximately every 100 ms

### Requirement: Completion status on tool result
When a tool_result event arrives, the tool call panel SHALL update to show a green ✓ (success) or red ✗ (error) with the final elapsed time, and remain in the scroll buffer.

#### Scenario: Successful tool result shows green check
- **WHEN** a tool_result event arrives for a previously started tool call
- **THEN** the line updates to `  ✓ <name> (1.3s)` in green and is flushed to the scroll buffer

#### Scenario: Tool call with no result within 60 s shows warning
- **WHEN** a tool call has been running for more than 60 seconds
- **THEN** the elapsed timer is displayed in yellow to signal a long-running operation

### Requirement: Multiple concurrent tool calls displayed in order
If the agent makes multiple tool calls in a single turn, each SHALL be displayed in the order received, stacked vertically in the live zone (up to a cap of 3 visible at once; older ones scroll off).

#### Scenario: Second tool call appends below the first
- **WHEN** a second tool_call event fires while the first is still in the live zone
- **THEN** a second panel line appears below the first without overwriting it
