import { fetchWithResilience } from "./http.js";

/**
 * Streams a story from the API. Reads the token stream (text/plain) when the
 * server streams, and transparently falls back to a JSON `{ output }` body
 * (used by error responses and test mocks).
 *
 * @returns {Promise<{ res: Response, data: object|null, text: string }>}
 */
export async function streamStory(payload, { signal, onToken } = {}) {
  const res = await fetchWithResilience("/api/generate-stories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
    maxRetries: 0,
  });

  const contentType = res.headers.get("content-type") || "";

  // Error responses (and JSON mocks) carry a JSON body.
  if (!res.ok || contentType.includes("application/json")) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const text = String(data?.output ?? "");
    if (text && onToken) onToken(text);
    return { res, data, text };
  }

  // Streamed text response.
  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;
      text += chunk;
      if (onToken) onToken(chunk);
    }
    return { res, data: null, text };
  }

  // Environments without a readable stream (older mocks): read as one body.
  const text = await res.text();
  if (text && onToken) onToken(text);
  return { res, data: null, text };
}
