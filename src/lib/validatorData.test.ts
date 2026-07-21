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
