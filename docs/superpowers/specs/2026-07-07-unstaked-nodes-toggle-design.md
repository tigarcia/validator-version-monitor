# Unstaked Nodes Toggle — Design

**Date:** 2026-07-07
**Status:** Approved

## Goal

Add a toggle to the validator monitor UI that shows version counts for unstaked
gossip nodes, sourced from `data/gossip.json`.

## Definitions

- **Unstaked node:** an entry in `data/gossip.json` whose `identityPubkey` does
  NOT appear in `data/validators.json`. These are RPC nodes and other
  non-voting gossip participants (~3,639 of ~4,352 gossip entries at time of
  writing).
- Gossip entries carry: `identityPubkey`, `version`, `ipAddress`, `gossipPort`,
  `tpuQuicPort`, `featureSet` (no stake data). Entries may lack `version`;
  those count as `"unknown"`.

## Approach

Server-side aggregation (chosen over shipping raw gossip data to the client or
adding an API route): `page.tsx` computes a compact version-count map and
passes it as a prop. The client toggle only switches what the version panel
renders. No new endpoints, no loading states, tiny payload.

## Data Flow

In `src/app/page.tsx`, after loading `data/validators.json`:

1. Read `data/gossip.json` inside a try/catch (mirroring the validators file
   handling). Missing or malformed file → empty map; the feature degrades
   gracefully.
2. Build a `Set` of staked `identityPubkey`s from the loaded validators.
3. Filter gossip entries whose identity is not in the set.
4. Reduce to `Record<string, number>` keyed by `version || "unknown"`.
5. Pass to `ValidatorTable` as a new prop `unstakedVersionCounts`.

## UI

New **"Unstaked Nodes"** toggle button beside the existing "Version Filter"
button in `src/components/ValidatorTable.tsx`.

When toggled ON:

- The version filter panel opens automatically (if closed) and switches to
  unstaked mode.
- Same grouped card layout (reusing `getMinorVersionGroup`), but:
  - Group header shows `N nodes • M versions` instead of stake %.
  - Each individual version shows its node count instead of stake %.
  - **No checkboxes** — the main table continues to show staked validators, so
    there is nothing for the checkboxes to filter. The panel is read-only
    stats in this mode.
- A header line above the cards shows the total, e.g.
  "3,639 unstaked gossip nodes".
- The main table, sorting, SFDP filter, infrastructure filters, and CSV export
  are unchanged.

When toggled OFF: the panel reverts to the existing stake-% display with
checkboxes.

## URL State

- Toggle persists as `unstaked=1` in the query string, following the existing
  `URLSearchParams` + `window.history.replaceState()` pattern.
- "Clear All Filters" resets the toggle (and removes the param).

## Data Freshness

Extend `.github/workflows/update-validators.yml`:

- Add a generation step: `solana -um gossip --output json > data/gossip.json`.
- Include `data/gossip.json` in the change-detection and commit step so both
  files update hourly.

## Out of Scope

- `/api/validators` route stays untouched (it serves enriched staked
  validators; unstaked counts are a UI concern).
- No changes to table rows, table columns, or CSV export.
- No filtering of the main table by unstaked versions.

## Error Handling

- `gossip.json` missing/unreadable/malformed → `unstakedVersionCounts` is an
  empty object; the toggle still renders but the panel shows
  "0 unstaked gossip nodes" (equivalently, no version cards).
- Gossip entries without a `version` field are counted under `"unknown"`.

## Testing

Manual verification via `npm run dev`:

- Toggle ON shows node counts; sum of all counts equals gossip entries minus
  staked identities.
- Toggle OFF restores the stake-% panel with working checkboxes.
- `?unstaked=1` in the URL restores the toggled state on load; "Clear All
  Filters" removes it.
- `npm run lint` and `npm run build` pass.
