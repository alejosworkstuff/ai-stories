const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 10;

export interface MinimalRequest {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  store?: Map<string, Entry>;
}

export interface RateLimiter {
  getClientIp(req: MinimalRequest): string;
  check(req: MinimalRequest): RateLimitResult;
  checkKey(key: string): RateLimitResult;
}

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const store = options.store ?? new Map<string, Entry>();

  function getClientIp(req: MinimalRequest): string {
    const forwarded = req.headers?.["x-forwarded-for"];
    if (forwarded) {
      return String(forwarded).split(",")[0]!.trim();
    }
    const realIp = req.headers?.["x-real-ip"];
    if (realIp) return String(realIp);
    return req.socket?.remoteAddress ?? "unknown";
  }

  function checkKey(key: string): RateLimitResult {
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
    check(req: MinimalRequest): RateLimitResult {
      return checkKey(getClientIp(req));
    },
    checkKey,
  };
}
