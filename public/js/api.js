import { fetchWithResilience } from "./http.js";

export async function streamStory(payload, { signal, onToken } = {}) {
  const res = await fetchWithResilience("/api/generate-stories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
    maxRetries: 0,
  });

  const contentType = res.headers.get("content-type") || "";

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

  const text = await res.text();
  if (text && onToken) onToken(text);
  return { res, data: null, text };
}
