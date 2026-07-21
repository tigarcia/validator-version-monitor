"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Network, NETWORKS } from "../lib/network";

const LABELS: Record<Network, string> = {
  mainnet: "Mainnet",
  testnet: "Testnet",
  devnet: "Devnet",
};

export default function NetworkToggle({
  current,
  basePath = "/",
}: {
  current: Network;
  basePath?: string;
}) {
  const searchParams = useSearchParams();

  const hrefFor = (network: Network) => {
    const params = new URLSearchParams();
    if (network !== "mainnet") params.set("network", network);
    // Keep sort across network switches; version/infrastructure filters are
    // network-specific and intentionally dropped.
    const sort = searchParams.get("sort");
    const sortDir = searchParams.get("sortDir");
    if (sort && sortDir) {
      params.set("sort", sort);
      params.set("sortDir", sortDir);
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-300 text-sm">
      {NETWORKS.map((network) => (
        <Link
          key={network}
          href={hrefFor(network)}
          className={`px-4 py-2 transition-colors ${
            current === network
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          {LABELS[network]}
        </Link>
      ))}
    </div>
  );
}
