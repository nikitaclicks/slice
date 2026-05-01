## Purpose
Allow the model to pause mid-turn and ask the user a clarifying question, then continue once an answer is received.

## Requirements

### Requirement: Model can ask user a question mid-turn
The system SHALL provide an `ask_question` tool that the model can invoke at any point during a task to ask the user a question and receive their answer before continuing.

#### Scenario: Model asks a question and user responds
- **WHEN** the model calls `ask_question` with a `question` string
- **THEN** the CLI displays the question clearly to the user, waits for text input, and returns the user's answer as the tool result so the model can proceed

#### Scenario: Non-interactive environment
- **WHEN** `ask_question` is called but stdin is not a TTY (e.g., CI, piped input)
- **THEN** the tool SHALL return an error result indicating that user input is unavailable, and the model SHALL continue without blocking

### Requirement: Question is visually distinct in the CLI
The system SHALL render the question from the model in a way that is clearly distinguishable from normal output so the user knows their input is expected.

#### Scenario: Question is displayed before input prompt
- **WHEN** the model calls `ask_question`
- **THEN** the question text is printed to stdout with a visible label (e.g., a prefix or color) before the input cursor appears
