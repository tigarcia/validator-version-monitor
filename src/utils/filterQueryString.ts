import { Network } from "../lib/network";

export interface FilterState {
  selectedVersions: Set<string>;
  sfdpFilter: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  selectedClients: Set<string>;
  selectedAsns: Set<string>;
  selectedDataCenters: Set<string>;
  showUnstaked: boolean;
}

export function buildFilterQueryString(
  filters: FilterState,
  network: Network
): string {
  const params = new URLSearchParams();

  if (network !== "mainnet") {
    params.set("network", network);
  }
  if (filters.selectedVersions.size > 0) {
    params.set("versions", Array.from(filters.selectedVersions).join(","));
  }
  if (filters.sfdpFilter !== "all") {
    params.set("sfdp", filters.sfdpFilter);
  }
  if (filters.sortKey !== "activatedStake" || filters.sortDir !== "desc") {
    params.set("sort", filters.sortKey);
    params.set("sortDir", filters.sortDir);
  }
  if (filters.selectedClients.size > 0) {
    params.set("clients", Array.from(filters.selectedClients).join(","));
  }
  if (filters.selectedAsns.size > 0) {
    params.set("asns", Array.from(filters.selectedAsns).join(","));
  }
  if (filters.selectedDataCenters.size > 0) {
    params.set(
      "datacenters",
      encodeURIComponent(Array.from(filters.selectedDataCenters).join(","))
    );
  }
  if (filters.showUnstaked) {
    params.set("unstaked", "1");
  }

  return params.toString();
}
