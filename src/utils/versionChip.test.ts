import { describe, it, expect } from "vitest";
import { getVersionChipLabel, getVersionChipColorClasses } from "./versionChip";

describe("getVersionChipLabel", () => {
  it("returns the literal version for an Agave release", () => {
    expect(getVersionChipLabel("4.1.1")).toBe("4.1.1");
  });

  it("returns a decoded 'FD x.y' label for a Firedancer-style version", () => {
    expect(getVersionChipLabel("0.1006.40100")).toBe("FD 4.1");
    expect(getVersionChipLabel("1.100.0-beta.40201")).toBe("FD 4.2");
  });

  it("passes through 'unknown' as-is", () => {
    expect(getVersionChipLabel("unknown")).toBe("unknown");
  });
});

describe("getVersionChipColorClasses", () => {
  const PALETTE_BG = ["bg-green-100", "bg-blue-100", "bg-amber-100", "bg-purple-100", "bg-pink-100", "bg-teal-100"];

  it("returns the gray pair for the 'unknown' group", () => {
    expect(getVersionChipColorClasses("unknown")).toEqual({ bg: "bg-gray-100", text: "text-gray-700" });
  });

  it("returns a palette color pair for a real group", () => {
    const { bg, text } = getVersionChipColorClasses("4.1");
    expect(PALETTE_BG).toContain(bg);
    expect(text).toMatch(/^text-/);
  });

  it("is deterministic for the same group", () => {
    expect(getVersionChipColorClasses("4.1")).toEqual(getVersionChipColorClasses("4.1"));
  });

  it("does not always return the same color for different groups", () => {
    const colors = new Set(
      ["4.1", "4.2", "3.1", "0.9", "2.0", "5.3"].map((g) => getVersionChipColorClasses(g).bg)
    );
    expect(colors.size).toBeGreaterThan(1);
  });
});
