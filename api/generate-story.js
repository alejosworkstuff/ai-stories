import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { messages, tone = "neutral", length = "short" } = req.body || {};

  if (!messages || !messages.length()) {
    return res.status(400).json({ error: "messages_required" });
  }

  const lengthSettings = {
    short: { maxTokens: 300, paragraphs: 3 },
    medium: { maxTokens: 600, paragraphs: 5 },
    long: { maxTokens: 900, paragraphs: 7 },
  };

  const settings = lengthSettings[length] || lengthSettings.short;

const conversation = messages
  .map(m => `${m.role}: ${m.content}`)
  .join("\n");

const prompt = `
Continue the following story.

Tone: ${tone}

Conversation:
${conversation}

Write the next part of the story.
${settings.paragraphs} paragraphs.

Return ONLY the story text.
`.trim();

  try {
    const output = await replicate.run(
      "meta/meta-llama-3-8b-instruct",
      {
        input: {
          prompt,
          max_new_tokens: settings.maxTokens,
          temperature: 0.75,
        },
      }
    );

    const story = Array.isArray(output) ? output.join("") : output;
    return res.status(200).json({ output: story });
  } catch (err) {
    const msg = String(err?.message || "").toLowerCase();
    const is402 =
      msg.includes("402") ||
      msg.includes("payment required") ||
      msg.includes("insufficient") ||
      msg.includes("credit");

    if (is402) {
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
}
