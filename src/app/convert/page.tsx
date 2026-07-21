import { Suspense } from "react";
import ConvertClient from "./ConvertClient";
import { parseNetwork } from "../../lib/network";

export default async function ConvertPage({
  searchParams,
}: {
  searchParams: Promise<{ network?: string }>;
}) {
  const network = parseNetwork((await searchParams).network);
  return (
    <Suspense fallback={null}>
      <ConvertClient key={network} network={network} />
    </Suspense>
  );
}
