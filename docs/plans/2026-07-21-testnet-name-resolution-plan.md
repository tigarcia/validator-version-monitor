# Testnet Validator Name Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve testnet validator names by bridging SFDP's `testnetPubkey` → `mainnetBetaPubkey` link to mainnet's own validator/Stakewiz data, instead of always showing "unknown".

**Architecture:** `NetworkConfig.stakewiz: boolean` becomes `nameSource: "stakewiz-direct" | "sfdp-mainnet-bridge" | "none"`. A new pure, exported function `resolveBridgedName` encodes the four-level name-resolution precedence and is wired into `loadEnrichedValidators`, which now also loads mainnet's own `data/validators.json` (locally, no network call) when resolving testnet names.

**Tech Stack:** TypeScript, Vitest (existing setup from the network-switcher branch).

**Spec:** `docs/plans/2026-07-21-testnet-name-resolution-design.md`

## Global Constraints

- `NetworkConfig.nameSource` values are exactly: `"stakewiz-direct"` (mainnet), `"sfdp-mainnet-bridge"` (testnet), `"none"` (devnet).
- `resolveBridgedName` precedence, in order: (1) SFDP's own `name` field if present, (2) chain-resolved Stakewiz name, (3) `"private validator"` if the chain resolves to a real mainnet validator with no Stakewiz name, (4) `"unknown"` if the chain doesn't resolve at all.
- Testnet's Stakewiz fetch and mainnet `data/validators.json` read are both new — neither happened before this change.
- No new runtime dependencies. No changes to `NETWORK_CONFIGS` fields other than `stakewiz` → `nameSource` (`validatorsFile`, `gossipFile`, `sfdpKeyField`, `validatorsAppUrl` are unchanged).
- `ValidatorTable.tsx` does not read `NetworkConfig.stakewiz`/`nameSource` — confirmed, no changes needed there.
- Existing code uses relative imports, not the `@/*` alias.
- Branch: `add-testnet-devnet` (already checked out — do not create a new branch). End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `NetworkConfig.nameSource`

