import fs from "fs/promises";
import path from "path";
import { Suspense } from "react";
import ValidatorTable from "../components/ValidatorTable";
import { Validator } from "../types/validator";
import Link from "next/link";

interface StakewizValidator {
  vote_identity: string;
  name: string;
}

interface SfdpParticipant {
  mainnetBetaPubkey: string;
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

export default async function Home() {
  const filePath = path.join(process.cwd(), "data", "validators.json");
  let validators: Validator[] = [];
  let stakewizData: StakewizValidator[] = [];
  let sfdpData: SfdpParticipant[] = [];
  let validatorsAppData: ValidatorsAppValidator[] = [];

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(raw);
    validators = Array.isArray(json) ? json : json.validators ?? [];

    // Fetch Stakewiz data
    const stakewizResponse = await fetch("https://api.stakewiz.com/validators");
    stakewizData = await stakewizResponse.json();

    // Fetch SFDP data
    const sfdpResponse = await fetch("https://api.solana.org/api/community/v1/sfdp_participants");
    sfdpData = await sfdpResponse.json();

    // Fetch validators.app infrastructure data
    try {
      const validatorsAppResponse = await fetch(
        "https://www.validators.app/api/v1/validators/mainnet.json?limit=9999",
        {
          headers: {
            Token: process.env.VALIDATORS_APP_API_KEY || "",
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (validatorsAppResponse.ok) {
        validatorsAppData = await validatorsAppResponse.json();
      }
    } catch (error) {
      console.error("Error fetching validators.app data:", error);
      // Continue with empty infrastructure data
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    // file missing or bad JSON → empty list
  }

  // Create maps for efficient lookup
  const stakewizMap = new Map();
  stakewizData.forEach((validator) => {
    stakewizMap.set(validator.vote_identity, validator.name);
  });

  const sfdpMap = new Map();
  sfdpData.forEach((participant) => {
    sfdpMap.set(participant.mainnetBetaPubkey, {
      sfdp: true,
      state: participant.state,
    });
  });

  const validatorsAppMap = new Map();
  validatorsAppData.forEach((validator) => {
    validatorsAppMap.set(validator.vote_account, {
      autonomousSystemNumber: validator.autonomous_system_number,
      dataCenterKey: validator.data_center_key,
      softwareClient: validator.software_client,
    });
  });

  // Enrich validators with Stakewiz, SFDP, and infrastructure data
  const enrichedValidators = validators.map((v) => {
    const sfdpInfo = sfdpMap.get(v.identityPubkey);
    const infraInfo = validatorsAppMap.get(v.voteAccountPubkey);
    return {
      ...v,
      name: stakewizMap.get(v.voteAccountPubkey) || "private validator",
      sfdp: sfdpInfo ? sfdpInfo.sfdp : false,
      sfdpState: sfdpInfo ? sfdpInfo.state : null,
      autonomousSystemNumber: infraInfo?.autonomousSystemNumber ?? null,
      dataCenterKey: infraInfo?.dataCenterKey ?? null,
      softwareClient: infraInfo?.softwareClient ?? null,
    };
  });

  return (
    <main className="min-h-screen bg-gray-100 px-8 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Solana Validator Version Monitor</h1>
        <Link
          href="/convert"
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Key Converter
        </Link>
      </div>
      <Suspense fallback={<div className="text-center text-gray-500">Loading...</div>}>
        <ValidatorTable initialData={enrichedValidators} />
      </Suspense>
    </main>
  );
}