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

  it("uses the right name resolution strategy per network", () => {
    expect(NETWORK_CONFIGS.mainnet.nameSource).toBe("stakewiz-direct");
    expect(NETWORK_CONFIGS.testnet.nameSource).toBe("sfdp-mainnet-bridge");
    expect(NETWORK_CONFIGS.devnet.nameSource).toBe("none");
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
