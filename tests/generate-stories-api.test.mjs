import assert from "node:assert";
import { describe, it } from "node:test";
import {
  buildPrompt,
  createHandler,
  getLengthSettings,
  isReplicateCreditsError,
} from "../api/generate-stories.js";

function createMockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("generate-stories API helpers", () => {
  it("returns default short settings when length is unknown", () => {
    assert.deepStrictEqual(getLengthSettings("unknown"), { maxTokens: 300, paragraphs: 3 });
  });

  it("builds prompt including tone and conversation", () => {
    const prompt = buildPrompt(
      [{ role: "user", content: "A dragon wakes up in winter." }],
      "epic",
      5
    );

    assert.ok(prompt.includes("Tone: epic"));
    assert.ok(prompt.includes("user: A dragon wakes up in winter."));
    assert.ok(prompt.includes("5 paragraphs."));
  });

  it("detects credit-related errors", () => {
    assert.equal(isReplicateCreditsError(new Error("HTTP 402 Payment Required")), true);
    assert.equal(isReplicateCreditsError(new Error("Insufficient credits remaining")), true);
    assert.equal(isReplicateCreditsError(new Error("network timeout")), false);
  });
});

describe("generate-stories API handler", () => {
  it("returns 405 for non-POST methods", async () => {
    const handler = createHandler({ run: async () => "should not execute" });
    const req = { method: "GET", body: {} };
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 405);
    assert.deepStrictEqual(res.body, { error: "method_not_allowed" });
  });

  it("returns 400 when messages are missing", async () => {
    const handler = createHandler({ run: async () => "should not execute" });
    const req = { method: "POST", body: { tone: "neutral", length: "short" } };
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.deepStrictEqual(res.body, { error: "messages_required" });
  });

  it("returns 200 with generated output on happy path", async () => {
    const fakeReplicate = {
      async run(model, payload) {
        assert.equal(model, "meta/meta-llama-3-8b-instruct");
        assert.equal(payload.input.max_new_tokens, 600);
        return ["Once ", "upon ", "a time"];
      },
    };
    const handler = createHandler(fakeReplicate);
    const req = {
      method: "POST",
      body: {
        messages: [{ role: "user", content: "A robot learns to paint." }],
        tone: "hopeful",
        length: "medium",
      },
    };
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepStrictEqual(res.body, { output: "Once upon a time" });
  });

  it("returns 402 when provider reports credit exhaustion", async () => {
    const fakeReplicate = {
      async run() {
        throw new Error("402 payment required: credits exhausted");
      },
    };
    const handler = createHandler(fakeReplicate);
    const req = {
      method: "POST",
      body: { messages: [{ role: "user", content: "seed" }] },
    };
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 402);
    assert.equal(res.body.error, "replicate_no_credits");
  });

  it("returns 500 for non-credit provider errors", async () => {
    const fakeReplicate = {
      async run() {
        throw new Error("upstream timeout");
      },
    };
    const handler = createHandler(fakeReplicate);
    const req = {
      method: "POST",
      body: { messages: [{ role: "user", content: "seed" }] },
    };
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, "replicate_failed");
  });
});
