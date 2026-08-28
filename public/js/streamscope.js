const PHASE_LABELS = {
  connecting: "connecting",
  open: "open",
  closed: "closed",
  error: "error",
};

export function initStreamScope({ toggleButton, panel, status, eventLog }) {
  let isOpen = false;

  const setOpen = (nextOpen) => {
    isOpen = nextOpen;
    panel.classList.toggle("hidden", !isOpen);
    toggleButton.setAttribute("aria-expanded", String(isOpen));
    toggleButton.setAttribute("aria-label", isOpen ? "Close stream debugger" : "Open stream debugger");
  };

  const setPhase = (phase) => {
    status.textContent = PHASE_LABELS[phase] || phase;
    status.dataset.phase = phase;
  };

  const recordDiagnostic = (diagnostic) => {
    if (!isOpen) return;
    if (diagnostic.type === "phase") {
      setPhase(diagnostic.phase);
    } else if (diagnostic.type === "complete") {
      setPhase(diagnostic.validation?.valid ? "closed" : "error");
      const item = document.createElement("li");
      item.textContent = `complete: ${diagnostic.chunks} chunks, ${diagnostic.bytes} bytes`;
      eventLog.append(item);
    } else if (diagnostic.type === "chunk") {
      setPhase("open");
      const item = document.createElement("li");
      item.textContent = `chunk: ${diagnostic.chunkLength} chars at ${Math.round(diagnostic.lastChunkMs)}ms`;
      eventLog.append(item);
    }
    eventLog.scrollTop = eventLog.scrollHeight;
  };

  toggleButton.addEventListener("click", () => setOpen(!isOpen));
  setPhase("closed");
  return { recordDiagnostic, setPhase, clear: () => eventLog.replaceChildren() };
}
