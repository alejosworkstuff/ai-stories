import { describe, expect, it } from "vitest";
import { clampHudDimensions, shouldRestoreHudSize } from "../public/js/hud-resize.js";

describe("hud-resize", () => {
  it("clamps height so controls stay in the remaining column space", () => {
    expect(
      clampHudDimensions({ width: 900, height: 2000, maxWidth: 640, maxHeight: 320 })
    ).toEqual({ width: 640, height: 320 });
  });

  it("does not restore a saved size that would overflow the workspace", () => {
    expect(shouldRestoreHudSize({ width: 400, height: 900 }, 500, 280)).toBe(false);
    expect(shouldRestoreHudSize({ width: 400, height: 220 }, 500, 280)).toBe(true);
  });
});
