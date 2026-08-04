export interface ActiveFilterChip {
  type: "versionGroup" | "client" | "asn" | "dataCenter" | "sfdp" | "unstaked";
  key: string;
  label: string;
}

export function deriveActiveFilterChips(params: {
  versionGroups: { groupName: string; versionsInGroup: Set<string> }[];
  selectedVersions: Set<string>;
  selectedClients: Set<string>;
  selectedAsns: Set<string>;
  selectedDataCenters: Set<string>;
  sfdpFilter: string;
  showUnstaked: boolean;
  getAsnLabel: (asn: string) => string;
}): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  params.versionGroups.forEach((group) => {
    const hasSelection = Array.from(group.versionsInGroup).some((v) => params.selectedVersions.has(v));
    if (hasSelection) {
      chips.push({ type: "versionGroup", key: group.groupName, label: `Version ${group.groupName}` });
    }
  });

  params.selectedClients.forEach((client) => {
    chips.push({ type: "client", key: client, label: client });
  });

  params.selectedAsns.forEach((asn) => {
    chips.push({ type: "asn", key: asn, label: params.getAsnLabel(asn) });
  });

  params.selectedDataCenters.forEach((dc) => {
    chips.push({ type: "dataCenter", key: dc, label: dc });
  });

  if (params.sfdpFilter !== "all") {
    const label =
      params.sfdpFilter === "sfdp"
        ? "SFDP Participants"
        : params.sfdpFilter === "non-sfdp"
        ? "Non-SFDP"
        : params.sfdpFilter;
    chips.push({ type: "sfdp", key: params.sfdpFilter, label });
  }

  if (params.showUnstaked) {
    chips.push({ type: "unstaked", key: "unstaked", label: "Unstaked nodes" });
  }

  return chips;
}
