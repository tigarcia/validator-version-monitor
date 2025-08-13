import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { Validator } from "../../../types/validator";

interface StakewizValidator {
  vote_identity: string;
  name: string;
}

interface SfdpParticipant {
  mainnetBetaPubkey: string;
  state: string;
  name: string;
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "validators.json");
    let validators: Validator[] = [];
    let stakewizData: StakewizValidator[] = [];
    let sfdpData: SfdpParticipant[] = [];

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const json = JSON.parse(raw);
      validators = Array.isArray(json) ? json : json.validators ?? [];

      // Fetch Stakewiz data
      const stakewizResponse = await fetch(
        "https://api.stakewiz.com/validators"
      );
      stakewizData = await stakewizResponse.json();

      // Fetch SFDP data
      const sfdpResponse = await fetch(
        "https://api.solana.org/api/community/v1/sfdp_participants"
      );
      sfdpData = await sfdpResponse.json();
    } catch (error) {
      console.error("Error fetching data:", error);
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

    return NextResponse.json(enrichedValidators);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch validators" },
      { status: 500 }
    );
  }
}
