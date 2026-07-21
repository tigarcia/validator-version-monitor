import { describe, it, expect } from "vitest";
import { buildFilterQueryString, FilterState } from "./filterQueryString";

const emptyFilters: FilterState = {
  selectedVersions: new Set(),
  sfdpFilter: "all",
  sortKey: "activatedStake",
  sortDir: "desc",
  selectedClients: new Set(),
  selectedAsns: new Set(),
  selectedDataCenters: new Set(),
  showUnstaked: false,
};

describe("buildFilterQueryString", () => {
  it("returns empty string on mainnet with no filters", () => {
    expect(buildFilterQueryString(emptyFilters, "mainnet")).toBe("");
  });

  it("omits the network param on mainnet", () => {
    const qs = buildFilterQueryString(
      { ...emptyFilters, sfdpFilter: "sfdp" },
      "mainnet"
    );
    expect(qs).toBe("sfdp=sfdp");
  });

  it("preserves network when filters are set", () => {
    const qs = buildFilterQueryString(
      { ...emptyFilters, selectedVersions: new Set(["2.3.6"]) },
      "testnet"
    );
    expect(qs).toContain("network=testnet");
    expect(qs).toContain("versions=2.3.6");
  });

  it("keeps network=testnet when the last filter is removed", () => {
    // Regression guard: commit 48498483 fixed stale params when the last
    // filter was removed; the network param must survive that case.
    expect(buildFilterQueryString(emptyFilters, "testnet")).toBe("network=testnet");
  });

  it("includes sort params only when non-default", () => {
    const qs = buildFilterQueryString(
      { ...emptyFilters, sortKey: "version", sortDir: "asc" },
      "mainnet"
    );
    expect(qs).toBe("sort=version&sortDir=asc");
  });

  it("encodes unstaked and infrastructure filters like the existing effect", () => {
    const qs = buildFilterQueryString(
      {
        ...emptyFilters,
        showUnstaked: true,
        selectedClients: new Set(["Agave"]),
        selectedAsns: new Set(["24940"]),
        selectedDataCenters: new Set(["24940-DE"]),
      },
      "devnet"
    );
    const params = new URLSearchParams(qs);
    expect(params.get("network")).toBe("devnet");
    expect(params.get("unstaked")).toBe("1");
    expect(params.get("clients")).toBe("Agave");
    expect(params.get("asns")).toBe("24940");
    expect(params.get("datacenters")).toBe(encodeURIComponent("24940-DE"));
  });
});
