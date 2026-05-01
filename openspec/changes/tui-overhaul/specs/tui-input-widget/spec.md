## ADDED Requirements

### Requirement: Cursor movement within the input line
The input widget SHALL support left and right arrow keys to move the cursor within the current input, and Home/End to jump to start/end of line.

#### Scenario: Left arrow moves cursor back one character
- **WHEN** the user presses the left arrow key with cursor not at position 0
- **THEN** the cursor moves one character to the left and the input line redraws with the cursor in the new position

#### Scenario: Right arrow at end of line does nothing
- **WHEN** the user presses the right arrow key with cursor at the end of the input
- **THEN** the cursor position is unchanged

### Requirement: Session input history navigation
The input widget SHALL maintain an ordered list of previously submitted inputs for the current session and allow navigating them with up/down arrow keys.

#### Scenario: Up arrow recalls previous input
- **WHEN** the user presses the up arrow with at least one prior submission in history
- **THEN** the input line is replaced with the most recent prior submission

#### Scenario: Down arrow returns to current draft
- **WHEN** the user has navigated back in history and presses down arrow
- **THEN** the input line moves forward in history; if already at the newest entry, the original draft is restored

### Requirement: Word-level editing shortcuts
The input widget SHALL support Ctrl+Left / Ctrl+Right to move by word and Ctrl+W (or Alt+Backspace) to delete the word to the left of the cursor.

#### Scenario: Ctrl+W deletes the word before the cursor
- **WHEN** the user presses Ctrl+W with text to the left of the cursor
- **THEN** the word immediately to the left of the cursor (delimited by whitespace) is deleted

### Requirement: Ctrl+U clears the input line
The input widget SHALL clear the entire input buffer and reset the cursor to position 0 when the user presses Ctrl+U.

#### Scenario: Ctrl+U on non-empty line
- **WHEN** the user presses Ctrl+U with text in the input
- **THEN** the input buffer becomes empty and the prompt redraws blank

### Requirement: Bracketed paste support
The input widget SHALL handle bracketed paste sequences (`\x1b[200~…\x1b[201~`) by inserting the pasted text at the cursor position without treating newlines as submit events.

#### Scenario: Pasting multi-word text inserts at cursor
- **WHEN** the user pastes "hello world" via the clipboard
- **THEN** "hello world" is inserted at the current cursor position as a single operation

### Requirement: Ctrl+C cancels or exits
The input widget SHALL emit a `cancel` event on Ctrl+C. The CLI SHALL interpret this event as:
- If a request is in-flight → abort the request and resume the input prompt
- If idle → exit the process

#### Scenario: Ctrl+C during generation cancels the request
- **WHEN** the user presses Ctrl+C while the agent is running
- **THEN** the in-flight AbortController is aborted, partial output is flushed, and the input prompt reappears without exiting the process

#### Scenario: Ctrl+C at idle exits
- **WHEN** the user presses Ctrl+C while the input prompt is waiting
- **THEN** the process exits cleanly

### Requirement: Tab completion for slash commands
The input widget SHALL complete slash command names on Tab key press, cycling through matches if multiple exist.

#### Scenario: Tab completes unambiguous prefix
- **WHEN** the user has typed "/cl" and presses Tab
- **THEN** the input is completed to "/clear" (or the only matching command)

#### Scenario: Tab with ambiguous prefix shows all matches
- **WHEN** the user has typed "/" and presses Tab
- **THEN** a list of all slash commands is shown below the input line
