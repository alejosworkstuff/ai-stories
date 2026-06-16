import Replicate from "replicate";
import { createRateLimiter } from "./rate-limit.js";
import { validateGenerateRequest } from "./validate.js";

const lengthSettings = {
  short: { maxTokens: 300, paragraphs: 3 },
  medium: { maxTokens: 600, paragraphs: 5 },
  long: { maxTokens: 900, paragraphs: 7 },
};

export function getLengthSettings(length) {
  return lengthSettings[length] || lengthSettings.short;
}

export function buildPrompt(messages, tone, paragraphs) {
  const conversation = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

  return `
Continue the following story.

Tone: ${tone}

Conversation:
${conversation}

Write the next part of the story.
${paragraphs} paragraphs.

Return ONLY the story text.
`.trim();
}

export function isReplicateCreditsError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("402") ||
    msg.includes("payment required") ||
    msg.includes("insufficient") ||
    msg.includes("credit")
  );
}

export function createHandler(replicateClient, options = {}) {
  const rateLimiter = options.rateLimiter ?? createRateLimiter();

  return async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "method_not_allowed" });
    }

    const rateLimit = rateLimiter.check(req);
    res.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
    if (!rateLimit.allowed) {
      res.setHeader("Retry-After", String(rateLimit.retryAfterSec));
      return res.status(429).json({ error: "rate_limit_exceeded" });
    }

    const validationError = validateGenerateRequest(req.body);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const { messages, tone = "neutral", length = "short" } = req.body;
    const settings = getLengthSettings(length);
    const prompt = buildPrompt(messages, tone, settings.paragraphs);

    try {
      const output = await replicateClient.run("meta/meta-llama-3-8b-instruct", {
        input: {
          prompt,
          max_new_tokens: settings.maxTokens,
          temperature: 0.75,
        },
      });

      const story = Array.isArray(output) ? output.join("") : output;
      return res.status(200).json({ output: story });
    } catch (err) {
      if (isReplicateCreditsError(err)) {
        return res.status(402).json({ error: "replicate_no_credits" });
      }

      console.error("replicate_failed", err);
      return res.status(500).json({ error: "replicate_failed" });
    }
  };
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default createHandler(replicate);