**Files:**
- Modify: `src/lib/network.ts`
- Modify: `src/lib/network.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 2): `NetworkConfig.nameSource: "stakewiz-direct" | "sfdp-mainnet-bridge" | "none"`, replacing `NetworkConfig.stakewiz: boolean`. `NETWORK_CONFIGS.mainnet.nameSource === "stakewiz-direct"`, `.testnet.nameSource === "sfdp-mainnet-bridge"`, `.devnet.nameSource === "none"`.

- [ ] **Step 1: Update the failing test**

In `src/lib/network.test.ts`, replace the `"only mainnet uses Stakewiz"` test (currently lines 46-50) with:

```typescript
  it("uses the right name resolution strategy per network", () => {
    expect(NETWORK_CONFIGS.mainnet.nameSource).toBe("stakewiz-direct");
    expect(NETWORK_CONFIGS.testnet.nameSource).toBe("sfdp-mainnet-bridge");
    expect(NETWORK_CONFIGS.devnet.nameSource).toBe("none");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/network.test.ts`
Expected: FAIL — `NETWORK_CONFIGS.mainnet.nameSource` is `undefined`, not `"stakewiz-direct"`.

- [ ] **Step 3: Update the implementation**

Replace the entire contents of `src/lib/network.ts` with:

```typescript
export type Network = "mainnet" | "testnet" | "devnet";

export const NETWORKS: Network[] = ["mainnet", "testnet", "devnet"];

export interface NetworkConfig {
  validatorsFile: string;
  gossipFile: string;
  nameSource: "stakewiz-direct" | "sfdp-mainnet-bridge" | "none";
  sfdpKeyField: "mainnetBetaPubkey" | "testnetPubkey" | null;
  validatorsAppUrl: string | null;
}

export const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
  mainnet: {
    validatorsFile: "validators.json",
    gossipFile: "gossip.json",
    nameSource: "stakewiz-direct",
    sfdpKeyField: "mainnetBetaPubkey",
    validatorsAppUrl:
      "https://www.validators.app/api/v1/validators/mainnet.json?limit=9999",
  },
  testnet: {
    validatorsFile: "testnet-validators.json",
    gossipFile: "testnet-gossip.json",
    nameSource: "sfdp-mainnet-bridge",
    sfdpKeyField: "testnetPubkey",
    validatorsAppUrl:
      "https://www.validators.app/api/v1/validators/testnet.json?limit=9999",
  },
  devnet: {
    validatorsFile: "devnet-validators.json",
    gossipFile: "devnet-gossip.json",
    nameSource: "none",
    sfdpKeyField: null,
    validatorsAppUrl: null,
  },
};

export function parseNetwork(value: string | null | undefined): Network {
  if (value === "testnet" || value === "devnet") return value;
  return "mainnet";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/network.test.ts`
Expected: PASS (all tests in the file, including the new one).

- [ ] **Step 5: Commit**

```bash
git add src/lib/network.ts src/lib/network.test.ts
git commit -m "feat: replace NetworkConfig.stakewiz with nameSource strategy

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `resolveBridgedName` + wire into `loadEnrichedValidators`

**Files:**
- Modify: `src/lib/validatorData.ts`
- Modify: `src/lib/validatorData.test.ts`

**Interfaces:**
- Consumes: `NetworkConfig.nameSource` from Task 1.
- Produces: `export function resolveBridgedName(mainnetBetaPubkey: string | undefined, sfdpOwnName: string | undefined, mainnetIdentityToVote: Map<string, string>, stakewizByVote: Map<string, string>): string`.

This task is TDD in two layers: first the pure function (no mocking), then the integration wiring (fs/fetch mocking, extending the existing test suite). Do them in order — the pure function's tests must pass before you wire it in, so a wiring bug can't hide behind a broken precedence function.

- [ ] **Step 1: Write the failing tests for the pure function**

Add to `src/lib/validatorData.test.ts`, after the existing imports (the `resolveBridgedName` import doesn't exist yet — that's expected, it's what makes this RED):

```typescript
import { loadEnrichedValidators, loadUnstakedVersionCounts, resolveBridgedName } from "./validatorData";
```

Add this new `describe` block anywhere at the top level of the file (e.g., right after the `jsonResponse` helper, before `beforeEach`):

```typescript
describe("resolveBridgedName", () => {
  it("prefers the SFDP participant's own name when present", () => {
    const result = resolveBridgedName(
      "mainnet-id-1",
      "SFDP Name",
      new Map([["mainnet-id-1", "mainnet-vote-1"]]),
      new Map([["mainnet-vote-1", "Stakewiz Name"]])
    );
    expect(result).toBe("SFDP Name");
  });

  it("resolves via the mainnet identity -> vote -> Stakewiz chain when SFDP has no own name", () => {
    const result = resolveBridgedName(
      "mainnet-id-1",
      undefined,
      new Map([["mainnet-id-1", "mainnet-vote-1"]]),
      new Map([["mainnet-vote-1", "Stakewiz Name"]])
    );
    expect(result).toBe("Stakewiz Name");
  });

  it("falls back to 'private validator' when the chain resolves but Stakewiz has no name", () => {
    const result = resolveBridgedName(
      "mainnet-id-1",
      undefined,
      new Map([["mainnet-id-1", "mainnet-vote-1"]]),
      new Map()
    );
    expect(result).toBe("private validator");
  });

  it("falls back to 'unknown' when there is no mainnetBetaPubkey at all", () => {
    const result = resolveBridgedName(
      undefined,
      undefined,
      new Map([["mainnet-id-1", "mainnet-vote-1"]]),
      new Map([["mainnet-vote-1", "Stakewiz Name"]])
    );
    expect(result).toBe("unknown");
  });

  it("falls back to 'unknown' when the mainnetBetaPubkey doesn't match any mainnet validator", () => {
    const result = resolveBridgedName(
      "mainnet-id-unmatched",
      undefined,
      new Map([["mainnet-id-1", "mainnet-vote-1"]]),
      new Map([["mainnet-vote-1", "Stakewiz Name"]])
    );
    expect(result).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/validatorData.test.ts`
Expected: FAIL — `resolveBridgedName` is not exported from `./validatorData` (import error / undefined is not a function).

- [ ] **Step 3: Implement `resolveBridgedName` and wire it into `loadEnrichedValidators`**

Replace the entire contents of `src/lib/validatorData.ts` with:

```typescript
import fs from "fs/promises";
import path from "path";
import { Validator } from "../types/validator";
import { Network, NETWORK_CONFIGS } from "./network";

interface StakewizValidator {
  vote_identity: string;
  name: string;
}

interface SfdpParticipant {
  mainnetBetaPubkey: string;
  testnetPubkey: string;
  state: string;
  name: string;
}

interface ValidatorsAppValidator {
  vote_account: string;
  account: string;
  autonomous_system_number: number | null;
  data_center_key: string | null;
  software_client: string | null;
}

interface GossipNode {
  identityPubkey: string;
  version?: string;
}

async function readDataFile<T>(fileName: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "data", fileName),
      "utf-8"
    );
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Error reading data/${fileName}:`, error);
    return null;
  }
}

