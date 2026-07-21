import { Suspense } from "react";
import Link from "next/link";
import ValidatorTable from "../components/ValidatorTable";
import NetworkToggle from "../components/NetworkToggle";
import { parseNetwork } from "../lib/network";
import {
  loadEnrichedValidators,
  loadUnstakedVersionCounts,
} from "../lib/validatorData";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ network?: string }>;
}) {
  const network = parseNetwork((await searchParams).network);
  const validators = await loadEnrichedValidators(network);
  const unstakedVersionCounts = await loadUnstakedVersionCounts(
    network,
    validators
  );

  return (
    <main className="min-h-screen bg-gray-100 px-8 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900">
          Solana Validator Version Monitor
        </h1>
        <Suspense fallback={null}>
          <NetworkToggle current={network} />
        </Suspense>
      </div>
      <Suspense
        fallback={<div className="text-center text-gray-500">Loading...</div>}
      >
        <ValidatorTable
          key={network}
          network={network}
          initialData={validators}
          unstakedVersionCounts={unstakedVersionCounts}
        />
      </Suspense>
      <div className="mt-4 flex justify-center">
        <Link
          href={network === "mainnet" ? "/convert" : `/convert?network=${network}`}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Key Converter
        </Link>
      </div>
    </main>
  );
}
