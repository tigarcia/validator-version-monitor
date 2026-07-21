# Version Grouping Fix — Design

**Date**: 2026-07-21
**Status**: Approved for planning

## Problem

The version filter groups validator versions by minor version (e.g. "4.2") so users can filter
by compatible version families. Some versions are wrongly split into their own single-version
groups (`1.100`, `0.1102`, `0.1004`) instead of being grouped with the Agave version they're
actually compatible with (e.g. `4.2`).

## Root Cause

Client software (Firedancer-style) versions itself independently of Agave, but encodes its true
Agave-compatible version as a 5-digit `MMmmpp` code in one of its dot-segments — e.g. `40201`
decodes to major `4`, minor `02`, patch `01` → Agave group `4.2`.

`isFiredancerVersion` in `src/utils/versionParser.ts` only checks whether the **3rd** dot-segment
is this 5+-digit code, matching the older format `0.XXX.YYYYY` (e.g. `0.1005.40100`, already
handled correctly today). But real-world versions now insert a pre-release tag as the 3rd
segment (`0-beta`, `0-rc`), pushing the actual code to a **4th** segment:

- `1.100.0-beta.40201` → code is `40201` (4th segment), not detected today
- `0.1102.0-beta.40201` → same
- `0.1004.0-rc.40101` → code is `40101` (4th segment), not detected today

These fall through to the plain-semver parsing branch and get grouped by their own literal
`major.minor` instead.

## Fix

Generalize `isFiredancerVersion` to check the **last** dot-segment, regardless of its position or
the version's own leading major number: if it is exactly 5 digits, decode it as `MMmmpp` and use
that as the version's effective major/minor/patch. This single rule unifies the old 3-segment
case and the new 4-segment case.

Verified against every distinct version string in `data/validators.json` and
`data/testnet-validators.json`:

| Version | Last segment | Decoded | Group | Notes |
|---|---|---|---|---|
| `1.100.0-beta.40201` | `40201` | 4.2.1 | `4.2` | was wrongly `1.100` |
| `0.1102.0-beta.40201` | `40201` | 4.2.1 | `4.2` | was wrongly `0.1102` |
| `0.1004.0-rc.40101` | `40101` | 4.1.1 | `4.1` | was wrongly `0.1004` |
| `0.1002.0-beta.40103` | `40103` | 4.1.3 | `4.1` | was wrongly `0.1002` |
| `0.1005.40100` | `40100` | 4.1.0 | `4.1` | unaffected, already correct |
| `0.1006.40100` | `40100` | 4.1.0 | `4.1` | unaffected, already correct |
| `0.910.40000` | `40000` | 4.0.0 | `4.0` | was wrongly `0.910`, now matches real `4.0.3` releases |
| `4.1.0`, `4.2.0-alpha.0`, `4.3.0-alpha.1`, etc. | not 5 digits | n/a | own `major.minor` | unaffected, real Agave releases |
| `0.1.1`, `0.9.3`, `1.1.1` | not 5 digits | n/a | own `major.minor` | unaffected, no encoded code present |

## Sort Fix

`compareVersionsDesc` currently splits and compares raw version strings numerically. This breaks
once a group can contain both a real release string (`4.2.0-alpha.0`, major `4`) and
compatibility-mapped client versions (`1.100.0-beta.40201`, major `1`) — comparing raw leading
digits produces a meaningless order.

`compareVersionsDesc` is rewritten to call `parseVersion` on each side and compare the *decoded*
`major`/`minor`/`patch`, instead of re-parsing the raw string itself. This also removes a small
duplication (raw string parsing existed in two places for one concept). The `"unknown"` sentinel
handling (always sorts last) is unchanged — it stays as an early-return guard before parsing.

## Scope

Only `src/utils/versionParser.ts` changes. `ValidatorTable.tsx` (the only consumer) calls
`getMinorVersionGroup` and `compareVersionsDesc` without knowledge of version format internals,
so the fix is fully transparent to it — no other file needs changes.

`ParsedVersion.type` stays `'firedancer'` for compatibility-mapped versions (naming unchanged,
no external consumer depends on this field today). `isVersionInGroup` is unused elsewhere in the
codebase and is left as-is — out of scope for this fix.

## Testing

`src/utils/versionParser.ts` currently has no test coverage. Add `src/utils/versionParser.test.ts`
covering:

- `isFiredancerVersion`: true for exactly-5-digit last segments in both 3-segment and 4-segment
  forms; false for real Agave release strings and for short/non-numeric trailing segments.
- `parseVersion`: correct major/minor/patch decode for all the real version strings in the table
  above, plus the `'unknown'` sentinel case.
- `getMinorVersionGroup`: each version in the table above maps to its listed group.
- `compareVersionsDesc`: mixed-format groups (e.g. `4.2.0-alpha.0` vs `1.100.0-beta.40201`) sort
  by decoded precedence, not raw string; `"unknown"` always sorts last; existing plain-Agave
  comparisons (e.g. `4.2.0` vs `4.1.0`) are unaffected.
