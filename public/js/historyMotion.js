import { prefersReducedMotion } from "./motion.js";

const FLIP_MS = 480;
const EXIT_MS = 340;
const EASING = "cubic-bezier(0.34, 1.25, 0.64, 1)";
const EXIT_EASING = "cubic-bezier(0.4, 0, 1, 1)";

/**
 * @param {ParentNode | null} root
 * @returns {Map<string, DOMRect>}
 */
export function measureHistoryRects(root) {
  const map = new Map();
  if (!root) return map;
  root.querySelectorAll(".history-item[data-id]").forEach((el) => {
    const id = el.getAttribute("data-id");
    if (id) map.set(id, el.getBoundingClientRect());
  });
  return map;
}

export function playHistoryFlip(root, firstRects, { liftId = null, duration = FLIP_MS } = {}) {
  if (!root || prefersReducedMotion() || firstRects.size === 0) {
    return Promise.resolve();
  }

  const items = [...root.querySelectorAll(".history-item[data-id]")];
  const playing = [];

  for (const el of items) {
    const id = el.getAttribute("data-id");
    if (!id) continue;
    const first = firstRects.get(id);
    if (!first) continue;

    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

    const isLift = liftId != null && id === liftId;
    el.classList.add("history-item--flipping");
    if (isLift) el.classList.add("history-item--lifting");

    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)${isLift ? " scale(1.03)" : ""}`;
    if (isLift) el.style.zIndex = "5";

    playing.push(
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.transition = `transform ${duration}ms ${EASING}, box-shadow ${duration}ms ${EASING}`;
            el.style.transform = "";
            const done = () => {
              el.classList.remove("history-item--flipping", "history-item--lifting");
              el.style.transition = "";
              el.style.transform = "";
              el.style.zIndex = "";
              el.removeEventListener("transitionend", onEnd);
              resolve();
            };
            const onEnd = (event) => {
              if (event.propertyName !== "transform") return;
              done();
            };
            el.addEventListener("transitionend", onEnd);
            setTimeout(done, duration + 40);
          });
        });
      })
    );
  }

  return Promise.all(playing).then(() => undefined);
}

export function animateHistoryExitLeft(el, { duration = EXIT_MS } = {}) {
  if (prefersReducedMotion()) {
    return Promise.resolve();
  }

  el.classList.add("history-item--exiting");
  el.style.pointerEvents = "none";
  void el.offsetWidth;

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      el.style.transition = [
        `transform ${duration}ms ${EXIT_EASING}`,
        `opacity ${Math.round(duration * 0.85)}ms ${EXIT_EASING}`,
      ].join(", ");
      el.style.transform = "translateX(-112%)";
      el.style.opacity = "0";

      const done = () => {
        el.removeEventListener("transitionend", onEnd);
        resolve();
      };
      const onEnd = (event) => {
        if (event.propertyName !== "transform") return;
        done();
      };
      el.addEventListener("transitionend", onEnd);
      setTimeout(done, duration + 40);
    });
  });
}

export function playHistoryExpandEntrance(root) {
  if (!root) return;
  const items = [...root.querySelectorAll(".history-item")];
  if (items.length === 0) return;

  if (prefersReducedMotion()) {
    items.forEach((el) => {
      el.classList.remove("history-item--pending", "is-entering");
    });
    return;
  }

  items.forEach((el, index) => {
    el.classList.remove("is-entering");
    el.classList.add("history-item--pending");
    el.style.setProperty("--stagger", String(Math.min(index, 12)));
  });

  requestAnimationFrame(() => {
    items.forEach((el) => {
      el.classList.remove("history-item--pending");
      el.classList.add("is-entering");
      const clear = () => {
        el.classList.remove("is-entering");
        el.removeEventListener("animationend", clear);
      };
      el.addEventListener("animationend", clear);
    });
  });
}
