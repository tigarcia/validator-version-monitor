# Testnet Validator Name Resolution via Mainnet Bridge — Design

**Date**: 2026-07-21
**Status**: Approved for planning

## Problem

Testnet validator names currently always show "unknown". The design assumed the SFDP API's
`name` field would supply testnet names, but the live API (`api.solana.org/api/community/v1/sfdp_participants`)
returns no `name` field on any record today.

## Solution

SFDP participant records link a validator's `testnetPubkey` to its `mainnetBetaPubkey` (both
identity pubkeys, confirmed by cross-referencing live API data against `data/validators.json`
and `data/testnet-validators.json`: `mainnetBetaPubkey` matches mainnet `identityPubkey` values,
`testnetPubkey` matches testnet `identityPubkey` values, neither matches vote account pubkeys).
Stakewiz's `vote_identity` field is, despite the name, a vote account pubkey (the existing
mainnet code already relies on this).

So a testnet validator's name can be resolved by chaining: testnet `identityPubkey` → SFDP
record (matched on `testnetPubkey`) → that record's `mainnetBetaPubkey` → mainnet
`data/validators.json` (matched on `identityPubkey`) → mainnet `voteAccountPubkey` → Stakewiz
(matched on `vote_identity`) → name.

Verified against live data (`/tmp/sfdp.json`, `/tmp/stakewiz.json`, `data/validators.json`,
`data/testnet-validators.json` as of 2026-07-21): of 613 testnet validators, 405 (66%) resolve to
a real Stakewiz name via this chain, up from 0 today.

## Scope

Name resolution only. Testnet's infrastructure enrichment (already sourced independently via
validators.app's testnet endpoint) is unaffected. No general-purpose "mainnet identity bridge"
abstraction — this is scoped to the one enrichment source that needs it.

## 1. Config shape change

`src/lib/network.ts`'s `NetworkConfig.stakewiz: boolean` is replaced with:

```typescript
nameSource: "stakewiz-direct" | "sfdp-mainnet-bridge" | "none"
```

| Network | `nameSource` |
|---|---|
| mainnet | `"stakewiz-direct"` (unchanged behavior) |
| testnet | `"sfdp-mainnet-bridge"` (new) |
| devnet | `"none"` (unchanged) |

`stakewiz` is not read outside `network.ts`/`validatorData.ts` (confirmed: `ValidatorTable.tsx`
only reads `sfdpKeyField` and `validatorsAppUrl` from `NetworkConfig`), so this rename's blast
radius is contained to those two files and their tests.

## 2. Bridge resolution (`src/lib/validatorData.ts`)

- Stakewiz is now fetched whenever `nameSource` is `"stakewiz-direct"` OR `"sfdp-mainnet-bridge"`
  (today only mainnet triggers this fetch; testnet will too).
- The existing `sfdpMap` (keyed by `config.sfdpKeyField`, built from the SFDP response) gains
  `mainnetBetaPubkey` in each stored entry — already present on every SFDP record, no extra
  fetch.
- When `nameSource === "sfdp-mainnet-bridge"`, mainnet's own `data/validators.json` is read
  locally (via the existing `readDataFile` helper, `NETWORK_CONFIGS.mainnet.validatorsFile`) to
  build an `identityPubkey → voteAccountPubkey` map. This is a local file read, not a network
  call.

A new pure, exported helper performs the actual resolution — testable with plain fixture maps,
no fs/fetch mocking required:

```typescript
export function resolveBridgedName(
  mainnetBetaPubkey: string | undefined,
  sfdpOwnName: string | undefined,
  mainnetIdentityToVote: Map<string, string>,
  stakewizByVote: Map<string, string>
): string {
  if (sfdpOwnName) return sfdpOwnName;
  const voteAccount = mainnetBetaPubkey && mainnetIdentityToVote.get(mainnetBetaPubkey);
  if (voteAccount) {
    return stakewizByVote.get(voteAccount) || "private validator";
  }
  return "unknown";
}
```

Precedence and rationale:

1. **SFDP's own `name` field**, if ever populated (currently always absent in the live API, but
   the field already exists in the `SfdpParticipant` type — free forward-compatibility, no cost
   to keep checking it first).
2. **Chain-resolved Stakewiz name** — the fix itself.
3. **`"private validator"`** — the chain resolved to a real, currently-active mainnet validator,
   but that validator has no public Stakewiz name (491 of 1429 live Stakewiz entries have a
   blank `name`) — matches the existing mainnet convention for the identical situation
   (mainnet's direct lookup already falls back to `"private validator"` the same way).
4. **`"unknown"`** — no SFDP record for this testnet identity, or the SFDP record's
   `mainnetBetaPubkey` doesn't match any validator in the current `data/validators.json` (128 of
   613 testnet validators today — most likely delinquent/retired mainnet operators, or timing
   skew between when the two datasets were captured).

`loadEnrichedValidators`'s per-validator mapping calls `resolveBridgedName` when
`config.nameSource === "sfdp-mainnet-bridge"`, passing `sfdpInfo?.mainnetBetaPubkey`,
`sfdpInfo?.name`, the mainnet identity→vote map, and the existing `stakewizMap` (which is
already exactly `vote_identity → name`, reused as-is — no second Stakewiz map needed).

## 3. Error handling

- Mainnet `data/validators.json` missing/corrupt when loading testnet → `readDataFile` returns
  `null` per its existing behavior, the identity→vote map stays empty, `resolveBridgedName`'s
  bridge branch always falls through to `"unknown"` — no crash, no special-casing needed.
- Stakewiz or SFDP fetch failure on testnet → same graceful degradation as today (validators
  still render, names fall back through the same precedence chain with empty maps).

## 4. Testing

- Unit tests for `resolveBridgedName` directly, covering all four precedence branches, using
  plain `Map` fixtures — no mocking.
- Extend `validatorData.test.ts`'s testnet case: mock a second `fs.readFile` call (mainnet
  `validators.json`) alongside the existing testnet-validators mock (distinguish by the path
  argument), and mock Stakewiz being fetched for testnet (it wasn't before this change).
- Update `network.test.ts`'s `stakewiz` boolean assertions to assert `nameSource` instead.
- Manual check: `npm run dev`, load `/?network=testnet`, confirm validator names render instead
  of "unknown" for validators with a resolvable mainnet counterpart.
