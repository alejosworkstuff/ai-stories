# Stream debugger

StreamScope is an internal development tool for inspecting the SSE/token stream used by `ia-stories`.
The first slice lives in `lib/stream-debugger/`.

The generation endpoint now emits structured `text/event-stream` events for tokens, completion, and errors. The browser client reconstructs the story from token events, observes chunks and bytes, records time to first chunk, and validates the final text before the app saves it. Legacy `text/plain` responses remain supported.

## Current slice

- `parser.ts` incrementally parses SSE fields across arbitrary transport chunks.
- It supports `data:`, multiline data, `event:`, `id:`, `retry:`, comments, LF, CRLF, and a final unterminated line.
- `events.ts` defines Zod-backed events for parsed SSE data, stream phases, and metrics.
- `tests/stream-debugger.test.ts` protects protocol edge cases before UI integration.
- `public/js/api.js` exposes the runtime hook through `onDiagnostic`, parses the SSE envelope, and rejects empty/control-character output at the application boundary.
- `public/js/api.js` reports live connection, chunk, and completion diagnostics through `onDiagnostic`.
- `public/js/streamscope.js` renders diagnostics from the real story generation stream behind the StreamScope gear button.

`api/demo-stream.ts` remains available as a deterministic protocol fixture for tests, but it is no longer used by the product UI.

Run the focused tests with:

```bash
npm test -- --run tests/stream-debugger.test.ts
```
