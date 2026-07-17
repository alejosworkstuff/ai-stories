# AGENTS — ia-stories harness

Read this at the start of every coding session. Full system design: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

You stop trusting the model. You trust the harness.

---

## What this repo is

Collaborative AI story generator (portfolio flagship):

- **Streaming path:** `streamText` + bounded `searchCorpus` tool (UX)
- **Structured path:** `generateObject` + Zod `storySchema` (evals)
- **RAG:** Neon Postgres + pgvector; craft corpus in `corpus/`
- **Safety:** three trust zones in `lib/ai/guardrails.ts`
- **UI:** vanilla ES modules + Tailwind (`styles/main.css` → `public/css/app.css`)

Live: [ai-stories-ashy.vercel.app](https://ai-stories-ashy.vercel.app/)

---

## Four gates (every change)

A change is not done until these pass. Binary rules — no negotiation.

| # | Gate | Command / action |
|---|---|---|
| 1 | Type checker | `npm run typecheck` (`tsc --noEmit`) |
| 2 | Unit tests | `npm run test` (Vitest). New core logic needs tests. Eval/grader/guardrail changes must keep offline suites green. |
| 3 | E2E (when UI / API contract touched) | `npm run test:e2e` |
| 4 | Verify by running | Start the app (`npm run dev`) and exercise the claim you made. Green tests ≠ verified claim. |

**Full local CI:** `npm run ci` (CSS build + typecheck + tests + `.env.example`).  
**With E2E:** `npm run ci:full`.  
**AI quality (when prompts / RAG / model path change):** `npm run eval` or `npm run eval:ci` — do not refresh `evals/baseline.json` unless the run is intentionally green and reviewed.

Spend gate budget on behaviour, not formatting. No linter gate required.

---

## Feature recipe

1. Read this file + the relevant section of `docs/ARCHITECTURE.md`.
2. Change the smallest surface that matches existing module boundaries (`api/`, `lib/ai/`, `lib/rag/`, `evals/`, `public/js/`).
3. Add or update tests for new branches in core logic.
4. Run gates 1–2 always; gate 3 if user-facing; gate 4 always for behaviour claims.
5. If the change alters RAG, prompts, guardrails, or structured story shape, consider an eval run before calling it done.
6. Keep docs honest: update `ARCHITECTURE.md` when the system model changes, not as a dump of every commit.

---

## Rejected ideas (do not re-propose)

| Idea | Why rejected |
|---|---|
| Add React / Next.js App Router to this repo | Stack is intentional: Vercel Functions + vanilla client. React lives in other portfolio repos. |
| Add AI/RAG to `mini-ecommerce` | Roadmap CUT — flagship only. |
| Swap Groq for a provider that “just works” for embeddings without a plan | Groq has no embedding API; production uses `FORCE_LOCAL_EMBEDDINGS=1` (384-dim local). Changing provider means updating env + re-ingest + verifying dim. |
| Drop fenced untrusted context / rely on the model alone | Zone 2 fencing is a trust boundary; keep sanitize + fence. |
| Expand golden set to 100+ cases “for completeness” | 10 cases is the MVP contract; expand only when a failure mode repeats. |
| Claim enterprise OpenTelemetry / AWS / K8s in this project | Honesty rule — do not invent ops surface that is not here. |
| Shared service-account MCP / agent DB credentials | If tools are ever exposed, use user-scoped tokens and the existing permission model — never a back door. |
| 100% line coverage on the whole tree | Prefer tests on business logic + eval regression over coverage theatre. |
| Rewrite Tailwind back to hand-rolled CSS | Pipeline is `styles/main.css` → `npm run build:css`. |

---

## Module map (quick)

```text
api/generate-stories.ts   HTTP: rate limit → Zod → injection screen → stream
lib/ai/agent.ts           streamText + searchCorpus
lib/ai/story.ts           generateObject path for evals
lib/ai/guardrails.ts      input / retrieved / output screens
lib/rag/*                 chunk, embed, ingest, store, retrieve
evals/*                   golden set, graders, judge, baseline regression
public/js/*               client (vanilla ESM)
```

---

## Done means

- [ ] Gates 1–2 green (3 if UI/API UX changed)
- [ ] Gate 4: behaviour verified in a running app when you claimed a user-visible change
- [ ] No secrets committed; `.env.example` still accurate if new vars were added
- [ ] Architecture doc updated only if the system model changed
- [ ] You did not re-open a rejected idea from the table above