function parseValidatorsFile(
  json: Validator[] | { validators?: Validator[] } | null
): Validator[] {
  if (!json) return [];
  return Array.isArray(json) ? json : json.validators ?? [];
}

export function resolveBridgedName(
  mainnetBetaPubkey: string | undefined,
  sfdpOwnName: string | undefined,
  mainnetIdentityToVote: Map<string, string>,
  stakewizByVote: Map<string, string>
): string {
  if (sfdpOwnName) return sfdpOwnName;
  const voteAccount =
    mainnetBetaPubkey && mainnetIdentityToVote.get(mainnetBetaPubkey);
  if (voteAccount) {
    return stakewizByVote.get(voteAccount) || "private validator";
  }
  return "unknown";
}

export async function loadEnrichedValidators(
  network: Network
): Promise<Validator[]> {
  const config = NETWORK_CONFIGS[network];
  const json = await readDataFile<Validator[] | { validators?: Validator[] }>(
    config.validatorsFile
  );
  const validators = parseValidatorsFile(json);
  if (validators.length === 0) return [];

  const needsStakewiz =
    config.nameSource === "stakewiz-direct" ||
    config.nameSource === "sfdp-mainnet-bridge";

  const stakewizMap = new Map<string, string>();
  if (needsStakewiz) {
    try {
      const response = await fetch("https://api.stakewiz.com/validators");
      const data: StakewizValidator[] = await response.json();
      data.forEach((v) => stakewizMap.set(v.vote_identity, v.name));
    } catch (error) {
      console.error("Error fetching Stakewiz data:", error);
    }
  }

  const sfdpMap = new Map<
    string,
    { state: string; name: string; mainnetBetaPubkey: string }
  >();
  if (config.sfdpKeyField) {
    try {
      const response = await fetch(
        "https://api.solana.org/api/community/v1/sfdp_participants"
      );
      const data: SfdpParticipant[] = await response.json();
      data.forEach((p) => {
        const key = p[config.sfdpKeyField!];
        if (key) {
          sfdpMap.set(key, {
            state: p.state,
            name: p.name,
            mainnetBetaPubkey: p.mainnetBetaPubkey,
          });
        }
      });
    } catch (error) {
      console.error("Error fetching SFDP data:", error);
    }
  }

  const mainnetIdentityToVote = new Map<string, string>();
  if (config.nameSource === "sfdp-mainnet-bridge") {
    const mainnetJson = await readDataFile<
      Validator[] | { validators?: Validator[] }
    >(NETWORK_CONFIGS.mainnet.validatorsFile);
    parseValidatorsFile(mainnetJson).forEach((v) =>
      mainnetIdentityToVote.set(v.identityPubkey, v.voteAccountPubkey)
    );
  }

  const infraMap = new Map<
    string,
    {
      autonomousSystemNumber: number | null;
      dataCenterKey: string | null;
      softwareClient: string | null;
    }
  >();
  if (config.validatorsAppUrl) {
    try {
      const response = await fetch(config.validatorsAppUrl, {
        headers: {
          Token: process.env.VALIDATORS_APP_API_KEY || "",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data: ValidatorsAppValidator[] = await response.json();
        data.forEach((v) =>
          infraMap.set(v.vote_account, {
            autonomousSystemNumber: v.autonomous_system_number,
            dataCenterKey: v.data_center_key,
            softwareClient: v.software_client,
          })
        );
      }
    } catch (error) {
      console.error("Error fetching validators.app data:", error);
    }
  }

  return validators.map((v) => {
    const sfdpInfo = sfdpMap.get(v.identityPubkey);
    const infraInfo = infraMap.get(v.voteAccountPubkey);

    let name: string;
    if (config.nameSource === "stakewiz-direct") {
      name = stakewizMap.get(v.voteAccountPubkey) || "private validator";
    } else if (config.nameSource === "sfdp-mainnet-bridge") {
      name = resolveBridgedName(
        sfdpInfo?.mainnetBetaPubkey,
        sfdpInfo?.name,
        mainnetIdentityToVote,
        stakewizMap
      );
    } else {
      name = "unknown";
    }

    return {
      ...v,
      name,
      sfdp: !!sfdpInfo,
      sfdpState: sfdpInfo?.state ?? null,
      autonomousSystemNumber: infraInfo?.autonomousSystemNumber ?? null,
      dataCenterKey: infraInfo?.dataCenterKey ?? null,
      softwareClient: infraInfo?.softwareClient ?? null,
    };
  });
}

export async function loadUnstakedVersionCounts(
  network: Network,
  validators: Validator[]
): Promise<Record<string, number>> {
  const config = NETWORK_CONFIGS[network];
  const gossipNodes = await readDataFile<GossipNode[]>(config.gossipFile);
  if (!gossipNodes) return {};

  const stakedIdentities = new Set(validators.map((v) => v.identityPubkey));
  const counts: Record<string, number> = {};
  for (const node of gossipNodes) {
    if (stakedIdentities.has(node.identityPubkey)) continue;
    const version = node.version || "unknown";
    counts[version] = (counts[version] || 0) + 1;
  }
  return counts;
}
```

- [ ] **Step 4: Run tests to verify the pure-function tests now pass**

Run: `npm test -- src/lib/validatorData.test.ts`
Expected: the 5 new `resolveBridgedName` tests PASS. The existing `"testnet: matches SFDP by testnetPubkey, uses SFDP name, never calls Stakewiz"` test now FAILS (Stakewiz is fetched for testnet, but the test's `mockFetch.mockImplementation` throws on any URL it doesn't recognize, and it never mocked a `stakewiz` branch) — this is the expected, deliberate breakage fixed in the next step.

- [ ] **Step 5: Update the integration tests for the new testnet behavior**

In `src/lib/validatorData.test.ts`, replace the single test `"testnet: matches SFDP by testnetPubkey, uses SFDP name, never calls Stakewiz"` (currently lines 68-98) with these five tests:

```typescript
  it("testnet: prefers SFDP's own name field over the mainnet bridge when present", async () => {
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("testnet-validators.json")) {
        return Promise.resolve(
          JSON.stringify([{ ...rawValidator, identityPubkey: "tid1" }])
        );
      }
      if (filePath.includes("validators.json")) {
        return Promise.resolve(JSON.stringify([rawValidator]));
      }
      return Promise.reject(new Error(`unexpected read: ${filePath}`));
    });
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("stakewiz")) {
        return jsonResponse([{ vote_identity: "vote1", name: "Alice" }]);
      }
      if (url.includes("sfdp_participants")) {
        return jsonResponse([
          { mainnetBetaPubkey: "id1", testnetPubkey: "tid1", state: "Approved", name: "Alice SFDP" },
        ]);
      }
      if (url.includes("validators.app")) {
        return jsonResponse([]);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await loadEnrichedValidators("testnet");
    expect(result[0].name).toBe("Alice SFDP");
    expect(result[0].sfdp).toBe(true);
    expect(result[0].sfdpState).toBe("Approved");

    const fetchedUrls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(fetchedUrls.some((u) => u.includes("stakewiz"))).toBe(true);
    expect(
      fetchedUrls.some((u) => u.includes("validators.app/api/v1/validators/testnet.json"))
    ).toBe(true);
  });

  it("testnet: resolves a name via the mainnet bridge when SFDP has no own name", async () => {
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("testnet-validators.json")) {
        return Promise.resolve(
          JSON.stringify([{ ...rawValidator, identityPubkey: "tid1" }])
        );
      }
      if (filePath.includes("validators.json")) {
        return Promise.resolve(
          JSON.stringify([
            { ...rawValidator, identityPubkey: "id1", voteAccountPubkey: "mvote1" },
          ])
        );
      }
      return Promise.reject(new Error(`unexpected read: ${filePath}`));
    });
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("stakewiz")) {
        return jsonResponse([{ vote_identity: "mvote1", name: "Alice" }]);
      }
      if (url.includes("sfdp_participants")) {
        return jsonResponse([
          { mainnetBetaPubkey: "id1", testnetPubkey: "tid1", state: "Approved", name: "" },
        ]);
      }
      if (url.includes("validators.app")) {
        return jsonResponse([]);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await loadEnrichedValidators("testnet");
    expect(result[0].name).toBe("Alice");
  });

  it("testnet: falls back to 'private validator' when the bridge resolves but Stakewiz has no name", async () => {
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("testnet-validators.json")) {
        return Promise.resolve(
          JSON.stringify([{ ...rawValidator, identityPubkey: "tid1" }])
        );
      }
      if (filePath.includes("validators.json")) {
        return Promise.resolve(
          JSON.stringify([
            { ...rawValidator, identityPubkey: "id1", voteAccountPubkey: "mvote1" },
          ])
        );
      }
      return Promise.reject(new Error(`unexpected read: ${filePath}`));
    });
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("stakewiz")) {
        return jsonResponse([{ vote_identity: "mvote1", name: "" }]);
      }
      if (url.includes("sfdp_participants")) {
        return jsonResponse([
          { mainnetBetaPubkey: "id1", testnetPubkey: "tid1", state: "Approved", name: "" },
        ]);
      }
      if (url.includes("validators.app")) {
        return jsonResponse([]);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await loadEnrichedValidators("testnet");
    expect(result[0].name).toBe("private validator");
  });

  it("testnet: falls back to 'unknown' when there is no SFDP record for the validator", async () => {
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("testnet-validators.json")) {
        return Promise.resolve(
          JSON.stringify([{ ...rawValidator, identityPubkey: "tid-unmatched" }])
        );
      }
      if (filePath.includes("validators.json")) {
        return Promise.resolve(JSON.stringify([]));
      }
      return Promise.reject(new Error(`unexpected read: ${filePath}`));
    });
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("stakewiz")) return jsonResponse([]);
      if (url.includes("sfdp_participants")) return jsonResponse([]);
      if (url.includes("validators.app")) return jsonResponse([]);
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await loadEnrichedValidators("testnet");
    expect(result[0].name).toBe("unknown");
    expect(result[0].sfdp).toBe(false);
  });

  it("testnet: falls back to 'unknown' when the SFDP mainnetBetaPubkey doesn't match any current mainnet validator", async () => {
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("testnet-validators.json")) {
        return Promise.resolve(
          JSON.stringify([{ ...rawValidator, identityPubkey: "tid1" }])
        );
      }
      if (filePath.includes("validators.json")) {
        return Promise.resolve(JSON.stringify([]));
      }
      return Promise.reject(new Error(`unexpected read: ${filePath}`));
    });
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("stakewiz")) return jsonResponse([]);
      if (url.includes("sfdp_participants")) {
        return jsonResponse([
          { mainnetBetaPubkey: "id-retired", testnetPubkey: "tid1", state: "Retired", name: "" },
        ]);
      }
      if (url.includes("validators.app")) return jsonResponse([]);
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await loadEnrichedValidators("testnet");
    expect(result[0].name).toBe("unknown");
    expect(result[0].sfdp).toBe(true);
    expect(result[0].sfdpState).toBe("Retired");
  });
