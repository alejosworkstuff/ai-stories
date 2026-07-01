import { describe, it, expect } from "vitest";
import { createRateLimiter } from "../lib/rate-limit";

describe("createRateLimiter", () => {
  it("blocks requests after the configured limit", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });
    expect(limiter.checkKey("1.2.3.4").allowed).toBe(true);
    expect(limiter.checkKey("1.2.3.4").allowed).toBe(true);
    expect(limiter.checkKey("1.2.3.4").allowed).toBe(false);
    expect(limiter.checkKey("5.6.7.8").allowed).toBe(true);
  });

  it("reports remaining and retryAfter", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    const first = limiter.checkKey("9.9.9.9");
    expect(first.remaining).toBe(0);
    const blocked = limiter.checkKey("9.9.9.9");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("derives client ip from x-forwarded-for", () => {
    const limiter = createRateLimiter();
    const ip = limiter.getClientIp({ headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18" } });
    expect(ip).toBe("203.0.113.5");
  });
});
