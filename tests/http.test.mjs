import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  fetchWithResilience,
  HttpError,
  normalizeApiError,
} from "../public/js/http.js";

describe("http.js", () => {
  afterEach(() => {
    delete global.fetch;
  });

  it("normalizeApiError maps 402 to CREDITS", () => {
    const err = normalizeApiError(402, { error: "No credits" });
    assert.equal(err.code, "CREDITS");
    assert.match(err.message, /credits/i);
  });

  it("retries on 503 then returns response", async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 503, headers: { get: () => "" } };
      }
      return { ok: true, status: 200, headers: { get: () => "application/json" } };
    };

    const res = await fetchWithResilience("/api/test", {
      maxRetries: 1,
      retryDelayMs: 0,
    });

    assert.equal(res.status, 200);
    assert.equal(calls, 2);
  });

  it("throws HttpError on timeout", async () => {
    global.fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });

    await assert.rejects(
      fetchWithResilience("/api/slow", { timeoutMs: 50, maxRetries: 0 }),
      (err) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.code, "TIMEOUT");
        return true;
      }
    );
  });
});
