import { fetchWithResilience } from "./http.js";
import { hasUnexpectedControlChars } from "./stream-debugger/control-chars.js";
import { SseParser } from "./stream-debugger/parser.js";

export function validateStreamOutput(text) {
  const value = String(text ?? "");
  const containsUnexpectedControlChars = hasUnexpectedControlChars(value);
  return {
    valid: value.trim().length > 0 && !containsUnexpectedControlChars,
    reason: value.trim().length === 0 ? "empty" : containsUnexpectedControlChars ? "control_chars" : null,
  };
}

export async function streamStory(payload, { signal, onToken, onDiagnostic } = {}) {
  const diagnostics = {
    startedAt: performance.now(),
    firstChunkMs: null,
    lastChunkMs: null,
    chunks: 0,
    bytes: 0,
  };

  const observeChunk = (chunk) => {
    const now = performance.now();
    diagnostics.chunks += 1;
    diagnostics.bytes += new TextEncoder().encode(chunk).byteLength;
    if (diagnostics.firstChunkMs === null) diagnostics.firstChunkMs = now - diagnostics.startedAt;
    diagnostics.lastChunkMs = now - diagnostics.startedAt;
    onDiagnostic?.({ type: "chunk", ...diagnostics, chunkLength: chunk.length });
  };

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
    if (text) {
      observeChunk(text);
      onToken?.(text);
    }
    return { res, data, text, diagnostics, validation: validateStreamOutput(text) };
  }

  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    const sseParser = contentType.includes("text/event-stream") ? new SseParser() : null;
    let sawSse = false;
    let streamError = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;
      observeChunk(chunk);
      if (contentType.includes("text/event-stream")) {
        sawSse = true;
        for (const event of sseParser.feed(chunk)) {
          if (!event.data) continue;
          let parsed;
          try {
            parsed = JSON.parse(event.data);
          } catch {
            streamError = "malformed_event";
            continue;
          }
          if (parsed?.type === "token") {
            text += parsed.text;
            onToken?.(parsed.text);
          } else if (parsed?.type === "error") {
            streamError = parsed.code;
          }
        }
      } else {
        text += chunk;
        onToken?.(chunk);
      }
    }
    if (sseParser) {
      for (const event of sseParser.flush()) {
        if (!event.data) continue;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.type === "token") {
            text += parsed.text;
            onToken?.(parsed.text);
          } else if (parsed?.type === "error") {
            streamError = parsed.code;
          }
        } catch {
          streamError = "malformed_event";
        }
      }
    }
    const validation = validateStreamOutput(text);
    if (sawSse && streamError) {
      validation.valid = false;
      validation.reason = streamError;
    }
    onDiagnostic?.({ type: "complete", ...diagnostics, validation });
    return { res, data: null, text, diagnostics, validation };
  }

  const text = await res.text();
  if (text) {
    observeChunk(text);
    onToken?.(text);
  }
  return { res, data: null, text, diagnostics, validation: validateStreamOutput(text) };
}
