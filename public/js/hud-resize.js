const STORAGE_KEY = "storyHudSize";
const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;

export function clampHudDimensions({ width, height, maxWidth, maxHeight }) {
  const capW = Number.isFinite(maxWidth) ? maxWidth : width;
  const capH = Number.isFinite(maxHeight) ? maxHeight : height;
  return {
    width: Math.min(Math.max(MIN_WIDTH, width), Math.max(MIN_WIDTH, capW)),
    height: Math.min(Math.max(MIN_HEIGHT, height), Math.max(MIN_HEIGHT, capH)),
  };
}

export function shouldRestoreHudSize(saved, maxWidth, maxHeight) {
  if (!saved || !Number.isFinite(saved.width) || !Number.isFinite(saved.height)) {
    return false;
  }
  if (saved.width < MIN_WIDTH || saved.height < MIN_HEIGHT) {
    return false;
  }
  if (saved.height > maxHeight || saved.width > maxWidth) {
    return false;
  }
  return true;
}

export function measureHudLimits(hud) {
  const main = hud.closest(".workspace-main") ?? hud.parentElement;
  if (!main) {
    return { maxWidth: Number.POSITIVE_INFINITY, maxHeight: Number.POSITIVE_INFINITY };
  }

  const mainRect = main.getBoundingClientRect();
  const styles = getComputedStyle(main);
  const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  const padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);

  let other = 0;
  for (const child of main.children) {
    if (child === hud) continue;
    const cs = getComputedStyle(child);
    if (cs.position === "absolute" || cs.position === "fixed") continue;
    if (cs.display === "none") continue;
    const rect = child.getBoundingClientRect();
    other += rect.height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  }

  return {
    maxWidth: Math.max(MIN_WIDTH, mainRect.width - padX),
    maxHeight: Math.max(MIN_HEIGHT, mainRect.height - padY - other),
  };
}

function clearExplicitHudSize(hud) {
  hud.style.width = "";
  hud.style.height = "";
  hud.style.flex = "1 1 0";
}

function applyHudSize(hud, width, height) {
  hud.style.width = `${width}px`;
  hud.style.height = `${height}px`;
  hud.style.flex = "0 1 auto";
}

export function initHudResize(hud, handle) {
  if (!hud || !handle) return;

  const restoreOrFlex = () => {
    const { maxWidth, maxHeight } = measureHudLimits(hud);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (shouldRestoreHudSize(saved, maxWidth, maxHeight)) {
        const next = clampHudDimensions({
          width: saved.width,
          height: saved.height,
          maxWidth,
          maxHeight,
        });
        applyHudSize(hud, next.width, next.height);
        return;
      }
    } catch {
      // Ignore malformed optional UI preferences.
    }
    clearExplicitHudSize(hud);
  };

  restoreOrFlex();

  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = hud.getBoundingClientRect().width;
    const startHeight = hud.getBoundingClientRect().height;
    const { maxWidth, maxHeight } = measureHudLimits(hud);

    const move = (moveEvent) => {
      const next = clampHudDimensions({
        width: startWidth + moveEvent.clientX - startX,
        height: startHeight + moveEvent.clientY - startY,
        maxWidth,
        maxHeight,
      });
      applyHudSize(hud, next.width, next.height);
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      const rect = hud.getBoundingClientRect();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ width: rect.width, height: rect.height })
      );
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  });

  window.addEventListener("resize", restoreOrFlex);
}
