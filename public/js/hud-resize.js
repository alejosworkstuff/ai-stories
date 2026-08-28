const STORAGE_KEY = "storyHudSize";
const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;

export function initHudResize(hud, handle) {
  if (!hud || !handle) return;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Number.isFinite(saved.width) && Number.isFinite(saved.height)) {
      hud.style.width = `${saved.width}px`;
      hud.style.height = `${saved.height}px`;
      hud.style.flex = "0 1 auto";
    }
  } catch {
    // Ignore malformed optional UI preferences.
  }

  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = hud.getBoundingClientRect().width;
    const startHeight = hud.getBoundingClientRect().height;
    hud.style.flex = "0 1 auto";

    const move = (moveEvent) => {
      const width = Math.max(MIN_WIDTH, startWidth + moveEvent.clientX - startX);
      const height = Math.max(MIN_HEIGHT, startHeight + moveEvent.clientY - startY);
      hud.style.width = `${width}px`;
      hud.style.height = `${height}px`;
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ width: hud.getBoundingClientRect().width, height: hud.getBoundingClientRect().height })
      );
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  });
}
