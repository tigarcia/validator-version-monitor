import { NextRequest, NextResponse } from "next/server";
import { parseNetwork } from "../../../lib/network";
import { loadEnrichedValidators } from "../../../lib/validatorData";

export async function GET(request: NextRequest) {
  try {
    const network = parseNetwork(request.nextUrl.searchParams.get("network"));
    const validators = await loadEnrichedValidators(network);
    return NextResponse.json(validators);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch validators" },
      { status: 500 }
    );
  }
}
