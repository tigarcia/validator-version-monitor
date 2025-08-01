import fs from "fs/promises";
import path from "path";
import ValidatorTable from "../components/ValidatorTable";

export default async function Home() {
  const filePath = path.join(process.cwd(), "data", "validators.json");
  let validators: any[] = [];
  let stakewizData: any[] = [];
  let sfdpData: any[] = [];

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
      <h1 className="text-3xl font-bold mb-4">Solana Validator Explorer (SSR demo)</h1>
      <ValidatorTable initialData={enrichedValidators} />
    </main>
  );
}