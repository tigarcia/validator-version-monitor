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
