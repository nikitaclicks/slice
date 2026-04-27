## Why

The model currently has no way to ask clarifying questions without interrupting the agentic flow — it must either guess or stop and wait. Adding an `ask_question` tool lets the model surface questions asynchronously, keeping the conversation moving while still getting the input it needs.

## What Changes

- Add a new `ask_question` tool available to the model during task execution
- The tool sends a question to the user and waits for their response inline, without terminating the current agent turn
- The model can call this tool at any point when it needs clarification, then continue executing with the answer

## Capabilities

### New Capabilities
- `ask-question-tool`: Tool that allows the model to ask the user a question and receive an answer mid-turn, without stopping the agentic flow

### Modified Capabilities

## Impact

- Backend: new tool definition added to the tool registry / model context
- Frontend: UI must surface the question and capture user input in real time
- Conversation flow: question + answer pair is injected into the model's context so it can proceed
