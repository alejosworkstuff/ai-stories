import assert from "node:assert";
import { describe, it } from "node:test";
import { createRateLimiter } from "../api/rate-limit.js";
import {
  ALLOWED_LENGTHS,
  MAX_MESSAGE_CONTENT_LENGTH,
  validateGenerateRequest,
} from "../api/validate.js";
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
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
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

describe("validateGenerateRequest", () => {
  it("accepts valid payloads", () => {
    assert.equal(
      validateGenerateRequest({
        messages: [{ role: "user", content: "A dragon wakes up." }],
        tone: "romantic cyberpunk",
        length: "medium",
      }),
      null
    );
  });

  it("rejects unknown length values", () => {
    assert.deepStrictEqual(
      validateGenerateRequest({
        messages: [{ role: "user", content: "seed" }],
        length: "huge",
      }),
      { error: "invalid_length" }
    );
  });

  it("rejects oversized message content", () => {
    assert.deepStrictEqual(
      validateGenerateRequest({
        messages: [{ role: "user", content: "x".repeat(MAX_MESSAGE_CONTENT_LENGTH + 1) }],
      }),
      { error: "message_too_long" }
    );
  });

  it("rejects empty tone strings", () => {
    assert.deepStrictEqual(
      validateGenerateRequest({
        messages: [{ role: "user", content: "seed" }],
        tone: "   ",
      }),
      { error: "invalid_tone" }
    );
  });
});

describe("createRateLimiter", () => {
  it("blocks requests after the configured limit", () => {
    const store = new Map();
    const limiter = createRateLimiter({
      store,
      maxRequests: 2,
      windowMs: 60_000,
    });

    assert.equal(limiter.checkKey("1.2.3.4").allowed, true);
    assert.equal(limiter.checkKey("1.2.3.4").allowed, true);
    assert.equal(limiter.checkKey("1.2.3.4").allowed, false);
    assert.equal(limiter.checkKey("5.6.7.8").allowed, true);
  });
});

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
    const req = { method: "GET", body: {}, headers: {} };
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 405);
    assert.deepStrictEqual(res.body, { error: "method_not_allowed" });
  });

  it("returns 400 when messages are missing", async () => {
    const handler = createHandler({ run: async () => "should not execute" });
    const req = { method: "POST", body: { tone: "neutral", length: "short" }, headers: {} };
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.deepStrictEqual(res.body, { error: "messages_required" });
  });

  it("returns 400 for invalid length", async () => {
    const handler = createHandler({ run: async () => "should not execute" });
    const req = {
      method: "POST",
      body: {
        messages: [{ role: "user", content: "seed" }],
        length: "extra-large",
      },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, "invalid_length");
    assert.ok(ALLOWED_LENGTHS.has("short"));
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const store = new Map();
    const rateLimiter = createRateLimiter({ store, maxRequests: 1, windowMs: 60_000 });
    const handler = createHandler(
      { run: async () => "blocked" },
      { rateLimiter }
    );
    const req = {
      method: "POST",
      body: { messages: [{ role: "user", content: "seed" }] },
      headers: { "x-forwarded-for": "9.9.9.9" },
    };

    const first = createMockRes();
    await handler(req, first);
    assert.equal(first.statusCode, 200);

    const second = createMockRes();
    await handler(req, second);
    assert.equal(second.statusCode, 429);
    assert.deepStrictEqual(second.body, { error: "rate_limit_exceeded" });
    assert.equal(second.headers["Retry-After"], "60");
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
      headers: {},
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
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 402);
    assert.deepStrictEqual(res.body, { error: "replicate_no_credits" });
    assert.equal(res.body.details, undefined);
  });

  it("returns 500 for non-credit provider errors without leaking details", async () => {
    const fakeReplicate = {
      async run() {
        throw new Error("upstream timeout with secret stack trace");
      },
    };
    const handler = createHandler(fakeReplicate);
    const req = {
      method: "POST",
      body: { messages: [{ role: "user", content: "seed" }] },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 500);
    assert.deepStrictEqual(res.body, { error: "replicate_failed" });
  });
});
