# Network Switcher: Mainnet / Testnet / Devnet — Design

**Date**: 2026-07-21
**Status**: Approved for planning

## Overview

Add a network switcher to the validator monitor so users can view mainnet, testnet, or devnet
validators with the same feature set (version filtering, sorting, gossip node counts, CSV export,
key conversion). Testnet and devnet data is collected hourly alongside the existing mainnet data.

## Goals

- Toggle between mainnet, testnet, and devnet from the main page header.
- Hourly automated collection of testnet and devnet validator + gossip data.
- Feature parity across networks where data sources allow; graceful degradation where they don't.
- Network-aware key converter.

## Non-Goals

- Backfilling tests for existing (pre-feature) code.
- New enrichment sources beyond what mainnet already uses.

## 1. Data Collection (GitHub Actions)

Extend the existing `.github/workflows/update-validators.yml` (hourly schedule unchanged) with
four new generation steps:

```
solana -ut validators --output json-compact > data/testnet-validators.json
solana -ut gossip     --output json-compact > data/testnet-gossip.json
solana -ud validators --output json-compact > data/devnet-validators.json
solana -ud gossip     --output json-compact > data/devnet-gossip.json
```

Robustness requirements:

- **Per-network isolation**: each command writes to a temp file first; the real file is replaced
  only if the command succeeded and the output is valid JSON. Public testnet/devnet RPC endpoints
  are flakier than mainnet — a failed devnet call must not commit an empty/corrupt file or block
  the mainnet update.
- **Single commit** at the end covering all six data files (existing two mainnet files plus the
  four new ones).

Rejected alternative: separate workflows per network — three checkouts and potential push races
between concurrent jobs; extending the single workflow is simpler and atomic.

Initial `data/testnet-*.json` and `data/devnet-*.json` files are generated locally with the
solana CLI and checked in, matching how `gossip.json` was introduced.

## 2. Shared Data Layer

`src/app/page.tsx` and `src/app/api/validators/route.ts` currently duplicate ~100 lines of
identical enrichment logic. Adding three networks would triple that, so extract it once:

- **`src/lib/network.ts`**
  - `type Network = "mainnet" | "testnet" | "devnet"`
  - `parseNetwork(value: string | undefined): Network` — invalid/missing input resolves to
    `"mainnet"`.
  - Per-network config table: validators/gossip data file names and which enrichment sources
    apply.
- **`src/lib/validatorData.ts`**
  - `loadEnrichedValidators(network: Network): Promise<Validator[]>`
  - `loadUnstakedVersionCounts(network: Network): Promise<Record<string, number>>`
  - Used by both the page (server component) and the API route.

### Enrichment matrix (best-effort per network)

| Source                 | Mainnet                    | Testnet                                             | Devnet |
| ---------------------- | -------------------------- | --------------------------------------------------- | ------ |
| Stakewiz names         | ✅                         | —                                                   | —      |
| SFDP status            | ✅ via `mainnetBetaPubkey` | ✅ via `testnetPubkey` (SFDP `name` field also used as validator name) | —      |
| validators.app infra   | ✅ (mainnet endpoint)      | ✅ (testnet endpoint)                                | —      |

- Testnet: the SFDP API response's `name` field fills the name column since Stakewiz has no
  testnet data. Enrichment fetches that don't apply to a network are never made.
- Devnet: no enrichment fetches at all; names show `"unknown"`, `sfdp: false`,
  `sfdpState: null`, infrastructure fields `null`.

## 3. UI

- **Network toggle**: a segmented **Mainnet | Testnet | Devnet** control in the page header,
  top-right, where the Key Converter button is today.
- **Key Converter link** moves to the bottom of the main page, below the table.
- **Navigation**: switching networks navigates to `/?network=testnet` (or `devnet`); mainnet is
  the bare `/` URL with no param. This is a real navigation so the server component reloads the
  correct data files.
- **Filter behavior on switch**: version and infrastructure filters are cleared when switching
  networks (version sets differ per network; carrying filters over would silently match nothing).
  Sort order is kept.
- **URL sync**: the query-string-building logic in `ValidatorTable`'s URL-sync effect is
  extracted into a pure helper (`buildFilterQueryString(filters, network)`) that preserves the
  `network` param when filters change and omits it on mainnet. (Today the effect rebuilds params
  from scratch and would drop `network`.)
- **Per-network UI degradation**: on devnet, the SFDP filter dropdown, SFDP stake stats, and the
  Infrastructure Columns/Filters buttons are hidden entirely (no data to back them). Testnet
  keeps all controls.

## 4. API Route and Key Converter

- `/api/validators` accepts `?network=` (default mainnet) and delegates to the shared loader.
- `/convert` gets the same segmented network toggle; conversions fetch
  `/api/validators?network=X` for the selected network's validator set. The page reads an
  initial `?network=` query param for consistency with the main page.

## 5. Error Handling

- Missing data file (e.g., before the workflow's first run) → empty table with the existing
  "No data found" message; other networks unaffected.
- Enrichment API failure → raw validator data still renders with fallback fields (same behavior
  as today).
- Gossip file missing/corrupt → empty unstaked counts, page still renders.

## 6. Testing (new features only)

Minimal new test infrastructure scoped to the new logic.

**Setup**: Vitest as a dev dependency with an `npm test` script. No React component testing
libraries — the logic worth testing is plain TypeScript.

**Unit tests:**

1. `src/lib/network.ts` — network resolution:
   - `parseNetwork` returns testnet/devnet for those inputs; `"mainnet"`, `undefined`, and
     unknown strings resolve to mainnet.
   - Config table returns the correct data file names per network.
2. `src/lib/validatorData.ts` — enrichment selection per network, with mocked `fs` reads and
   mocked `fetch`:
   - Mainnet: name from Stakewiz, SFDP matched via `mainnetBetaPubkey`, infrastructure attached.
   - Testnet: SFDP matched via `testnetPubkey`, name from SFDP `name` field, Stakewiz never
     called, validators.app testnet endpoint used.
   - Devnet: no enrichment fetches made; fallback fields set.
   - Failure paths: missing data file → empty array (no throw); a rejecting enrichment fetch →
     validators still returned with fallbacks.
   - Gossip counts: staked identities excluded, versions counted correctly, missing gossip file
     → empty counts.
3. `buildFilterQueryString` helper:
   - `network=testnet` preserved when filters change.
   - `network` omitted for mainnet.
   - Removing the last filter on testnet still yields `?network=testnet` (guards the regression
     class fixed in commit `48498483`).

**Manual verification**: `npm run lint`, `npm run build`, and clicking through the toggle,
filters, CSV export, and converter in `npm run dev` with locally generated testnet/devnet data
files. The workflow's temp-file validation guard is verified via a `workflow_dispatch` run —
YAML isn't unit-tested.
