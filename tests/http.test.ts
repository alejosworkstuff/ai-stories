import { afterEach, describe, it, expect, vi } from "vitest";
import {
  fetchWithResilience,
  normalizeApiError,
} from "../public/js/http.js";

describe("http.js", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizeApiError maps 402 to CREDITS", () => {
    const err = normalizeApiError(402, { error: "No credits" });
    expect(err.code).toBe("CREDITS");
    expect(err.message).toMatch(/credits/i);
  });

  it("retries on 503 then returns response", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return { ok: false, status: 503, headers: { get: () => "" } };
        }
        return { ok: true, status: 200, headers: { get: () => "application/json" } };
      })
    );

    const res = await fetchWithResilience("/api/test", {
      maxRetries: 1,
      retryDelayMs: 0,
    });

    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("throws HttpError on timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
        })
      )
    );

    await expect(
      fetchWithResilience("/api/slow", { timeoutMs: 50, maxRetries: 0 })
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
