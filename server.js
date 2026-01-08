require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Replicate = require("replicate");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  "/api/generate-story",
  rateLimit({
    windowMs: 10 * 1000,
    max: 6,
  })
);

/* =========================
   REPLICATE SETUP
========================= */
if (!process.env.REPLICATE_API_TOKEN) {
  console.error("❌ REPLICATE_API_TOKEN missing");
  process.exit(1);
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

/* =========================
   CACHE
========================= */
/**
 * Simple in-memory cache.
 *
 * - Stored in memory using Map for simplicity and speed.
 * - No TTL or eviction policy is implemented on purpose:
 *   this project is a demo / portfolio piece, not a production system.
 * - In a real-world scenario, this would likely be replaced by
 *   Redis or another external cache with TTL and size limits.
 */

const cache = new Map();

/* =========================
   PROMPT BUILDER
========================= */
/**
 * Builds the story prompt sent to the LLM.
 *
 * @param {Object} params
 * @param {string} params.seed - Mandatory seed text
 * @param {string} [params.tone] - Optional tone / genre
 * @param {string} params.length - short | medium | long
 * @param {Object} params.settings - length-based configuration
 */
function buildPrompt({ seed, tone, length, settings }) {
  return `
Write a ${length} story.
Tone: ${tone || "neutral"}
Seed elements: ${seed}

Structure:
- ${settings.paragraphs} paragraphs
- Clear protagonist and goal
- Narrative arc (intro → conflict → climax → resolution)
- Emotional or meaningful ending

Return ONLY the story text.
`.trim();
}

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

/* =========================
   API ROUTE
========================= */
app.post("/api/generate-story", async (req, res) => {
  try {
    // `tone` is optional: if not provided, a neutral tone is used by default
    const { seed, tone = "neutral", length = "short" } = req.body;

    if (!seed || !seed.trim()) {
      return res.status(400).json({ error: "seed_required" });
    }

    const lengthSettings = {
      short: { maxTokens: 300, paragraphs: 3 },
      medium: { maxTokens: 600, paragraphs: 5 },
      long: { maxTokens: 900, paragraphs: 7 },
    };

    const settings = lengthSettings[length] || lengthSettings.short;

    const cacheKey = JSON.stringify({ seed, tone, length });
    if (cache.has(cacheKey)) {
      return res.json({ output: cache.get(cacheKey), cached: true });
    }

    const prompt = buildPrompt({
      seed,
      tone,
      length,
      settings,
    });

    const output = await replicate.run(
      "meta/meta-llama-3-8b-instruct",
      {
        input: {
          prompt,
          max_new_tokens: settings.maxTokens,
          temperature: 0.75,
          top_p: 0.9,
        },
      }
    );

    const story = Array.isArray(output) ? output.join("") : output;

    cache.set(cacheKey, story);

    res.json({ output: story, cached: false });
  } catch (err) {
    console.error("🔥 Replicate error:", err);

    res.status(500).json({
      error: "replicate_failed",
      details: err.message,
    });
  }
});

/* =========================
   SERVER
========================= */
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
