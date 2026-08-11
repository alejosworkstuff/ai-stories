import { afterEach, describe, expect, it, vi } from "vitest";

type RafCallback = (time: number) => void;

describe("motion typewriter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reveals text progressively and settles on done()", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );

    const rafState: { cb: RafCallback | null } = { cb: null };
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: RafCallback) => {
        rafState.cb = cb;
        return 1;
      }) as unknown as typeof requestAnimationFrame
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { createTypewriter } = await import("../public/js/motion.js");
    const updates: string[] = [];
    const tw = createTypewriter({
      onUpdate: (text: string) => updates.push(text),
      charsPerSecond: 60,
    });

    tw.setTarget("Hello");
    expect(rafState.cb).toBeTypeOf("function");

    const donePromise = tw.done();
    let t = 0;
    for (let i = 0; i < 80; i += 1) {
      const cb = rafState.cb;
      if (!cb) break;
      rafState.cb = null;
      t += 16;
      cb(t);
    }

    await donePromise;
    expect(updates.at(-1)).toBe("Hello");
    expect(updates.some((u) => u.length > 0 && u.length < 5)).toBe(true);
    tw.destroy();
  });

  it("snaps instantly when prefers-reduced-motion is set", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    vi.stubGlobal("requestAnimationFrame", vi.fn());

    const { createTypewriter } = await import("../public/js/motion.js");
    const updates: string[] = [];
    const tw = createTypewriter({
      onUpdate: (text: string) => updates.push(text),
    });
    tw.setTarget("Instant story");
    expect(updates).toEqual(["Instant story"]);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    await expect(tw.done()).resolves.toBeUndefined();
    tw.destroy();
  });
});
