# AI Stories — Streaming RAG + Agentic Generation

[![local CI](https://img.shields.io/badge/local%20CI-passing-brightgreen?logo=github-actions&logoColor=white)](.github/workflows/ci.yml) [![Vercel](https://img.shields.io/badge/deployed-Vercel-black?logo=vercel&logoColor=white)](https://ai-stories-ashy.vercel.app/)

A collaborative AI story generator built as a **production-minded AI-engineering** portfolio piece. It streams tokens to the browser, grounds generation in a retrieved corpus (RAG over **pgvector**), runs an **agentic tool-calling loop** on the **Vercel AI SDK**, enforces **typed outputs** and **prompt-injection guardrails**, and ships with an **eval harness** and **observability**.

> Built on the Vercel AI SDK's OpenAI-compatible provider, so the LLM backend is swappable. By default it fronts **Replicate** (reusing `REPLICATE_API_TOKEN`) through an OpenAI-compatible gateway; point `AI_BASE_URL`/`AI_API_KEY` at OpenAI / Anthropic / Groq to switch.

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

## Architecture

```
Browser (stream reader)
  → POST /api/generate-stories            api/generate-stories.ts
      → rate limit + Zod validation + injection screen
      → createStoryStreamer()             lib/ai/agent.ts
          → streamText({ tools, stopWhen: stepCountIs(4) })
              → tool: searchCorpus        lib/rag/retrieve.ts
                  → embed query           lib/rag/embeddings.ts (AI SDK)
                  → similaritySearch      lib/rag/store.ts  (pgvector / Neon)
          → tokens streamed to response
          → onFinish → telemetry          lib/ai/observability.ts
```

### Key modules

| Area | File |
| --- | --- |
| Provider abstraction (swappable) | `lib/ai/provider.ts` |
| Streaming agent + tool calling | `lib/ai/agent.ts` |
| Structured (typed) generation | `lib/ai/story.ts` |
| Zod schemas (request + story) | `lib/ai/schema.ts` |
| System prompt + injection defense | `lib/ai/prompt.ts`, `lib/ai/guardrails.ts` |
| Telemetry / observability | `lib/ai/observability.ts` |
| RAG: chunk / embed / store / retrieve | `lib/rag/*.ts` |
| API handler (streaming + error contracts) | `api/generate-stories.ts` |
| Eval harness | `evals/{dataset,graders,run}.ts` |
| Client streaming + fallback | `public/js/{api,app,ui}.js` |

---

## RAG corpus

A small storytelling-craft corpus lives in `corpus/` (`narrative-structure.md`, `tone-and-voice.md`, `character-archetypes.md`). It is chunked (paragraph-aware, with overlap), embedded, and upserted into a pgvector `documents` table. At request time the `searchCorpus` tool retrieves the top-k passages to ground craft decisions; retrieved text is fenced as untrusted context so it cannot inject instructions. When corpus guidance shapes the output, the model is instructed to cite the source file (e.g. `[narrative-structure.md]`).

**Embeddings:** with `AI_BASE_URL` set, ingest/retrieval use the configured OpenAI-compatible embedding model. When `AI_BASE_URL` is unset, `npm run db:ingest` falls back to a local bag-of-words embedder (384 dims) so the RAG pipeline is runnable offline — swap to a real provider before production.

Set up and ingest:

```bash
npm run db:setup     # CREATE EXTENSION vector + documents table + HNSW index
npm run db:ingest    # chunk + embed + upsert corpus/*.md
```

---

## Evals

`npm run eval` runs the golden set in `evals/dataset.ts` through structured generation and scores each case with deterministic graders (`evals/graders.ts`): schema validity, minimum paragraphs, presence of choices, and no prompt leakage. It exits non-zero below `EVAL_THRESHOLD` (default `0.8`), so it can gate CI once a provider is configured. The graders themselves are unit-tested offline (`tests/graders.test.ts`) and run with no API key.

---

## Security & guardrails

- **Prompt-injection screening** (`lib/ai/guardrails.ts`) rejects obvious override attempts with `400 unsafe_request`.
- **Retrieved-content sanitization** strips injection-shaped lines from RAG passages before fencing them as untrusted context.
- **Output guardrails** validate structured stories against the Zod schema (with one repair retry) and screen streamed prose for prompt/tool leakage (`422 unsafe_output` before the first token).
- **Untrusted-content fencing** wraps retrieved passages so the model treats them as data, not instructions.
- **Rate limiting** — fixed-window per-IP (`lib/rate-limit.ts`), `X-RateLimit-Remaining` / `Retry-After`.
- **Security headers** via `vercel.json` (strict CSP `default-src 'self'`, HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP).
- **No secret leakage** — provider errors map to `402` (credits) or `500` (generic) with no stack traces in the body.

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
- `npm run db:setup` / `npm run db:ingest` — pgvector schema + corpus ingestion

---

## Environment variables

See `.env.example`. Summary:

| Var | Purpose |
| --- | --- |
| `AI_BASE_URL` | OpenAI-compatible endpoint (Replicate gateway by default) |
| `AI_API_KEY` | API key for the gateway/provider (defaults to `REPLICATE_API_TOKEN`) |
| `REPLICATE_API_TOKEN` | Existing Replicate token (used as `AI_API_KEY` default) |
| `AI_MODEL` / `AI_EMBEDDING_MODEL` | Chat + embedding model ids |
| `EMBEDDING_DIM` | Embedding dimension (must match the embedding model) |
| `DATABASE_URL` | Neon Postgres (pooled) for the pgvector corpus |
| `LANGFUSE_*` | Optional observability forwarding |

> Provider note: `@ai-sdk/replicate` only exposes image models, so text generation goes through the AI SDK's OpenAI-compatible provider. To keep Replicate as the backend, run a Replicate → OpenAI-compatible gateway and reuse your Replicate token; to switch providers, change `AI_BASE_URL` + `AI_API_KEY` + the model ids.

---

## Run locally

```bash
git clone https://github.com/alejosworkstuff/ai-stories.git
cd ai-stories
npm install
cp .env.example .env          # fill in AI_BASE_URL / AI_API_KEY / DATABASE_URL
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

- Tailwind + shadcn on the UI (keyword parity) and React Query for retrieval state.
- Persistent conversation memory keyed by session.
- LLM-as-judge eval grader alongside the deterministic ones.

## Commit conventions

See [CONTRIBUTING.md](./CONTRIBUTING.md).
