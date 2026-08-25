import { fetchWithResilience } from "./http.js";

export function validateStreamOutput(text) {
  const value = String(text ?? "");
  const hasUnexpectedControlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
  return {
    valid: value.trim().length > 0 && !hasUnexpectedControlChars,
    reason: value.trim().length === 0 ? "empty" : hasUnexpectedControlChars ? "control_chars" : null,
  };
}

function parseSseBlock(block) {
  let event = "message";
  let data = "";
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data += `${line.slice(5).trim()}\n`;
  }
  if (!data) return null;
  try {
    return { event, payload: JSON.parse(data.trim()) };
  } catch {
    return { event: "error", payload: { type: "error", code: "malformed_event" } };
  }
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
    let sseBuffer = "";
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
        sseBuffer += chunk;
        const blocks = sseBuffer.split(/\r?\n\r?\n/);
        sseBuffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const parsed = parseSseBlock(block);
          if (!parsed) continue;
          if (parsed.payload?.type === "token") {
            text += parsed.payload.text;
            onToken?.(parsed.payload.text);
          } else if (parsed.payload?.type === "error") {
            streamError = parsed.payload.code;
          }
        }
      } else {
        text += chunk;
        onToken?.(chunk);
      }
    }
    if (sseBuffer && contentType.includes("text/event-stream")) {
      const parsed = parseSseBlock(sseBuffer);
      if (parsed?.payload?.type === "token") text += parsed.payload.text;
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
