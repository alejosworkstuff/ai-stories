# IA Stories Generator

A minimal AI-powered story generator built for Vercel Serverless Functions, using the Llama 3 model via Replicate.

This project is designed as a **portfolio backend-focused application**, emphasizing clarity, decision-making, and robustness over feature count.

---

## What it does

The application allows the user to enter:

- a **seed** (keywords or concept),
- an optional **tone**,
- a desired **length**,

and generates a coherent short story using an AI language model.

The backend exposes a single API route that handles:

- input validation,
- AI generation,
- graceful fallback when credits are unavailable.

---

## Technologies used

- **Vercel Serverless Functions** — API route in `api/`
- **Replicate API (Llama 3)** — AI text generation
- **HTML + Vanilla JavaScript** — simple frontend for demo purposes

---

## Handling exhausted API credits (HTTP 402)

This project uses the Replicate API, which may return an HTTP 402 error when no credits are available.

This behavior is explicitly handled:

- The backend returns HTTP 402 with a clear error code.
- The frontend detects HTTP 402 responses.
- A human-readable message explains that the AI service is temporarily unavailable due to missing credits.

This ensures the application fails gracefully and predictably, without crashing or producing misleading output.

---

## How to run locally

1. Clone the repository:

```bash
git clone https://github.com/alejosworkstuff/ai-stories.git
cd ai-stories
```

1. Install dependencies:

```bash
npm install
```

1. Set environment variables:

Copy `.env.example` to `.env` and set your Replicate token:

```env
REPLICATE_API_TOKEN=your_real_token
```

1. Run the Vercel dev server:

```bash
vercel dev
```

1. Open in your browser:

```txt
http://localhost:3000
```

---

## Deploy checklist (Vercel)

- `REPLICATE_API_TOKEN` added in Vercel project Environment Variables
- `npm install` succeeds locally
- `vercel dev` works locally
- `/api/generate-story` returns `200` for a valid request
- `/api/generate-story` returns `402` when credits are missing

---

## Environment variables

- `REPLICATE_API_TOKEN` → Replicate API token (required)

---

## Technical decisions

### Graceful error handling

When Replicate credits are unavailable, the app returns a clear, predictable error response.

#### Why graceful error handling?

- The frontend does not break.
- The behavior is explicit and documented.
- It keeps the demo usable even without paid credits.

### Frontend simplicity

The frontend uses plain HTML and vanilla JavaScript.

#### Why frontend simplicity?

- The focus of this project is backend logic and API design.
- Avoids framework overhead for a simple demo UI.

---

## Trade-offs & limitations

- No persistent storage
- No authentication or user accounts
- Minimal frontend UI

These trade-offs are intentional to keep the project focused and readable.

---

## Possible future improvements

- Add caching with TTL (Redis or database)
- Model selector (cost vs quality)
- Text type selector (story, poem, micro-fiction)
- Authentication and per-user rate limits
- Streaming AI responses
- Improved frontend UX

---

## Project status

This project is considered complete for portfolio purposes, showcasing:

- clear API design
- defensive backend programming
- explicit technical decisions
- realistic handling of third-party AI limitations
