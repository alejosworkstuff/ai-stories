import { SseParser } from "./stream-debugger/parser.js";

const DEMO_STREAM_URL = "/api/demo-stream";

export async function streamDemo({ signal, onEvent, onPhase } = {}) {
  onPhase?.("connecting");
  const response = await fetch(DEMO_STREAM_URL, { signal });
  if (!response.ok) {
    onPhase?.("error");
    throw new Error(`Demo stream failed (${response.status})`);
  }
  if (!response.body) {
    onPhase?.("error");
    throw new Error("Demo stream returned no body");
  }

  onPhase?.("open");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();

  const consume = (event) => {
    if (!event.data) return;
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      onPhase?.("error");
      throw new Error("Demo stream returned malformed JSON");
    }
    if (payload.type === "token" && typeof payload.text === "string") {
      onEvent?.(payload);
    } else if (payload.type === "done") {
      onEvent?.(payload);
    } else if (payload.type === "error") {
      onPhase?.("error");
      throw new Error(payload.code || "Demo stream error");
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const event of parser.feed(chunk)) consume(event);
    }
    const trailingChunk = decoder.decode();
    if (trailingChunk) {
      for (const event of parser.feed(trailingChunk)) consume(event);
    }
    for (const event of parser.flush()) consume(event);
    onPhase?.("closed");
  } catch (error) {
    if (error?.name === "AbortError") {
      onPhase?.("closed");
    } else {
      onPhase?.("error");
      throw error;
    }
  } finally {
    reader.releaseLock();
  }
}

export function initStreamScope({ startButton, stopButton, status, eventLog }) {
  let controller = null;

  const setPhase = (phase) => {
    status.textContent = phase;
    status.dataset.phase = phase;
  };

  const appendEvent = (event) => {
    const item = document.createElement("li");
    item.textContent = event.type === "token" ? `token: ${event.text}` : "done";
    eventLog.append(item);
    eventLog.scrollTop = eventLog.scrollHeight;
  };

  const stop = () => {
    controller?.abort();
    controller = null;
    stopButton.disabled = true;
    startButton.disabled = false;
  };

  const start = async () => {
    stop();
    eventLog.replaceChildren();
    const nextController = new AbortController();
    controller = nextController;
    startButton.disabled = true;
    stopButton.disabled = false;
    try {
      await streamDemo({
        signal: nextController.signal,
        onPhase: setPhase,
        onEvent: appendEvent,
      });
    } catch (error) {
      if (error?.name !== "AbortError") {
        const item = document.createElement("li");
        item.className = "text-red-600";
        item.textContent = error instanceof Error ? error.message : "Demo stream error";
        eventLog.append(item);
      }
    } finally {
      if (controller === nextController) {
        controller = null;
        startButton.disabled = false;
        stopButton.disabled = true;
      }
    }
  };

  startButton.addEventListener("click", start);
  stopButton.addEventListener("click", stop);
  setPhase("closed");
  stopButton.disabled = true;
}
