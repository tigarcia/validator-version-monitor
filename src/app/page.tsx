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

export default async function Home() {
  const filePath = path.join(process.cwd(), "data", "validators.json");
  let validators: Validator[] = [];
  let stakewizData: StakewizValidator[] = [];
  let sfdpData: SfdpParticipant[] = [];

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

  // Enrich validators with both Stakewiz and SFDP data
  const enrichedValidators = validators.map((v) => {
    const sfdpInfo = sfdpMap.get(v.identityPubkey);
    return {
      ...v,
      name: stakewizMap.get(v.voteAccountPubkey) || "private validator",
      sfdp: sfdpInfo ? sfdpInfo.sfdp : false,
      sfdpState: sfdpInfo ? sfdpInfo.state : null,
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