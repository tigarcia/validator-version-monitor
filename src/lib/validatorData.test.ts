import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs/promises";
import { loadEnrichedValidators, loadUnstakedVersionCounts, resolveBridgedName } from "./validatorData";
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

  it("initiates the Stakewiz, SFDP, and validators.app requests concurrently rather than sequentially", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify([rawValidator]));

    const pendingResolvers: Record<string, (value: unknown) => void> = {};
    mockFetch.mockImplementation((url: string) => {
      return new Promise((resolve) => {
        if (url.includes("stakewiz")) pendingResolvers.stakewiz = resolve;
        else if (url.includes("sfdp_participants")) pendingResolvers.sfdp = resolve;
        else if (url.includes("validators.app")) pendingResolvers.infra = resolve;
        else throw new Error(`unexpected fetch: ${url}`);
      });
    });

    const promise = loadEnrichedValidators("mainnet");

    // Flush pending microtasks (the readFile await + JSON.parse) without
    // resolving any fetch. If the three requests are fired sequentially,
    // only the first fetch will have been called at this point.
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledTimes(3);

    pendingResolvers.stakewiz(jsonResponse([]));
    pendingResolvers.sfdp(jsonResponse([]));
    pendingResolvers.infra(jsonResponse([]));

    await promise;
  });

  it("requests enrichment data with short-lived caching instead of an uncached fetch on every request", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify([rawValidator]));
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("stakewiz")) return jsonResponse([]);
      if (url.includes("sfdp_participants")) return jsonResponse([]);
      if (url.includes("validators.app")) return jsonResponse([]);
      throw new Error(`unexpected fetch: ${url}`);
    });

    await loadEnrichedValidators("mainnet");

    for (const [url, options] of mockFetch.mock.calls as [string, RequestInit][]) {
      expect(
        options?.next && typeof (options.next as { revalidate?: number }).revalidate === "number",
        `expected a next.revalidate option on fetch to ${url}`
      ).toBe(true);
    }
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
