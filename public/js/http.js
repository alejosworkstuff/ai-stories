const RETRYABLE_STATUSES = new Set([429, 502, 503]);

export class HttpError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "HttpError";
    this.status = options.status;
    this.code = options.code ?? "HTTP";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeApiError(status, body = {}) {
  if (status === 402) {
    return {
      code: "CREDITS",
      message: body.error ?? "Provider credits exhausted",
    };
  }
  if (status === 400) {
    return { code: "VALIDATION", message: body.error ?? "Invalid request" };
  }
  if (status === 429) {
    return { code: "RATE_LIMIT", message: body.error ?? "Too many requests" };
  }
  if (status >= 500) {
    return { code: "SERVER", message: body.error ?? "Server error" };
  }
  return { code: "HTTP", message: body.error ?? `Request failed (${status})` };
}

export async function fetchWithResilience(url, options = {}) {
  const {
    timeoutMs = 8_000,
    maxRetries = 2,
    retryDelayMs = 300,
    signal: externalSignal,
    ...init
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (externalSignal) {
      externalSignal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
        await sleep(2 ** attempt * retryDelayMs);
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError =
        error?.name === "AbortError"
          ? new HttpError("Request timed out", { code: "TIMEOUT" })
          : error;

      if (attempt < maxRetries) {
        await sleep(2 ** attempt * retryDelayMs);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new HttpError("Request failed after retries");
}
