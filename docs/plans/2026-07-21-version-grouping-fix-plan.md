# Version Grouping Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix version grouping so client versions that encode their true Agave-compatible version in a trailing 5-digit code (e.g. `1.100.0-beta.40201` → Agave `4.2`) are grouped with that Agave version instead of separately.

**Architecture:** Generalize `isFiredancerVersion` in `src/utils/versionParser.ts` to check the *last* dot-segment (instead of only the 3rd), and rewrite `compareVersionsDesc` to compare decoded `major`/`minor`/`patch` via `parseVersion` instead of re-parsing raw strings. No other file changes — `ValidatorTable.tsx` only calls these two functions and is unaffected by the internal fix.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/plans/2026-07-21-version-grouping-fix-design.md`

## Global Constraints

- Detection rule: a version is a "Firedancer-style" encoded version if its **last** dot-separated segment is exactly 5 pure digits (`/^\d{5}$/`), regardless of the version's own leading major number or segment count. `parts.length` must be `>= 3` (a bare 2-segment string like a group name `"4.2"` must never match).
- Decode: for a 5-digit last segment `MMmmpp`, `major = MMmmpp[0]`, `minor = MMmmpp[1..2]`, `patch = MMmmpp[3..4]` (all `parseInt` base 10, `|| 0` fallback) — unchanged math from the existing code, just applied to the last segment instead of always `parts[2]`.
- `compareVersionsDesc` must compare `parseVersion(a)`/`parseVersion(b)`'s decoded `major`/`minor`/`patch` (descending: `pb.X - pa.X`), with the existing `"unknown"`-always-sorts-last guard kept as an early return before parsing.
- `ParsedVersion.type` stays `'firedancer'` for compatibility-mapped versions (no rename).
- Only `src/utils/versionParser.ts` is modified (plus its new test file). No changes to `ValidatorTable.tsx` or any other consumer.
- No new runtime dependencies.
- Branch: `firedancer-versions` (already checked out — do not create a new branch). End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Fix detection, decoding, and sorting in `versionParser.ts`

**Files:**
- Modify: `src/utils/versionParser.ts`
- Create: `src/utils/versionParser.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature changes — `isFiredancerVersion(version: string): boolean`, `parseVersion(version: string): ParsedVersion`, `getMinorVersionGroup(version: string): string`, `isVersionInGroup(version: string, group: string): boolean`, and `compareVersionsDesc(a: string, b: string): number` all keep their existing exported names and signatures. Only their internal behavior changes. `ValidatorTable.tsx` (not touched by this task) continues to import `getMinorVersionGroup` and `compareVersionsDesc` unchanged.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/versionParser.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/versionParser.test.ts`
Expected: FAIL — several assertions fail against the current implementation (e.g. `isFiredancerVersion("1.100.0-beta.40201")` currently returns `false`, so `getMinorVersionGroup("1.100.0-beta.40201")` currently returns `"1.100"`, not `"4.2"`).

- [ ] **Step 3: Rewrite the implementation**

Replace the entire contents of `src/utils/versionParser.ts` with:

```typescript
export interface ParsedVersion {
  original: string;
  type: 'agave' | 'firedancer' | 'unknown';
  major: number;
  minor: number;
  patch: number;
  minorGroup: string; // "3.1"
}

/**
 * Detects versions that encode their true Agave-compatible version in their
 * final dot-segment rather than in their own major.minor.patch numbering.
 * Firedancer-style clients version themselves independently, but append a
 * 5-digit MMmmpp code as the last segment - sometimes directly
 * (e.g. "0.1005.40100"), sometimes after a -rc/-beta/-alpha pre-release tag
 * (e.g. "1.100.0-beta.40201", where the tag itself becomes the 3rd segment
 * and the code moves to the 4th).
 */
export function isFiredancerVersion(version: string): boolean {
  const parts = version.split('.');
  if (parts.length < 3) return false;
  const lastSegment = parts[parts.length - 1];
  return /^\d{5}$/.test(lastSegment);
}

