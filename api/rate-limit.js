const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 10;

export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const store = options.store ?? new Map();

  function getClientIp(req) {
    const forwarded = req.headers?.["x-forwarded-for"];
    if (forwarded) {
      return String(forwarded).split(",")[0].trim();
    }
    return req.headers?.["x-real-ip"] ?? req.socket?.remoteAddress ?? "unknown";
  }

  function checkKey(key) {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1, retryAfterSec: 0 };
    }

    if (entry.count >= maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    entry.count += 1;
    return { allowed: true, remaining: maxRequests - entry.count, retryAfterSec: 0 };
  }

  return {
    getClientIp,
    check(req) {
      return checkKey(getClientIp(req));
    },
    checkKey,
  };
}
