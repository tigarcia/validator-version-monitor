import fs from "fs/promises";
import path from "path";
import ValidatorTable from "../components/ValidatorTable";

export default async function Home() {
  const filePath = path.join(process.cwd(), "data", "validators.json");
  let validators: any[] = [];
  let stakewizData: any[] = [];

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(raw);
    validators = Array.isArray(json) ? json : json.validators ?? [];

    const stakewizResponse = await fetch("https://api.stakewiz.com/validators");
    stakewizData = await stakewizResponse.json();
  } catch (error) {
    console.error("Error fetching data:", error);
    // file missing or bad JSON → empty list
  }

  const stakewizMap = new Map();
  stakewizData.forEach((validator) => {
    stakewizMap.set(validator.vote_identity, validator.name);
  });

  const enrichedValidators = validators.map((v) => ({
    ...v,
    name: stakewizMap.get(v.voteAccountPubkey) || "private validator",
  }));

  return (
    <main className="min-h-screen bg-gray-100 px-8 py-4">
      <h1 className="text-3xl font-bold mb-4">Solana Validator Explorer (SSR demo)</h1>
      <ValidatorTable initialData={enrichedValidators} />
    </main>
  );
}