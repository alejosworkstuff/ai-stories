# AI Stories — Streaming RAG + Agentic Generation

[![local CI](https://img.shields.io/badge/local%20CI-passing-brightgreen?logo=github-actions&logoColor=white)](.github/workflows/ci.yml) [![Vercel](https://img.shields.io/badge/deployed-Vercel-black?logo=vercel&logoColor=white)](https://ai-stories-ashy.vercel.app/)

A collaborative AI story generator built as a **production-minded AI-engineering** portfolio piece. It streams tokens to the browser, grounds generation in a retrieved corpus (RAG over **pgvector**), runs an **agentic tool-calling loop** on the **Vercel AI SDK**, enforces **typed outputs** and **prompt-injection guardrails**, and ships with an **eval harness** and **observability**.

> Built on the Vercel AI SDK's OpenAI-compatible provider, so the LLM backend is swappable. **Production default: Groq** (`llama-3.3-70b-versatile`, free tier). Point `AI_BASE_URL`/`AI_API_KEY` at OpenRouter, Google AI Studio (Gemini), OpenAI, or Anthropic to switch.

**Architecture doc** — RAG pipeline (Neon pgvector → ingestion → retrieval), eval methodology (golden set, LLM judge, baseline), and safety model (guardrails, prompt-injection defense): **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**

## Screenshots

| Main form | Fallback mode | Dark mode |
|:---:|:---:|:---:|
| ![Main form](./docs/screenshots/main.webp) | ![Fallback mode](./docs/screenshots/fallback.webp) | ![Dark mode](./docs/screenshots/dark.webp) |

---

## What this demonstrates

- **Vercel AI SDK** (`streamText`, `generateObject`, `embed`/`embedMany`, `tool`, `stepCountIs`).
- **Streaming UX** — tokens render as they arrive; the vanilla client reads the response stream.
- **RAG over pgvector (Neon)** — a storytelling-craft corpus is chunked, embedded, and retrieved by cosine similarity to ground generation.
- **Agentic tool calling** — the model calls a `searchCorpus` tool inside a bounded multi-step loop.
- **Typed outputs** — a Zod `storySchema` powers structured generation (`generateObject`) and the eval graders.
- **Guardrails & safety** — prompt-injection screening on input, retrieved content fenced as untrusted, per-IP rate limiting, and strict CSP/security headers.
- **Eval harness** — a golden set + deterministic graders score schema-validity, structure, and prompt-leak resistance, gating CI when a provider is configured.
- **Observability** — structured per-generation telemetry (model, latency, tokens, steps, tool calls), with optional Langfuse forwarding.
- **Resilient fallback** — provider/credit errors degrade gracefully to a deterministic local generator (kept from v1).
- **TypeScript end-to-end** on the server, with Vitest + Playwright.

---

## RAG quick start

```bash
npm run db:setup     # CREATE EXTENSION vector + documents table + HNSW index
npm run db:ingest    # chunk + embed + upsert corpus/*.md
```

Pipeline details, eval methodology, and the three-zone safety model → **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**

---

## API contract — `POST /api/generate-stories`

Request body:

```json
{ "messages": [{ "role": "user", "content": "A lighthouse keeper finds a bottle." }], "tone": "wistful", "length": "short" }
```

Responses:

- `200` — `text/plain` token stream (the generated story prose).
- `400` — `{ "error": "messages_required" | "invalid_length" | "unsafe_request" | ... }`.
- `402` — `{ "error": "provider_no_credits" }` (client falls back to the local generator).
- `422` — `{ "error": "unsafe_output" }` (output guardrail blocked prompt/tool leakage).
- `405` — `{ "error": "method_not_allowed" }`.
- `429` — `{ "error": "rate_limit_exceeded" }`.
- `500` — `{ "error": "generation_failed" }` (no internal details leaked).

The client (`public/js/api.js`) reads the token stream and also transparently accepts a JSON `{ output }` body (used by error responses and test mocks).

---

## CI / quality baseline

`npm run ci` runs: `tsc --noEmit` typecheck → Vitest (TS unit tests) → `node --test` (frontend JS tests) → `.env.example` validation. GitHub Actions runs the same on every push/PR; `main` is protected with a required `quality-checks` status check, and every PR gets an automatic Vercel preview deployment.

```bash
npm install
npm run ci
```

Scripts:

- `npm run dev` — Vercel local dev server
- `npm run typecheck` — `tsc --noEmit`
- `npm run test` — Vitest (server/unit)
- `npm run test:js` — `node --test` (frontend modules)
- `npm run test:e2e` — Playwright
- `npm run eval` — eval harness (requires a configured provider)
- `npm run eval:baseline` — record current scores to `evals/baseline.json`
- `npm run eval:ci` — CI entrypoint (skips when secrets are missing)
- `npm run db:setup` / `npm run db:ingest` — pgvector schema + corpus ingestion

---

## Environment variables

See `.env.example`. Summary:

| Var | Purpose |
| --- | --- |
| `AI_BASE_URL` | OpenAI-compatible endpoint (Groq by default: `https://api.groq.com/openai/v1`) |
| `AI_API_KEY` | API key for the provider (or set `GROQ_API_KEY`) |
| `GROQ_API_KEY` | Optional alias read by `sync-vercel-env.mjs` when `AI_API_KEY` is unset |
| `AI_MODEL` / `AI_EMBEDDING_MODEL` | Chat + embedding model ids |
| `EMBEDDING_DIM` | Embedding dimension (must match the embedding model) |
| `FORCE_LOCAL_EMBEDDINGS` | `1` keeps 384-dim bag-of-words retrieval (required with Groq — no embedding API) |
| `DATABASE_URL` | Neon Postgres (pooled) for the pgvector corpus |
| `LANGFUSE_*` | Optional observability forwarding |

> Provider note: Groq has no embedding API, so production sets `FORCE_LOCAL_EMBEDDINGS=1` to keep RAG retrieval on the offline 384-dim corpus while chat streams from Groq. To switch providers, change `AI_BASE_URL` + `AI_API_KEY` + the model ids, then run `node scripts/sync-vercel-env.mjs`.

---

## Run locally

```bash
git clone https://github.com/alejosworkstuff/ai-stories.git
cd ai-stories
npm install
cp .env.example .env          # fill in GROQ_API_KEY (or AI_API_KEY) + DATABASE_URL
npm run db:setup && npm run db:ingest
npm run dev                   # http://localhost:3000
```

---

## Technologies

- TypeScript, Node.js (Vercel Functions)
- Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`)
- PostgreSQL + pgvector on Neon (`@neondatabase/serverless`)
- Zod (validation + typed outputs)
- Vitest + Playwright; GitHub Actions CI
- HTML + vanilla ES modules (client)

---

## Roadmap (next)

- Tailwind + shadcn on the UI (keyword parity).
- Persistent conversation memory keyed by session (Neon/Clerk).

## Commit conventions

See [CONTRIBUTING.md](./CONTRIBUTING.md).
