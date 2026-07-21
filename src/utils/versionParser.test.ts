import { describe, it, expect } from "vitest";
import {
  isFiredancerVersion,
  parseVersion,
  getMinorVersionGroup,
  compareVersionsDesc,
} from "./versionParser";

describe("isFiredancerVersion", () => {
  it("detects a 5-digit code as the 3rd segment (legacy 3-segment form)", () => {
    expect(isFiredancerVersion("0.1005.40100")).toBe(true);
  });

  it("detects a 5-digit code as the 4th segment, after a pre-release tag", () => {
    expect(isFiredancerVersion("1.100.0-beta.40201")).toBe(true);
    expect(isFiredancerVersion("0.1102.0-beta.40201")).toBe(true);
    expect(isFiredancerVersion("0.1004.0-rc.40101")).toBe(true);
  });

  it("returns false for real Agave release strings", () => {
    expect(isFiredancerVersion("4.1.0")).toBe(false);
    expect(isFiredancerVersion("4.2.0-alpha.0")).toBe(false);
    expect(isFiredancerVersion("4.1.0-beta.1")).toBe(false);
  });

  it("returns false when the last segment isn't exactly 5 digits", () => {
    expect(isFiredancerVersion("0.1.1")).toBe(false);
    expect(isFiredancerVersion("0.9.3")).toBe(false);
    expect(isFiredancerVersion("1.1.1")).toBe(false);
  });

  it("returns false for fewer than 3 segments", () => {
    expect(isFiredancerVersion("4.2")).toBe(false);
  });
});

describe("parseVersion", () => {
  it("decodes a 4-segment beta version via its trailing 5-digit code", () => {
    const result = parseVersion("1.100.0-beta.40201");
    expect(result.type).toBe("firedancer");
    expect(result.major).toBe(4);
    expect(result.minor).toBe(2);
    expect(result.patch).toBe(1);
    expect(result.minorGroup).toBe("4.2");
  });

  it("decodes a 4-segment rc version via its trailing 5-digit code", () => {
    const result = parseVersion("0.1004.0-rc.40101");
    expect(result.major).toBe(4);
    expect(result.minor).toBe(1);
    expect(result.patch).toBe(1);
    expect(result.minorGroup).toBe("4.1");
  });

  it("still decodes the legacy 3-segment form correctly", () => {
    const result = parseVersion("0.1005.40100");
    expect(result.major).toBe(4);
    expect(result.minor).toBe(1);
    expect(result.patch).toBe(0);
    expect(result.minorGroup).toBe("4.1");
  });

  it("parses a real Agave release as a plain semver", () => {
    const result = parseVersion("4.1.0");
    expect(result.type).toBe("agave");
    expect(result.major).toBe(4);
    expect(result.minor).toBe(1);
    expect(result.patch).toBe(0);
    expect(result.minorGroup).toBe("4.1");
  });

  it("parses a real Agave pre-release as a plain semver, ignoring the tag", () => {
    const result = parseVersion("4.2.0-alpha.0");
    expect(result.major).toBe(4);
    expect(result.minor).toBe(2);
    expect(result.minorGroup).toBe("4.2");
  });

  it("leaves a genuinely unrelated low version ungrouped from Agave", () => {
    const result = parseVersion("0.9.3");
    expect(result.type).toBe("agave");
    expect(result.minorGroup).toBe("0.9");
  });

  it("handles the 'unknown' sentinel", () => {
    const result = parseVersion("unknown");
    expect(result.type).toBe("unknown");
    expect(result.minorGroup).toBe("unknown");
  });
});

describe("getMinorVersionGroup", () => {
  it("groups every reported problem version with its real Agave compatibility group", () => {
    expect(getMinorVersionGroup("1.100.0-beta.40201")).toBe("4.2");
    expect(getMinorVersionGroup("0.1102.0-beta.40201")).toBe("4.2");
    expect(getMinorVersionGroup("0.1004.0-rc.40101")).toBe("4.1");
    expect(getMinorVersionGroup("0.1002.0-beta.40103")).toBe("4.1");
    expect(getMinorVersionGroup("0.910.40000")).toBe("4.0");
  });

  it("leaves already-correct and unrelated versions as before", () => {
    expect(getMinorVersionGroup("0.1005.40100")).toBe("4.1");
    expect(getMinorVersionGroup("4.1.0")).toBe("4.1");
    expect(getMinorVersionGroup("4.3.0-alpha.1")).toBe("4.3");
    expect(getMinorVersionGroup("0.1.1")).toBe("0.1");
    expect(getMinorVersionGroup("1.1.1")).toBe("1.1");
  });
});

describe("compareVersionsDesc", () => {
  it("sorts a mixed group by decoded precedence, not raw string", () => {
    const versions = ["1.100.0-beta.40201", "4.2.0-alpha.0", "0.1102.0-beta.40201"];
    const sorted = [...versions].sort(compareVersionsDesc);
    // All three decode to 4.2.x: 4.2.0-alpha.0 (patch 0) sorts after the two
    // patch-1 entries; the two patch-1 entries are equal-ranked (stable/order
    // preserved), so only the alpha's position relative to both is asserted.
    expect(sorted[2]).toBe("4.2.0-alpha.0");
    expect(sorted.slice(0, 2)).toEqual(
      expect.arrayContaining(["1.100.0-beta.40201", "0.1102.0-beta.40201"])
    );
  });

  it("still sorts plain Agave versions correctly", () => {
    expect(compareVersionsDesc("4.2.0", "4.1.0")).toBeLessThan(0);
    expect(compareVersionsDesc("4.1.0", "4.2.0")).toBeGreaterThan(0);
  });

  it("sorts group name strings correctly", () => {
    const groups = ["4.1", "0.9", "4.2", "0.1"];
    const sorted = [...groups].sort(compareVersionsDesc);
    expect(sorted).toEqual(["4.2", "4.1", "0.9", "0.1"]);
  });

  it("always sorts 'unknown' last", () => {
    const versions = ["4.1.0", "unknown", "4.2.0"];
    const sorted = [...versions].sort(compareVersionsDesc);
    expect(sorted[sorted.length - 1]).toBe("unknown");
  });
});
