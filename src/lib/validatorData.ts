import fs from "fs/promises";
import path from "path";
import { Validator } from "../types/validator";
import { Network, NetworkConfig, NETWORK_CONFIGS } from "./network";

// data/*.json only refreshes hourly, so short-lived caching of the external
// enrichment sources doesn't add meaningful staleness but avoids repeating
// ~3s of external HTTP round-trips on every network switch. Cached in-process
// (rather than via Next.js's `fetch` data cache) because the Stakewiz and
// SFDP payloads exceed that cache's 2MB per-item limit.
const ENRICHMENT_CACHE_TTL_MS = 60_000;
const enrichmentResponseCache = new Map<string, { data: unknown; expiresAt: number }>();

export function clearEnrichmentCache(): void {
  enrichmentResponseCache.clear();
}

async function fetchJsonCached<T>(url: string, init: RequestInit): Promise<T> {
  const cached = enrichmentResponseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} responded with ${response.status}`);
  }
  const data = (await response.json()) as T;
  enrichmentResponseCache.set(url, {
    data,
    expiresAt: Date.now() + ENRICHMENT_CACHE_TTL_MS,
  });
  return data;
}

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

async function fetchStakewizMap(needed: boolean): Promise<Map<string, string>> {
  const stakewizMap = new Map<string, string>();
  if (!needed) return stakewizMap;
  try {
    const data = await fetchJsonCached<StakewizValidator[]>(
      "https://api.stakewiz.com/validators",
      { signal: AbortSignal.timeout(10000) }
    );
    data.forEach((v) => stakewizMap.set(v.vote_identity, v.name));
  } catch (error) {
    console.error("Error fetching Stakewiz data:", error);
  }
  return stakewizMap;
}

async function fetchSfdpMap(
  config: NetworkConfig
): Promise<Map<string, { state: string; name: string; mainnetBetaPubkey: string }>> {
  const sfdpMap = new Map<
    string,
    { state: string; name: string; mainnetBetaPubkey: string }
  >();
  if (!config.sfdpKeyField) return sfdpMap;
  try {
    const data = await fetchJsonCached<SfdpParticipant[]>(
      "https://api.solana.org/api/community/v1/sfdp_participants",
      { signal: AbortSignal.timeout(10000) }
    );
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
  return sfdpMap;
}

async function loadMainnetIdentityToVote(
  config: NetworkConfig
): Promise<Map<string, string>> {
  const mainnetIdentityToVote = new Map<string, string>();
  if (config.nameSource !== "sfdp-mainnet-bridge") return mainnetIdentityToVote;
  const mainnetJson = await readDataFile<
    Validator[] | { validators?: Validator[] }
  >(NETWORK_CONFIGS.mainnet.validatorsFile);
  parseValidatorsFile(mainnetJson).forEach((v) =>
    mainnetIdentityToVote.set(v.identityPubkey, v.voteAccountPubkey)
  );
  return mainnetIdentityToVote;
}

async function fetchInfraMap(config: NetworkConfig): Promise<
  Map<
    string,
    {
      autonomousSystemNumber: number | null;
      dataCenterKey: string | null;
      softwareClient: string | null;
    }
  >
> {
  const infraMap = new Map<
    string,
    {
      autonomousSystemNumber: number | null;
      dataCenterKey: string | null;
      softwareClient: string | null;
    }
  >();
  if (!config.validatorsAppUrl) return infraMap;
  try {
    const data = await fetchJsonCached<ValidatorsAppValidator[]>(
      config.validatorsAppUrl,
      {
        headers: {
          Token: process.env.VALIDATORS_APP_API_KEY || "",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    data.forEach((v) =>
      infraMap.set(v.vote_account, {
        autonomousSystemNumber: v.autonomous_system_number,
        dataCenterKey: v.data_center_key,
        softwareClient: v.software_client,
      })
    );
  } catch (error) {
    console.error("Error fetching validators.app data:", error);
  }
  return infraMap;
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

  const [stakewizMap, sfdpMap, mainnetIdentityToVote, infraMap] =
    await Promise.all([
      fetchStakewizMap(needsStakewiz),
      fetchSfdpMap(config),
      loadMainnetIdentityToVote(config),
      fetchInfraMap(config),
    ]);

  return validators.map((v) => {
    const sfdpInfo = sfdpMap.get(v.identityPubkey);
    const infraInfo = infraMap.get(v.voteAccountPubkey);

    let name: string;
    switch (config.nameSource) {
      case "stakewiz-direct":
        name = stakewizMap.get(v.voteAccountPubkey) || "private validator";
        break;
      case "sfdp-mainnet-bridge":
        name = resolveBridgedName(
          sfdpInfo?.mainnetBetaPubkey,
          sfdpInfo?.name,
          mainnetIdentityToVote,
          stakewizMap
        );
        break;
      case "none":
        name = "unknown";
        break;
      default: {
        const exhaustiveCheck: never = config.nameSource;
        throw new Error(`Unhandled nameSource: ${exhaustiveCheck}`);
      }
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
