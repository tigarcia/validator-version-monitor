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
