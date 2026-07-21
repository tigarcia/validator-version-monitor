# Network Switcher (Mainnet / Testnet / Devnet) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mainnet/testnet/devnet network switcher to the validator monitor with hourly data collection for all three networks and a network-aware key converter.

**Architecture:** A shared data layer (`src/lib/network.ts` + `src/lib/validatorData.ts`) replaces the enrichment logic currently duplicated between the page and API route; the selected network travels in a `?network=` query param (mainnet is the bare URL); the GitHub Action generates six data files with per-network failure isolation.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Vitest (new dev dependency, tests only).

**Spec:** `docs/plans/2026-07-21-network-switcher-design.md`

## Global Constraints

- Data file names are exact: `data/validators.json`, `data/gossip.json`, `data/testnet-validators.json`, `data/testnet-gossip.json`, `data/devnet-validators.json`, `data/devnet-gossip.json`.
- Mainnet is always the default network; invalid/missing `network` values resolve to mainnet.
- No new runtime dependencies. Vitest is the only new dev dependency.
- Existing code uses relative imports (`../lib/...`), not the `@/*` alias — follow that.
- Never manually edit `data/validators.json` (auto-generated); the new data files are auto-generated too after initial check-in.
- Enrichment per network: mainnet = Stakewiz + SFDP (`mainnetBetaPubkey`) + validators.app mainnet; testnet = SFDP (`testnetPubkey`, its `name` field supplies validator names) + validators.app testnet; devnet = none.
- All commits on branch `add-testnet-devnet`. End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Vitest setup + `src/lib/network.ts`

**Files:**
- Modify: `package.json` (add vitest + test script)
- Create: `src/lib/network.ts`
- Test: `src/lib/network.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (later tasks import these from `../lib/network` or `./network`):
  - `type Network = "mainnet" | "testnet" | "devnet"`
  - `const NETWORKS: Network[]` (order: mainnet, testnet, devnet)
  - `interface NetworkConfig { validatorsFile: string; gossipFile: string; stakewiz: boolean; sfdpKeyField: "mainnetBetaPubkey" | "testnetPubkey" | null; validatorsAppUrl: string | null }`
  - `const NETWORK_CONFIGS: Record<Network, NetworkConfig>`
  - `function parseNetwork(value: string | null | undefined): Network`

- [ ] **Step 1: Install vitest and add the test script**

```bash
npm install -D vitest
```

Then in `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/network.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseNetwork, NETWORK_CONFIGS, NETWORKS } from "./network";

describe("parseNetwork", () => {
  it("returns testnet for 'testnet'", () => {
    expect(parseNetwork("testnet")).toBe("testnet");
  });

  it("returns devnet for 'devnet'", () => {
    expect(parseNetwork("devnet")).toBe("devnet");
  });

  it("returns mainnet for 'mainnet'", () => {
    expect(parseNetwork("mainnet")).toBe("mainnet");
  });

  it("returns mainnet for undefined", () => {
    expect(parseNetwork(undefined)).toBe("mainnet");
  });

  it("returns mainnet for null", () => {
    expect(parseNetwork(null)).toBe("mainnet");
  });

  it("returns mainnet for unknown strings", () => {
    expect(parseNetwork("foo")).toBe("mainnet");
  });
});

describe("NETWORKS", () => {
  it("lists all three networks with mainnet first", () => {
    expect(NETWORKS).toEqual(["mainnet", "testnet", "devnet"]);
  });
});

