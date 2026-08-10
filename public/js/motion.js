export function prefersReducedMotion() {
  const matchMedia =
    typeof globalThis !== "undefined" ? globalThis.matchMedia : undefined;
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createTypewriter({ onUpdate, charsPerSecond = 72 } = {}) {
  let target = "";
  let revealed = 0;
  let velocity = 0;
  let rafId = null;
  let lastTs = 0;
  let settleResolve = null;

  const baseRate = Math.max(24, charsPerSecond);
  const reduced = prefersReducedMotion();

  function emit() {
    onUpdate?.(target.slice(0, revealed));
  }

  function resolveSettle() {
    if (settleResolve) {
      const done = settleResolve;
      settleResolve = null;
      done();
    }
  }

  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTs = 0;
  }

  function tick(ts) {
    rafId = null;
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 1 / 60;
    lastTs = ts;

    const backlog = target.length - revealed;
    if (backlog <= 0) {
      velocity = 0;
      emit();
      resolveSettle();
      return;
    }

    const targetVelocity = baseRate + backlog * 18;
    const stiffness = 14;
    const damping = 9;
    const springForce = (targetVelocity - velocity) * stiffness;
    velocity += (springForce - velocity * damping) * dt;
    velocity = Math.max(12, velocity);

    revealed = Math.min(target.length, revealed + velocity * dt);
    if (target.length - revealed < 1) {
      revealed = target.length;
    }

    emit();

    if (revealed < target.length) {
      rafId = requestAnimationFrame(tick);
    } else {
      velocity = 0;
      resolveSettle();
    }
  }

  function ensureRunning() {
    if (reduced) return;
    if (rafId == null && revealed < target.length) {
      lastTs = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  return {
    setTarget(text) {
      target = String(text ?? "");
      if (reduced) {
        revealed = target.length;
        emit();
        resolveSettle();
        return;
      }
      if (revealed > target.length) {
        revealed = target.length;
      }
      ensureRunning();
    },

    finish() {
      stop();
      revealed = target.length;
      velocity = 0;
      emit();
      resolveSettle();
    },

    done() {
      if (reduced || revealed >= target.length) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        settleResolve = resolve;
        ensureRunning();
      });
    },

    reset() {
      stop();
      target = "";
      revealed = 0;
      velocity = 0;
      resolveSettle();
    },

    destroy() {
      this.reset();
    },
  };
}

export function observeStaggerInView(root, itemSelector = ".history-item") {
  if (!root) return () => {};

  const items = [...root.querySelectorAll(itemSelector)];
  if (items.length === 0) return () => {};

  if (prefersReducedMotion()) {
    items.forEach((el) => {
      el.classList.remove("history-item--pending");
      el.classList.add("history-item--in");
    });
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        el.classList.remove("history-item--pending");
        el.classList.add("history-item--in");
        observer.unobserve(el);
      }
    },
    { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );

  items.forEach((el) => {
    if (el.classList.contains("history-item--in")) return;
    el.classList.add("history-item--pending");
    observer.observe(el);
  });

  return () => observer.disconnect();
}
