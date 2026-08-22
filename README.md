# AI Stories: Streaming RAG + Agentic Generation

[![local CI](https://img.shields.io/badge/local%20CI-passing-brightgreen?logo=github-actions&logoColor=white)](.github/workflows/ci.yml) [![Vercel](https://img.shields.io/badge/deployed-Vercel-black?logo=vercel&logoColor=white)](https://ai-stories-ashy.vercel.app/)

A story generator you can collaborate with in the browser. Generation is grounded in a craft corpus (RAG), streams token by token, and is checked by typed schemas, guardrails, and an eval harness.

**Live:** [ai-stories-ashy.vercel.app](https://ai-stories-ashy.vercel.app/)

Built for an **AI-engineering** portfolio demo: Vercel AI SDK, Neon pgvector, Zod, prompt-injection defenses, and CI-gated evals. Chat default in production: **Groq** (`openai/gpt-oss-120b`); the OpenAI-compatible layer can point at other providers via env.

Architecture (RAG pipeline, eval methodology, three-zone safety): **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**

## Screenshots

| Main form | Fallback mode | Dark mode |
| --- | --- | --- |
| ![Main form](./docs/screenshots/main.webp) | ![Fallback mode](./docs/screenshots/fallback.webp) | ![Dark mode](./docs/screenshots/dark.webp) |

## What this demonstrates

- **Vercel AI SDK**: `streamText`, `generateObject`, embeddings helpers, `tool`, bounded steps
- **Streaming UX**: tokens render as they arrive (vanilla ES module client)
- **RAG over Neon pgvector**: craft corpus chunked, embedded, retrieved by cosine similarity
- **Agentic tool calling**: model calls `searchCorpus` inside a bounded multi-step loop
- **Typed outputs**: Zod `storySchema` for structured generation and eval graders
- **Guardrails**: input screening, retrieved context fenced as untrusted, rate limiting, CSP
- **Eval harness**: golden set + deterministic graders (schema, structure, prompt-leak resistance)
- **Observability**: per-generation telemetry (model, latency, tokens, steps, tool calls); optional Langfuse
- **Fallback**: provider/credit errors degrade to a deterministic local generator
- **TypeScript** on the server, Vitest + Playwright, GitHub Actions CI

## Run locally

```bash
git clone https://github.com/alejosworkstuff/ai-stories.git
cd ai-stories
npm install
cp .env.example .env
# set GROQ_API_KEY (or AI_API_KEY) + DATABASE_URL
npm run db:setup && npm run db:ingest
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run ci          # typecheck + unit tests + env example checks
npm run test:e2e    # Playwright
npm run eval        # eval harness (needs a configured provider)
```

## Environment

See [`.env.example`](./.env.example). Main vars:

| Var | Purpose |
| --- | --- |
| `AI_BASE_URL` / `AI_API_KEY` | OpenAI-compatible chat endpoint (Groq by default) |
| `AI_MODEL` | Chat model id |
| `FORCE_LOCAL_EMBEDDINGS` | `1` keeps 384-dim local retrieval (Groq has no embedding API) |
| `DATABASE_URL` | Neon Postgres for the pgvector corpus |
| `LANGFUSE_*` | Optional observability |

## Stack

- TypeScript, Node.js (Vercel Functions)
- Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`)
- PostgreSQL + pgvector on Neon
- Zod, Vitest, Playwright, GitHub Actions
- HTML + vanilla ES modules + Tailwind CSS

`POST /api/generate-stories` streams story prose (`text/plain`). Request shape and safety model: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
