# IA Stories Generator

A minimal AI-powered story generator built with Node.js and Express, using the Llama 3 model via Replicate.

This project is designed as a **portfolio backend-focused application**, emphasizing clarity, decision-making, and robustness over feature count.

---

## What it does

The application allows the user to enter:

- a **seed** (keywords or concept),
- an optional **tone**,
- a desired **length**,

and generates a coherent short story using an AI language model.

The backend exposes a single API endpoint that handles:

- input validation,
- rate limiting,
- caching,
- AI generation,
- graceful fallback when credits are unavailable.

---

## Technologies used

- **Node.js + Express** — lightweight HTTP server
- **Replicate API (Llama 3)** — AI text generation
- **HTML + Vanilla JavaScript** — simple frontend for demo purposes
- **CORS + express-rate-limit** — basic API protection
- **In-memory cache** — avoids unnecessary AI calls

### Handling exhausted API credits (HTTP 402)

This project uses the Replicate API, which may return an HTTP 402 error when no credits are available.

This behavior is explicitly handled:

- The backend surfaces the error transparently.
- The frontend detects HTTP 402 responses.
- A clear, human-readable message is shown to the user explaining that the AI service is temporarily unavailable due to missing credits.

This ensures the application fails gracefully and predictably, without crashing or producing misleading output.

---

## How to run locally

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ia-stories.git
cd ia-stories
Install dependencies:

bash
Copiar código
npm install
Configure environment variables:

Copy .env.example to .env

Set your Replicate token:

env
Copiar código
REPLICATE_API_TOKEN=your_real_token
PORT=3000
NODE_ENV=development
Start the server:

bash
Copiar código
npm start
Open in your browser:

arduino
Copiar código
http://localhost:3000
Environment variables
REPLICATE_API_TOKEN → Replicate API token (required)

PORT → Server port (optional, defaults to 3000)

NODE_ENV → Environment mode (optional)

Technical decisions
In-memory cache
Stories are cached in memory using a simple Map.

Why?

This is a demo project.

It avoids repeated AI calls for identical inputs.

Keeps the architecture simple and readable.

Why no TTL or persistence?

To avoid introducing unnecessary complexity (Redis, DB).

TTL and eviction policies are intentionally left out as a future improvement.

Rate limiting
A strict rate limit is applied to the generation endpoint.

Why?

Protects the AI endpoint from abuse.

Prevents accidental credit exhaustion.

Demonstrates awareness of real-world API constraints.

Why?

The frontend does not break.

The behavior is explicit and documented.

Makes the demo usable even without paid credits.

Frontend simplicity
The frontend uses plain HTML and vanilla JavaScript.

Why?

The focus of this project is backend logic and API design.

Avoids framework overhead for a simple demo UI.

Trade-offs & limitations
No persistent storage (cache resets on server restart)

No authentication or user accounts

Single-process memory cache

Minimal frontend UI

These trade-offs are intentional to keep the project focused and readable.

Possible future improvements
Redis or database-backed cache with TTL

Model selector (cost vs quality)

Text type selector (story, poem, micro-fiction)

Authentication and per-user rate limits

Streaming AI responses

Improved frontend UX

Project status
This project is considered complete for portfolio purposes, showcasing:

clear API design

defensive backend programming

explicit technical decisions

realistic handling of third-party AI limitations
