import Replicate from "replicate";

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

export function createHandler(replicateClient) {
  return async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "method_not_allowed" });
    }

    const { messages, tone = "neutral", length = "short" } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages_required" });
    }

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
        return res.status(402).json({
          error: "replicate_no_credits",
          details: err.message,
        });
      }

      return res.status(500).json({
        error: "replicate_failed",
        details: err.message,
      });
    }
  };
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default createHandler(replicate);