```

Leave the `"mainnet: ..."`, `"devnet: ..."`, `"returns [] when the data file is missing..."`, and `"still returns validators with fallbacks..."` tests untouched — their behavior is unaffected by this change.

- [ ] **Step 6: Run the full file's tests to verify everything passes**

Run: `npm test -- src/lib/validatorData.test.ts`
Expected: PASS — all tests (5 `resolveBridgedName` tests + 5 testnet integration tests + the 4 untouched tests + the 3 `loadUnstakedVersionCounts` tests).

- [ ] **Step 7: Run the full suite, lint, and build**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/validatorData.ts src/lib/validatorData.test.ts
git commit -m "fix: resolve testnet validator names via mainnet SFDP/Stakewiz bridge

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Full check suite**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 2: Manual walkthrough in `npm run dev`**

1. Start `npm run dev`.
2. Open `http://localhost:3000/?network=testnet`.
3. Confirm validator names now render for at least some rows (no longer 100% "unknown") — cross-check a few resolved names against the live Stakewiz API (`curl -s "https://api.stakewiz.com/validators" | grep -A2 "vote_identity"`) if you want to spot-check a specific validator.
4. Confirm validators with no resolvable mainnet counterpart still show "unknown" (not a crash, not a blank string).
5. Confirm mainnet (`/`) names are unaffected (still from Stakewiz directly) and devnet (`/?network=devnet`) still shows "unknown" for all rows.
6. `curl -s "http://localhost:3000/api/validators?network=testnet" | head -c 500` — confirm real names appear in the JSON response.

- [ ] **Step 3: Fix anything found, then finish**

If the walkthrough surfaces issues, fix and commit them individually. When clean, this plan is complete.
