# Mobile UI Design — Solana Validator Version Monitor

**Date**: 2026-08-03
**Status**: Approved

## Problem

The app is desktop-only in practice. On phones, the table (`min-w-full`, no `overflow-x-auto` wrapper) overflows the white card, so rows render past the card's right edge onto the gray page background — the visible "split down the middle." Beyond the bug, the desktop table and filter bar are merely shrunk on mobile (Vote Account hidden below `sm`, Is Active below `lg`), not adapted.

Primary mobile use case: quick glance at version adoption, with filtering (by version group, client, etc.) as a first-class action. Per-row essentials on mobile: name, version, stake %, and infrastructure (client/ASN/data center); pubkeys and SFDP state are secondary (available on expand).

## Scope

- Below Tailwind `md` (768px): a mobile-native UI replaces the table and filter bar.
- At `md` and up: desktop stays as-is, except the table gains an `overflow-x-auto` wrapper as a safety net for mid-size viewports (this also fixes the overflow bug everywhere).
- Applies to the main page (`/`). The `/convert` page is out of scope.

## Design

### 1. Header & page layout (mobile)

- Single row: shortened title "Validator Monitor" (smaller font) left, compact network toggle (Main / Test / Dev) right.
- Page padding `px-3` on mobile (desktop keeps `px-8`).
- Key Converter link unchanged at the bottom.

### 2. Mobile validator list (replaces the table below `md`)

Two-line rows, stake-descending:

- **Line 1**: validator name (truncated) left; stake % (bold) right with SOL amount in small muted text beneath.
- **Line 2**: version chip + client/provider muted text (e.g. "Agave · Teraswitch").
- **Version chip**: color-coded by minor-version group. Firedancer-style versions display their decoded Agave-compatible version (e.g. `0.1006.40100` → "FD 4.1") using the existing `versionParser` logic; the full literal version appears in the expanded detail.
- **Tap to expand** (inline, one row at a time is not required — multiple may be open): identity pubkey, vote account pubkey (both tap-to-copy with the existing toast), full version string, SFDP state, ASN provider, data center.
- **Delinquent indicator**: red dot next to the name (replaces the "Is Active?" column).
- **No sort UI on mobile**: list defaults to stake-descending. URL sort params from shared links still apply to the underlying sorted data; mobile just offers no control to change them.

### 3. Filter chip bar + bottom sheet (mobile)

- **Chip bar** above the list (sticky): a "Filters (n)" chip opens the bottom sheet; each active filter renders as a removable ✕ chip; horizontally scrollable when chips overflow.
- **Matching stake line** below the chip bar: "Matching stake: X% · N validators" (plus total SFDP stake when an SFDP filter is active, mirroring desktop).
- **Bottom sheet** (slides up with drag handle, scrollable content, Framer Motion — already a dependency; closes via handle drag, backdrop tap, or close affordance). Sections:
  - **Version** — one chip per minor-version group labeled with stake % (tap toggles all versions in the group — same semantics as the desktop group checkbox, including partial state styling when only some versions in a group are selected). A collapsed "Individual versions" disclosure per group lists per-version chips with stake % for fine-grained selection.
  - **Client / ASN / Data center** — chip sections fed by the existing `infrastructureStats` (stake % labels). ASN chips use `getAsnDisplay` names. The data center section is capped-height and scrollable (long list). Shown only when the network has validators.app data (mainnet, testnet), like desktop.
  - **SFDP** — single-select chips: All / SFDP Participants / Non-SFDP / each state. Shown only for networks with SFDP (mainnet, testnet).
  - **Unstaked nodes** — toggle; when on, the version section shows gossip-node version counts (the existing unstaked stats) instead of stake percentages, mirroring desktop behavior.
  - **Footer** — "Clear all filters" and "Export CSV" buttons (reuse existing handlers).
- No "Infrastructure Columns" toggle on mobile — infrastructure data always lives in row line 2 and the expanded detail.
- Filter state is the existing `ValidatorTable` state; the chip bar and sheet are an alternate view of the same state, so URL query-param persistence works unchanged.

### 4. Implementation architecture

**CSS-only dual render.** `ValidatorTable` renders both:

- the existing `<table>` + desktop filter bar, hidden below `md` (`hidden md:block` on wrappers), and
- the mobile chip bar + list, hidden at `md`+ (`md:hidden`),

from the same state and the same `sorted`/`filtered` data. No `matchMedia` or JS breakpoint detection → no hydration mismatch, no flash; SSR output correct for both. Cost: ~1,000 extra lightweight DOM rows, consistent with the app's existing no-virtualization approach.

Alternatives rejected:
- `matchMedia` conditional render — smaller DOM but hydration flash/mismatch on mobile.
- Rewriting the table as CSS-grid divs restyled per breakpoint — one markup tree but a large desktop refactor for no user-visible gain.

**New components** (all client components under `src/components/`):
- `MobileValidatorList` — maps sorted validators to rows.
- `MobileValidatorRow` — two-line row + inline expand; owns its `expanded` state; reuses `copyToClipboard` + toast callbacks.
- `FilterChipBar` — Filters button, active-filter ✕ chips, matching-stake line.
- `FilterBottomSheet` — the sheet with all filter sections; receives filter state + toggle callbacks as props from `ValidatorTable`.

**Modified**:
- `ValidatorTable.tsx` — hosts the new components, one new piece of state (`sheetOpen`); wraps the table in `overflow-x-auto`; hides desktop filter bar below `md`.
- `page.tsx` — responsive header (title sizing/shortening, padding).
- `versionParser.ts` (or a small new helper) — export a function for the chip label (minor-version group + Firedancer "FD x.y" display) if not already covered.

Existing table components (`ValidatorTableRow`, `ValidatorTableHeader`) stay untouched; their current `hidden sm:table-cell` / `hidden lg:table-cell` classes become desktop-only concerns.

### 5. Error handling & edge cases

- Empty filter result: mobile shows the same "No data found" message as desktop.
- Devnet: no SFDP/infrastructure sections in the sheet; rows show version chip only on line 2 (no client text); names default to "unknown".
- Long names / long data center strings: truncate with `title` attribute.
- Copy failures surface via the existing error toast.

### 6. Testing

- Vitest unit tests for extracted pure helpers (version-chip label/grouping, active-filter-chip derivation).
- Manual verification: Chrome DevTools iPhone SE + iPhone 14 Pro Max presets (layout, sheet interaction, expand/copy), plus a desktop-width regression pass (filters, sorting, infrastructure columns, CSV export).

## Decisions log

- Mobile list style: two-line rows with tap-to-expand (chosen over adoption-summary-first layout and horizontal-scroll table via mockups).
- Filter UX: chip bar + bottom sheet (chosen over inline collapsible panels via mockups).
- No sorting UI on mobile (always stake-descending).
- Breakpoint: `md` / 768px.
- Dual-render CSS approach over JS breakpoint detection.
