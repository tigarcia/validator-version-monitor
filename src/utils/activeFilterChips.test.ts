import { describe, it, expect } from "vitest";
import { deriveActiveFilterChips } from "./activeFilterChips";

const baseParams = {
  versionGroups: [] as { groupName: string; versionsInGroup: Set<string> }[],
  selectedVersions: new Set<string>(),
  selectedClients: new Set<string>(),
  selectedAsns: new Set<string>(),
  selectedDataCenters: new Set<string>(),
  sfdpFilter: "all",
  showUnstaked: false,
  getAsnLabel: (asn: string) => asn,
};

describe("deriveActiveFilterChips", () => {
  it("returns an empty list when nothing is active", () => {
    expect(deriveActiveFilterChips(baseParams)).toEqual([]);
  });

  it("returns one chip per version group with at least one selected version", () => {
    const chips = deriveActiveFilterChips({
      ...baseParams,
      versionGroups: [
        { groupName: "4.1", versionsInGroup: new Set(["4.1.1", "4.1.2"]) },
        { groupName: "4.2", versionsInGroup: new Set(["4.2.0"]) },
      ],
      selectedVersions: new Set(["4.1.1"]),
    });
    expect(chips).toEqual([{ type: "versionGroup", key: "4.1", label: "Version 4.1" }]);
  });

  it("returns one chip per selected client, asn, and data center", () => {
    const chips = deriveActiveFilterChips({
      ...baseParams,
      selectedClients: new Set(["Agave"]),
      selectedAsns: new Set(["16276"]),
      selectedDataCenters: new Set(["OVH SAS"]),
      getAsnLabel: (asn) => `ASN-${asn}`,
    });
    expect(chips).toEqual([
      { type: "client", key: "Agave", label: "Agave" },
      { type: "asn", key: "16276", label: "ASN-16276" },
      { type: "dataCenter", key: "OVH SAS", label: "OVH SAS" },
    ]);
  });

  it("labels known sfdp filter values and passes through custom states", () => {
    expect(deriveActiveFilterChips({ ...baseParams, sfdpFilter: "sfdp" })).toEqual([
      { type: "sfdp", key: "sfdp", label: "SFDP Participants" },
    ]);
    expect(deriveActiveFilterChips({ ...baseParams, sfdpFilter: "non-sfdp" })).toEqual([
      { type: "sfdp", key: "non-sfdp", label: "Non-SFDP" },
    ]);
    expect(deriveActiveFilterChips({ ...baseParams, sfdpFilter: "Retired" })).toEqual([
      { type: "sfdp", key: "Retired", label: "Retired" },
    ]);
  });

  it("omits an sfdp chip when the filter is 'all'", () => {
    expect(deriveActiveFilterChips({ ...baseParams, sfdpFilter: "all" })).toEqual([]);
  });

  it("returns an unstaked chip only when showUnstaked is true", () => {
    expect(deriveActiveFilterChips({ ...baseParams, showUnstaked: true })).toEqual([
      { type: "unstaked", key: "unstaked", label: "Unstaked nodes" },
    ]);
    expect(deriveActiveFilterChips({ ...baseParams, showUnstaked: false })).toEqual([]);
  });
});