describe("NETWORK_CONFIGS", () => {
  it("uses the correct data file names per network", () => {
    expect(NETWORK_CONFIGS.mainnet.validatorsFile).toBe("validators.json");
    expect(NETWORK_CONFIGS.mainnet.gossipFile).toBe("gossip.json");
    expect(NETWORK_CONFIGS.testnet.validatorsFile).toBe("testnet-validators.json");
    expect(NETWORK_CONFIGS.testnet.gossipFile).toBe("testnet-gossip.json");
    expect(NETWORK_CONFIGS.devnet.validatorsFile).toBe("devnet-validators.json");
    expect(NETWORK_CONFIGS.devnet.gossipFile).toBe("devnet-gossip.json");
  });

  it("only mainnet uses Stakewiz", () => {
    expect(NETWORK_CONFIGS.mainnet.stakewiz).toBe(true);
    expect(NETWORK_CONFIGS.testnet.stakewiz).toBe(false);
    expect(NETWORK_CONFIGS.devnet.stakewiz).toBe(false);
  });

  it("matches SFDP by the right pubkey field", () => {
    expect(NETWORK_CONFIGS.mainnet.sfdpKeyField).toBe("mainnetBetaPubkey");
    expect(NETWORK_CONFIGS.testnet.sfdpKeyField).toBe("testnetPubkey");
    expect(NETWORK_CONFIGS.devnet.sfdpKeyField).toBeNull();
  });

  it("uses per-network validators.app endpoints, none for devnet", () => {
    expect(NETWORK_CONFIGS.mainnet.validatorsAppUrl).toBe(
      "https://www.validators.app/api/v1/validators/mainnet.json?limit=9999"
    );
    expect(NETWORK_CONFIGS.testnet.validatorsAppUrl).toBe(
      "https://www.validators.app/api/v1/validators/testnet.json?limit=9999"
    );
    expect(NETWORK_CONFIGS.devnet.validatorsAppUrl).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/lib/network.test.ts`
Expected: FAIL — cannot resolve `./network` (module does not exist).

- [ ] **Step 4: Write the implementation**

Create `src/lib/network.ts`:

```typescript
export type Network = "mainnet" | "testnet" | "devnet";

export const NETWORKS: Network[] = ["mainnet", "testnet", "devnet"];

export interface NetworkConfig {
  validatorsFile: string;
  gossipFile: string;
  stakewiz: boolean;
  sfdpKeyField: "mainnetBetaPubkey" | "testnetPubkey" | null;
  validatorsAppUrl: string | null;
}

export const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
  mainnet: {
    validatorsFile: "validators.json",
    gossipFile: "gossip.json",
    stakewiz: true,
    sfdpKeyField: "mainnetBetaPubkey",
    validatorsAppUrl:
      "https://www.validators.app/api/v1/validators/mainnet.json?limit=9999",
  },
  testnet: {
    validatorsFile: "testnet-validators.json",
    gossipFile: "testnet-gossip.json",
    stakewiz: false,
    sfdpKeyField: "testnetPubkey",
    validatorsAppUrl:
      "https://www.validators.app/api/v1/validators/testnet.json?limit=9999",
  },
  devnet: {
    validatorsFile: "devnet-validators.json",
    gossipFile: "devnet-gossip.json",
    stakewiz: false,
    sfdpKeyField: null,
    validatorsAppUrl: null,
  },
};

export function parseNetwork(value: string | null | undefined): Network {
  if (value === "testnet" || value === "devnet") return value;
  return "mainnet";
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/network.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/network.ts src/lib/network.test.ts
git commit -m "feat: add network config module and vitest setup

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Shared data loader `src/lib/validatorData.ts`

**Files:**
- Create: `src/lib/validatorData.ts`
- Test: `src/lib/validatorData.test.ts`

**Interfaces:**
- Consumes: `Network`, `NETWORK_CONFIGS` from `./network`; `Validator` from `../types/validator`.
- Produces (imported by Task 4's page and Task 6's API route):
  - `loadEnrichedValidators(network: Network): Promise<Validator[]>` — reads the network's validators file, applies the enrichment matrix, returns `[]` on missing/corrupt file.
  - `loadUnstakedVersionCounts(network: Network, validators: Validator[]): Promise<Record<string, number>>` — reads the network's gossip file, counts versions of nodes whose identity is not in `validators`, returns `{}` on missing/corrupt file.

- [ ] **Step 1: Write the failing test**

Create `src/lib/validatorData.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs/promises";
import { loadEnrichedValidators, loadUnstakedVersionCounts } from "./validatorData";
import { Validator } from "../types/validator";

vi.mock("fs/promises", () => ({
  default: { readFile: vi.fn() },
}));

// Cast instead of vi.mocked(): fs.readFile's Buffer-returning overloads make
// mockResolvedValue(string) a type error otherwise.
const mockReadFile = fs.readFile as unknown as ReturnType<typeof vi.fn>;
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const rawValidator = {
  voteAccountPubkey: "vote1",
  identityPubkey: "id1",
  activatedStake: 1000,
  version: "2.3.6",
  delinquent: false,
} as Validator;

function jsonResponse(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadEnrichedValidators", () => {
  it("mainnet: enriches from Stakewiz, SFDP via mainnetBetaPubkey, and validators.app", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify([rawValidator]));
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
        return jsonResponse([
          {
            vote_account: "vote1",
            account: "id1",
            autonomous_system_number: 24940,
            data_center_key: "24940-DE",
            software_client: "Agave",
          },
        ]);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await loadEnrichedValidators("mainnet");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
    expect(result[0].sfdp).toBe(true);
    expect(result[0].sfdpState).toBe("Approved");
    expect(result[0].autonomousSystemNumber).toBe(24940);
    expect(result[0].dataCenterKey).toBe("24940-DE");
    expect(result[0].softwareClient).toBe("Agave");
  });

  it("testnet: matches SFDP by testnetPubkey, uses SFDP name, never calls Stakewiz", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify([{ ...rawValidator, identityPubkey: "tid1" }])
    );
    mockFetch.mockImplementation((url: string) => {
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
    expect(fetchedUrls.some((u) => u.includes("stakewiz"))).toBe(false);
    expect(
      fetchedUrls.some((u) => u.includes("validators.app/api/v1/validators/testnet.json"))
    ).toBe(true);
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining("testnet-validators.json"),
      "utf-8"
    );
  });

  it("devnet: makes no enrichment fetches and sets fallback fields", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify([rawValidator]));

    const result = await loadEnrichedValidators("devnet");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result[0].name).toBe("unknown");
    expect(result[0].sfdp).toBe(false);
    expect(result[0].sfdpState).toBeNull();
    expect(result[0].autonomousSystemNumber).toBeNull();
    expect(result[0].dataCenterKey).toBeNull();
    expect(result[0].softwareClient).toBeNull();
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining("devnet-validators.json"),
      "utf-8"
    );
  });

  it("returns [] when the data file is missing, without fetching", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    await expect(loadEnrichedValidators("testnet")).resolves.toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("still returns validators with fallbacks when enrichment fetches fail", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify([rawValidator]));
    mockFetch.mockRejectedValue(new Error("network down"));

    const result = await loadEnrichedValidators("mainnet");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("private validator");
    expect(result[0].sfdp).toBe(false);
    expect(result[0].autonomousSystemNumber).toBeNull();
  });
});

describe("loadUnstakedVersionCounts", () => {
  it("counts versions of gossip nodes not in the validator set", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify([
        { identityPubkey: "id1", version: "2.3.6" },
        { identityPubkey: "x1", version: "2.3.6" },
        { identityPubkey: "x2" },
      ])
    );
    const counts = await loadUnstakedVersionCounts("mainnet", [rawValidator]);
    expect(counts).toEqual({ "2.3.6": 1, unknown: 1 });
  });

  it("reads the network-specific gossip file", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify([]));
    await loadUnstakedVersionCounts("devnet", []);
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining("devnet-gossip.json"),
      "utf-8"
    );
  });

  it("returns {} when the gossip file is missing", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    await expect(loadUnstakedVersionCounts("mainnet", [])).resolves.toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/validatorData.test.ts`
Expected: FAIL — cannot resolve `./validatorData`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/validatorData.ts`:

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

export async function loadEnrichedValidators(
  network: Network
): Promise<Validator[]> {
  const config = NETWORK_CONFIGS[network];
  const json = await readDataFile<Validator[] | { validators?: Validator[] }>(
    config.validatorsFile
  );
  const validators: Validator[] = Array.isArray(json)
    ? json
    : json?.validators ?? [];
  if (validators.length === 0) return [];

  const stakewizMap = new Map<string, string>();
  if (config.stakewiz) {
    try {
      const response = await fetch("https://api.stakewiz.com/validators");
      const data: StakewizValidator[] = await response.json();
      data.forEach((v) => stakewizMap.set(v.vote_identity, v.name));
    } catch (error) {
      console.error("Error fetching Stakewiz data:", error);
    }
  }

  const sfdpMap = new Map<string, { state: string; name: string }>();
  if (config.sfdpKeyField) {
    try {
      const response = await fetch(
        "https://api.solana.org/api/community/v1/sfdp_participants"
      );
      const data: SfdpParticipant[] = await response.json();
      data.forEach((p) => {
        const key = p[config.sfdpKeyField!];
        if (key) sfdpMap.set(key, { state: p.state, name: p.name });
      });
    } catch (error) {
      console.error("Error fetching SFDP data:", error);
    }
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
    const name = config.stakewiz
      ? stakewizMap.get(v.voteAccountPubkey) || "private validator"
      : sfdpInfo?.name || "unknown";
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/validatorData.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validatorData.ts src/lib/validatorData.test.ts
git commit -m "feat: add shared network-aware validator data loader

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `buildFilterQueryString` helper

**Files:**
- Create: `src/utils/filterQueryString.ts`
- Test: `src/utils/filterQueryString.test.ts`

**Interfaces:**
- Consumes: `Network` from `../lib/network`.
- Produces (used by Task 5's ValidatorTable):
  - `interface FilterState { selectedVersions: Set<string>; sfdpFilter: string; sortKey: string; sortDir: "asc" | "desc"; selectedClients: Set<string>; selectedAsns: Set<string>; selectedDataCenters: Set<string>; showUnstaked: boolean }`
  - `buildFilterQueryString(filters: FilterState, network: Network): string` — returns a query string without the leading `?`, empty string when nothing to encode. Logic must exactly mirror the existing URL-sync effect in `ValidatorTable.tsx:92-123`, plus the `network` param (set first, omitted for mainnet).

- [ ] **Step 1: Write the failing test**

Create `src/utils/filterQueryString.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildFilterQueryString, FilterState } from "./filterQueryString";

const emptyFilters: FilterState = {
  selectedVersions: new Set(),
  sfdpFilter: "all",
  sortKey: "activatedStake",
  sortDir: "desc",
  selectedClients: new Set(),
  selectedAsns: new Set(),
  selectedDataCenters: new Set(),
  showUnstaked: false,
};

describe("buildFilterQueryString", () => {
  it("returns empty string on mainnet with no filters", () => {
    expect(buildFilterQueryString(emptyFilters, "mainnet")).toBe("");
  });

  it("omits the network param on mainnet", () => {
    const qs = buildFilterQueryString(
      { ...emptyFilters, sfdpFilter: "sfdp" },
      "mainnet"
    );
    expect(qs).toBe("sfdp=sfdp");
  });

  it("preserves network when filters are set", () => {
    const qs = buildFilterQueryString(
      { ...emptyFilters, selectedVersions: new Set(["2.3.6"]) },
      "testnet"
    );
    expect(qs).toContain("network=testnet");
    expect(qs).toContain("versions=2.3.6");
  });

  it("keeps network=testnet when the last filter is removed", () => {
    // Regression guard: commit 48498483 fixed stale params when the last
    // filter was removed; the network param must survive that case.
    expect(buildFilterQueryString(emptyFilters, "testnet")).toBe("network=testnet");
  });

  it("includes sort params only when non-default", () => {
    const qs = buildFilterQueryString(
      { ...emptyFilters, sortKey: "version", sortDir: "asc" },
      "mainnet"
    );
    expect(qs).toBe("sort=version&sortDir=asc");
  });

  it("encodes unstaked and infrastructure filters like the existing effect", () => {
    const qs = buildFilterQueryString(
      {
        ...emptyFilters,
        showUnstaked: true,
        selectedClients: new Set(["Agave"]),
        selectedAsns: new Set(["24940"]),
        selectedDataCenters: new Set(["24940-DE"]),
      },
      "devnet"
    );
    const params = new URLSearchParams(qs);
    expect(params.get("network")).toBe("devnet");
    expect(params.get("unstaked")).toBe("1");
    expect(params.get("clients")).toBe("Agave");
    expect(params.get("asns")).toBe("24940");
    expect(params.get("datacenters")).toBe(encodeURIComponent("24940-DE"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/filterQueryString.test.ts`
Expected: FAIL — cannot resolve `./filterQueryString`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/filterQueryString.ts`:

```typescript
import { Network } from "../lib/network";

export interface FilterState {
  selectedVersions: Set<string>;
  sfdpFilter: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  selectedClients: Set<string>;
  selectedAsns: Set<string>;
  selectedDataCenters: Set<string>;
  showUnstaked: boolean;
}

export function buildFilterQueryString(
  filters: FilterState,
  network: Network
): string {
  const params = new URLSearchParams();

  if (network !== "mainnet") {
    params.set("network", network);
  }
  if (filters.selectedVersions.size > 0) {
    params.set("versions", Array.from(filters.selectedVersions).join(","));
  }
  if (filters.sfdpFilter !== "all") {
    params.set("sfdp", filters.sfdpFilter);
  }
  if (filters.sortKey !== "activatedStake" || filters.sortDir !== "desc") {
    params.set("sort", filters.sortKey);
    params.set("sortDir", filters.sortDir);
  }
  if (filters.selectedClients.size > 0) {
    params.set("clients", Array.from(filters.selectedClients).join(","));
  }
  if (filters.selectedAsns.size > 0) {
    params.set("asns", Array.from(filters.selectedAsns).join(","));
  }
  if (filters.selectedDataCenters.size > 0) {
    params.set(
      "datacenters",
      encodeURIComponent(Array.from(filters.selectedDataCenters).join(","))
    );
  }
  if (filters.showUnstaked) {
    params.set("unstaked", "1");
  }

  return params.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/filterQueryString.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/filterQueryString.ts src/utils/filterQueryString.test.ts
git commit -m "feat: add network-aware filter query string helper

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `NetworkToggle` component + main page integration

**Files:**
- Create: `src/components/NetworkToggle.tsx`
- Modify: `src/app/page.tsx` (full rewrite shown below)

**Interfaces:**
- Consumes: `Network`, `NETWORKS`, `parseNetwork` from `src/lib/network`; `loadEnrichedValidators`, `loadUnstakedVersionCounts` from `src/lib/validatorData`.
- Produces:
  - `NetworkToggle` component, props `{ current: Network; basePath?: string }` (default basePath `"/"`). Client component using `useSearchParams` — must be rendered inside a `<Suspense>` boundary. Preserves `sort`/`sortDir` params across network switches; drops all other params (clears network-specific filters by design).
  - `page.tsx` passes `network: Network` prop and `key={network}` to `ValidatorTable` — Task 5 adds that prop to the component. **Note:** the app will not compile between Task 4 and Task 5; do Task 5 immediately after (same reviewer gate covers both — commit comes at the end of Task 5).

- [ ] **Step 1: Create the NetworkToggle component**

Create `src/components/NetworkToggle.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Network, NETWORKS } from "../lib/network";

const LABELS: Record<Network, string> = {
  mainnet: "Mainnet",
  testnet: "Testnet",
  devnet: "Devnet",
};

export default function NetworkToggle({
  current,
  basePath = "/",
}: {
  current: Network;
  basePath?: string;
}) {
  const searchParams = useSearchParams();

  const hrefFor = (network: Network) => {
    const params = new URLSearchParams();
    if (network !== "mainnet") params.set("network", network);
    // Keep sort across network switches; version/infrastructure filters are
    // network-specific and intentionally dropped.
    const sort = searchParams.get("sort");
    const sortDir = searchParams.get("sortDir");
    if (sort && sortDir) {
      params.set("sort", sort);
      params.set("sortDir", sortDir);
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-300 text-sm">
      {NETWORKS.map((network) => (
        <Link
          key={network}
          href={hrefFor(network)}
          className={`px-4 py-2 transition-colors ${
            current === network
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          {LABELS[network]}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the main page**

Replace the entire contents of `src/app/page.tsx` with:

```tsx
import { Suspense } from "react";
import Link from "next/link";
import ValidatorTable from "../components/ValidatorTable";
import NetworkToggle from "../components/NetworkToggle";
import { parseNetwork } from "../lib/network";
import {
  loadEnrichedValidators,
  loadUnstakedVersionCounts,
} from "../lib/validatorData";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ network?: string }>;
}) {
  const network = parseNetwork((await searchParams).network);
  const validators = await loadEnrichedValidators(network);
  const unstakedVersionCounts = await loadUnstakedVersionCounts(
    network,
    validators
  );

  return (
    <main className="min-h-screen bg-gray-100 px-8 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900">
          Solana Validator Version Monitor
        </h1>
        <Suspense fallback={null}>
          <NetworkToggle current={network} />
        </Suspense>
      </div>
      <Suspense
        fallback={<div className="text-center text-gray-500">Loading...</div>}
      >
        <ValidatorTable
          key={network}
          network={network}
          initialData={validators}
          unstakedVersionCounts={unstakedVersionCounts}
        />
      </Suspense>
      <div className="mt-4 flex justify-center">
        <Link
          href={network === "mainnet" ? "/convert" : `/convert?network=${network}`}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Key Converter
        </Link>
      </div>
    </main>
  );
}
```

Notes on non-obvious parts:
- `searchParams` is a `Promise` in Next.js 15 — it must be awaited.
- `key={network}` is load-bearing: `ValidatorTable` copies `initialData` into `useState` once on mount, so without a remount a network switch would keep showing the previous network's rows.
- The Key Converter link (moved from the header) carries the current network to `/convert`.

- [ ] **Step 3: Proceed directly to Task 5**

Do not run the build or commit yet — `page.tsx` now passes a `network` prop that `ValidatorTable` doesn't accept until Task 5.

---

### Task 5: `ValidatorTable` network awareness

**Files:**
- Modify: `src/components/ValidatorTable.tsx`

**Interfaces:**
- Consumes: `Network`, `NETWORK_CONFIGS` from `../lib/network`; `buildFilterQueryString` from `../utils/filterQueryString`.
- Produces: `ValidatorTable` props become `{ initialData: Validator[]; unstakedVersionCounts?: Record<string, number>; network: Network }`.

All edits below are to `src/components/ValidatorTable.tsx`.

- [ ] **Step 1: Add imports and the network prop**

Add imports after the existing ones (around line 9):

```typescript
import { Network, NETWORK_CONFIGS } from "../lib/network";
import { buildFilterQueryString } from "../utils/filterQueryString";
```

Change the component signature (lines 11-17) to:

```typescript
export default function ValidatorTable({
  initialData,
  unstakedVersionCounts = {},
  network,
}: {
  initialData: Validator[];
  unstakedVersionCounts?: Record<string, number>;
  network: Network;
}) {
```

Immediately after the `useState` declarations block (after the `copyNotification` state, around line 37), add:

```typescript
  const networkConfig = NETWORK_CONFIGS[network];
  const hasSfdp = networkConfig.sfdpKeyField !== null;
  const hasInfrastructure = networkConfig.validatorsAppUrl !== null;
```

- [ ] **Step 2: Replace the URL-sync effect with the helper**

Replace the entire second `useEffect` (lines 92-123, the one that builds `URLSearchParams` and calls `window.history.replaceState`) with:

```typescript
  // Update URL when filters change
  useEffect(() => {
    const queryString = buildFilterQueryString(
      {
        selectedVersions,
        sfdpFilter,
        sortKey: sortCfg.key,
        sortDir: sortCfg.dir,
        selectedClients,
        selectedAsns,
        selectedDataCenters,
        showUnstaked,
      },
      network
    );
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;

    // Update URL without causing a page reload
    window.history.replaceState({}, '', newUrl);
  }, [selectedVersions, sfdpFilter, sortCfg, selectedClients, selectedAsns, selectedDataCenters, showUnstaked, network]);
```

- [ ] **Step 3: Make clearAllFilters keep the network param**

In `clearAllFilters` (around line 410), replace the line:

```typescript
    window.history.replaceState({}, '', window.location.pathname);
```

with:

```typescript
    const base = network !== "mainnet" ? `?network=${network}` : window.location.pathname;
    window.history.replaceState({}, '', base);
```

- [ ] **Step 4: Hide SFDP and infrastructure controls when the network has no data**

a) Wrap the two infrastructure buttons (the `Infrastructure Columns` button and the `Infrastructure Filters` button, lines 528-542) in a conditional. They are currently two sibling `<button>` elements; change to:

```tsx
          {hasInfrastructure && (
            <>
              <button
                onClick={() => setShowInfrastructure(!showInfrastructure)}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 rounded transition-colors"
              >
                Infrastructure Columns {showInfrastructure ? '✓' : ''}
              </button>
              <button
                onClick={() => setShowInfrastructureFilter(!showInfrastructureFilter)}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 rounded transition-colors flex items-center gap-1"
              >
                <span>Infrastructure Filters</span>
                <span className={`transition-transform duration-200 ${showInfrastructureFilter ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
            </>
          )}
```

b) Wrap the SFDP `<label>` block (`SFDP Filter:` with its `<select>`, lines 544-560) in `{hasSfdp && ( ... )}` — the label content itself is unchanged.

c) In the "Matching stake" div, the SFDP-stake span is already conditional on `sfdpFilter !== "all"`, which can't be true when the dropdown is hidden — no change needed.

d) Change the infrastructure filter panel condition (line 675) from:

```tsx
      {showInfrastructureFilter && (
```

to:

```tsx
      {showInfrastructureFilter && hasInfrastructure && (
```

(Guards against `?clients=...`-style URL params force-opening the panel on devnet.)

- [ ] **Step 5: Verify tests, lint, and build**

Run: `npm test && npm run lint && npm run build`
Expected: tests PASS, lint clean, build succeeds.

- [ ] **Step 6: Commit Tasks 4+5 together**

```bash
git add src/components/NetworkToggle.tsx src/app/page.tsx src/components/ValidatorTable.tsx
git commit -m "feat: add network switcher toggle and network-aware validator table

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Network-aware API route

**Files:**
- Modify: `src/app/api/validators/route.ts` (full rewrite — the enrichment logic moves to the shared loader)

**Interfaces:**
- Consumes: `parseNetwork` from `src/lib/network`; `loadEnrichedValidators` from `src/lib/validatorData`.
- Produces: `GET /api/validators?network=<mainnet|testnet|devnet>` returning `Validator[]` JSON; missing/invalid param serves mainnet (unchanged behavior for existing callers).

- [ ] **Step 1: Rewrite the route**

Replace the entire contents of `src/app/api/validators/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { parseNetwork } from "../../../lib/network";
import { loadEnrichedValidators } from "../../../lib/validatorData";

export async function GET(request: NextRequest) {
  try {
    const network = parseNetwork(request.nextUrl.searchParams.get("network"));
    const validators = await loadEnrichedValidators(network);
    return NextResponse.json(validators);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch validators" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify with the dev server**

Run: `npm run dev` in the background, then:

```bash
curl -s "http://localhost:3000/api/validators" | head -c 300
curl -s "http://localhost:3000/api/validators?network=devnet" | head -c 300
```

Expected: first returns mainnet validators (names from Stakewiz); second returns `[]` until devnet data files exist (Task 8), or devnet validators with `"name":"unknown"` after they do. No 500s.

- [ ] **Step 3: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS / build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/validators/route.ts
git commit -m "feat: make /api/validators network-aware via shared loader

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Network-aware Key Converter

**Files:**
- Create: `src/app/convert/ConvertClient.tsx` (receives the body of the current page)
- Modify: `src/app/convert/page.tsx` (becomes a thin server wrapper)

**Interfaces:**
- Consumes: `NetworkToggle` (`{ current, basePath }`), `parseNetwork`, `Network`.
- Produces: `/convert?network=<x>` converts keys against that network's validator set.

- [ ] **Step 1: Create ConvertClient from the existing page**

Create `src/app/convert/ConvertClient.tsx` containing the entire current contents of `src/app/convert/page.tsx`, with these exact changes:

a) Change the component declaration from:

```tsx
export default function ConvertPage() {
```

to:

```tsx
export default function ConvertClient({ network }: { network: Network }) {
```

and add to the imports:

```tsx
import NetworkToggle from "../../components/NetworkToggle";
import { Network } from "../../lib/network";
```

b) Change the fetch line inside `convertKeys` from:

```typescript
      const response = await fetch("/api/validators");
```

to:

```typescript
      const response = await fetch(
        network === "mainnet" ? "/api/validators" : `/api/validators?network=${network}`
      );
```

c) Replace the header block (the `div` with the Back link and `<h1>`):

```tsx
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            ← Back to Explorer
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Key Converter</h1>
        </div>
```

with:

```tsx
        <div className="flex items-center gap-4 mb-6">
          <Link
            href={network === "mainnet" ? "/" : `/?network=${network}`}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            ← Back to Explorer
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Key Converter</h1>
          <div className="ml-auto">
            <NetworkToggle current={network} basePath="/convert" />
          </div>
        </div>
```

Everything else in the file stays byte-identical.

- [ ] **Step 2: Rewrite the page as a server wrapper**

Replace the entire contents of `src/app/convert/page.tsx` with:

```tsx
import { Suspense } from "react";
import ConvertClient from "./ConvertClient";
import { parseNetwork } from "../../lib/network";

export default async function ConvertPage({
  searchParams,
}: {
  searchParams: Promise<{ network?: string }>;
}) {
  const network = parseNetwork((await searchParams).network);
  return (
    <Suspense fallback={null}>
      <ConvertClient key={network} network={network} />
    </Suspense>
  );
}
```

(`key={network}` clears stale conversion results when switching networks; the `Suspense` boundary is required because `NetworkToggle` uses `useSearchParams`.)

- [ ] **Step 3: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: clean / succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/convert/page.tsx src/app/convert/ConvertClient.tsx
git commit -m "feat: make key converter network-aware

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: GitHub workflow + initial data files + docs

**Files:**
- Modify: `.github/workflows/update-validators.yml` (full rewrite shown below)
- Create: `data/testnet-validators.json`, `data/testnet-gossip.json`, `data/devnet-validators.json`, `data/devnet-gossip.json` (generated, not hand-written)
- Modify: `CLAUDE.md` (data flow + commands sections)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: the six data files the loaders in Task 2 read.

- [ ] **Step 1: Rewrite the workflow**

Replace the entire contents of `.github/workflows/update-validators.yml` with:

```yaml
name: Update validator data

on:
  schedule:
    - cron: '0 * * * *'   # every hour (UTC)
  workflow_dispatch:       # allow manual runs

permissions:
  contents: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Solana CLI
        run: |
          sh -c "$(curl -sSfL https://release.anza.xyz/v3.0.6/install)"
          echo "$HOME/.local/share/solana/install/active_release/bin" >> "$GITHUB_PATH"

      - name: Generate data files
        run: |
          # Each network updates independently: write to a temp file and only
          # replace the committed file if the CLI succeeded and produced valid
          # JSON, so a flaky testnet/devnet RPC can't wipe a file or block the
          # other networks.
          update() {
            local file="$1"; shift
            local tmp
            tmp=$(mktemp)
            if solana "$@" > "$tmp" && jq -e . "$tmp" > /dev/null; then
              mv "$tmp" "data/$file"
            else
              echo "WARN: failed to update data/$file; keeping previous version"
              rm -f "$tmp"
            fi
          }
          update validators.json         -um validators --output json-compact
          update gossip.json             -um gossip --output json
          update testnet-validators.json -ut validators --output json-compact
          update testnet-gossip.json     -ut gossip --output json-compact
          update devnet-validators.json  -ud validators --output json-compact
          update devnet-gossip.json      -ud gossip --output json-compact

      - name: Commit and push if changed
        run: |
          if [[ -n "$(git status --porcelain data/)" ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add data/
            git commit -m "update validator data $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
            git push
          else
            echo "No changes; skipping commit."
          fi
```

(`jq` is preinstalled on `ubuntu-latest` runners. Mainnet gossip keeps `--output json` to match the existing committed file; the new files use `json-compact` per the spec.)

- [ ] **Step 2: Generate initial testnet/devnet data files locally**

Check for the CLI first:

```bash
which solana
```

If present:

```bash
cd /Users/tim/Documents/Crypto/validator-monitor-ui
solana -ut validators --output json-compact > data/testnet-validators.json
solana -ut gossip --output json-compact > data/testnet-gossip.json
solana -ud validators --output json-compact > data/devnet-validators.json
solana -ud gossip --output json-compact > data/devnet-gossip.json
```

Validate each: `for f in data/testnet-*.json data/devnet-*.json; do jq -e . "$f" > /dev/null && echo "OK $f"; done` — all four must print OK. Public testnet/devnet RPCs can be flaky; retry a failed command once or twice before giving up.

If the CLI is not installed or a network is unreachable: skip that file (do NOT commit an empty or partial file — delete it). The app renders "No data found" for a missing file, and the hourly workflow will create it on its first run after merge.

Note: `data/gossip.json` is currently untracked locally (the workflow commits it on GitHub). Include it in this commit so the local branch matches what the loaders expect.

- [ ] **Step 3: Verify in the dev server**

Run `npm run dev`, open `http://localhost:3000/?network=testnet` and `?network=devnet`.
Expected: testnet shows validators (SFDP names where matched, otherwise "unknown"); devnet shows validators with "unknown" names and no SFDP dropdown or Infrastructure buttons; the Unstaked Nodes toggle shows gossip counts for whichever networks have gossip files.

- [ ] **Step 4: Update CLAUDE.md**

In `CLAUDE.md`:

a) Replace the first item under **Data Flow** with:

```markdown
1. **Validator Data Source**: `data/*.json` files are automatically updated hourly via GitHub Actions (`.github/workflows/update-validators.yml`) using the Solana CLI. Per network: `validators.json`/`gossip.json` (mainnet, `-um`), `testnet-validators.json`/`testnet-gossip.json` (`-ut`), `devnet-validators.json`/`devnet-gossip.json` (`-ud`).
```

b) Under **Development Commands**, add after the lint entry:

```bash
# Run unit tests (vitest)
npm test
```

c) In the **Enrichment Pattern** bullet, note that enrichment now lives in `src/lib/validatorData.ts` (shared by `src/app/page.tsx` and the API route) and is network-aware: mainnet = Stakewiz + SFDP + validators.app; testnet = SFDP (via `testnetPubkey`, supplies names) + validators.app testnet; devnet = raw data only.

d) In **Important Notes**, change "do not manually edit `data/validators.json`" to cover all six generated data files.

- [ ] **Step 5: Final verification**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/update-validators.yml data/*.json CLAUDE.md
git commit -m "ci: collect testnet and devnet validator and gossip data hourly

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Full check suite**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 2: Manual walkthrough in `npm run dev`**

1. `/` — mainnet table renders with names, SFDP dropdown, Infrastructure buttons; segmented toggle top-right shows Mainnet active; Key Converter link at the bottom.
2. Click **Testnet** — URL becomes `/?network=testnet`, table shows testnet validators, filters are cleared.
3. On testnet, select a version filter — URL contains both `network=testnet` and `versions=...`. Deselect it — URL is exactly `/?network=testnet` (network survives last-filter removal).
4. On testnet, sort by version, then click **Devnet** — sort params survive in the URL; SFDP dropdown and Infrastructure buttons are absent on devnet.
5. Click **Clear All Filters** on testnet with filters set — filters reset, URL keeps `network=testnet`.
6. Toggle **Unstaked Nodes** on testnet — gossip version counts render.
7. Export CSV on devnet — file downloads with validator rows.
8. Bottom **Key Converter** link from devnet — lands on `/convert?network=devnet` with Devnet active in the toggle; paste a devnet identity key and convert; switch the toggle to Mainnet and convert a mainnet key.
9. `curl -s "http://localhost:3000/api/validators?network=testnet" | head -c 200` — returns testnet JSON.

- [ ] **Step 3: Fix anything found, then finish**

If the walkthrough surfaces issues, fix and commit them individually. When clean, this plan is complete — use superpowers:finishing-a-development-branch to decide merge/PR next steps (after merge, trigger the workflow once via `workflow_dispatch` and confirm all six data files update).
