## 1. Implement the ask_question tool

- [x] 1.1 Create `src/tools/ask-question.ts` with a `tool()` definition accepting a `question: string` parameter
- [x] 1.2 In the `execute` function, detect `process.stdin.isTTY`; if false, return an error result telling the model to proceed without user input
- [x] 1.3 Use `readline.createInterface` to prompt the user, print the question with a visible prefix (e.g. `[?]` in a distinct color), and resolve with the user's answer
- [x] 1.4 Export the tool as `askQuestionTool`

## 2. Register the tool

- [x] 2.1 Import `askQuestionTool` in `src/tools/index.ts`
- [x] 2.2 Add `ask_question: askQuestionTool` to the `tools` export (no `wrapToon` — the tool returns plain text, not structured data)

## 3. Verify end-to-end behavior

- [x] 3.1 Run the agent and confirm the model can call `ask_question`, the question appears visually distinct in the terminal, and the model continues after the answer is submitted
- [x] 3.2 Pipe stdin (`echo "" | slice ...`) and confirm the tool returns a non-blocking error result instead of hanging