/**
 * Parses both Agave and Firedancer version formats.
 *
 * Agave: "3.1.8" → major=3, minor=1, patch=8
 * Firedancer: the final dot-segment is a 5-digit MMmmpp code, e.g.
 *   "...40201" → major=4, minor=02, patch=01 (Agave-compatible 4.2.1)
 */
export function parseVersion(version: string): ParsedVersion {
  if (!version || version === 'unknown') {
    return {
      original: version,
      type: 'unknown',
      major: 0,
      minor: 0,
      patch: 0,
      minorGroup: 'unknown'
    };
  }

  const parts = version.split('.');

  if (isFiredancerVersion(version)) {
    const encodedSegment = parts[parts.length - 1];

    // Format: MMmmpp - e.g. "40201" -> major=4, minor=02, patch=01
    const major = parseInt(encodedSegment[0], 10) || 0;
    const minor = parseInt(encodedSegment.substring(1, 3), 10) || 0;
    const patch = parseInt(encodedSegment.substring(3, 5), 10) || 0;

    return {
      original: version,
      type: 'firedancer',
      major,
      minor,
      patch,
      minorGroup: `${major}.${minor}`
    };
  }

  // Standard Agave/semver format
  const major = parseInt(parts[0], 10) || 0;
  const minor = parseInt(parts[1], 10) || 0;
  const patch = parseInt(parts[2], 10) || 0;

  return {
    original: version,
    type: 'agave',
    major,
    minor,
    patch,
    minorGroup: `${major}.${minor}`
  };
}

/**
 * Gets the minor version group (e.g., "3.1") for any version format.
 */
export function getMinorVersionGroup(version: string): string {
  return parseVersion(version).minorGroup;
}

/**
 * Checks if a version belongs to a specific minor version group.
 */
export function isVersionInGroup(version: string, group: string): boolean {
  return getMinorVersionGroup(version) === group;
}

/**
 * Compares two version strings for descending sort order, using each
 * version's effective (decoded) major.minor.patch so Firedancer-style
 * versions sort by their true Agave compatibility, not their own numbering.
 * "unknown" always sorts last.
 */
export function compareVersionsDesc(a: string, b: string): number {
  if (a === "unknown") return 1;
  if (b === "unknown") return -1;
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa.major !== pb.major) return pb.major - pa.major;
  if (pa.minor !== pb.minor) return pb.minor - pa.minor;
  if (pa.patch !== pb.patch) return pb.patch - pa.patch;
  return 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/versionParser.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Run the full suite, lint, and build**

Run: `npm test && npm run lint && npm run build`
Expected: all pass (this file has no other consumers besides `ValidatorTable.tsx`, which only calls the two unchanged-signature functions).

- [ ] **Step 6: Commit**

```bash
git add src/utils/versionParser.ts src/utils/versionParser.test.ts
git commit -m "fix: group Firedancer-style versions by their encoded Agave compatibility

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Full check suite**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 2: Manual walkthrough in `npm run dev`**

1. Start `npm run dev`.
2. Open `/` (mainnet) and `/?network=testnet`, open the Version Filter panel on each.
3. Confirm the `4.2` group now includes `1.100.0-beta.40201` and `0.1102.0-beta.40201` alongside `4.2.0-alpha.0`/`4.2.0-beta.*` (mainnet), and the `4.1` group includes `0.1004.0-rc.40101`, `0.1002.0-beta.40103`, `0.1005.40100`, `0.1006.40100` alongside `4.1.0`/`4.1.1`/etc.
4. Confirm there are no more standalone `1.100`, `0.1102`, `0.1004`, or `0.1002` groups in the filter panel.
5. Confirm `0.1.1`, `0.9.3`, `1.1.1` (or whichever of these exist per network) still appear as their own separate, ungrouped entries — these are correctly untouched by the fix.
6. Within the `4.2` group's individual-version list, confirm the versions appear in a sensible order (not raw-string sorted) — e.g. `4.2.0-alpha.0` should not appear ahead of `1.100.0-beta.40201`/`0.1102.0-beta.40201` purely due to a leading "4".

- [ ] **Step 3: Fix anything found, then finish**

If the walkthrough surfaces issues, fix and commit them individually. When clean, this plan is complete.
