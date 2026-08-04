import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { getAsnDisplay } from "../utils/asnLookup";
import type { VersionGroupStat, UnstakedVersionGroupStat, StatItem } from "../types/filterStats";

interface FilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;

  versionGroups: VersionGroupStat[];
  selectedVersions: Set<string>;
  onToggleVersion: (version: string) => void;
  onToggleGroup: (group: string, versionsInGroup: Set<string>) => void;
  isGroupSelected: (versionsInGroup: Set<string>) => boolean;
  isGroupPartiallySelected: (versionsInGroup: Set<string>) => boolean;

  showUnstaked: boolean;
  onToggleUnstaked: () => void;
  unstakedGroups: UnstakedVersionGroupStat[];
  unstakedTotalNodes: number;

  hasInfrastructure: boolean;
  clientStats: StatItem[];
  selectedClients: Set<string>;
  onToggleClient: (client: string) => void;
  asnStats: StatItem[];
  selectedAsns: Set<string>;
  onToggleAsn: (asn: string) => void;
  dataCenterStats: StatItem[];
  selectedDataCenters: Set<string>;
  onToggleDataCenter: (dataCenter: string) => void;

  hasSfdp: boolean;
  sfdpStates: string[];
  sfdpFilter: string;
  onSfdpFilterChange: (value: string) => void;

  onClearAll: () => void;
  onExportCsv: () => void;
}

function chipClass(selected: boolean, partial: boolean = false): string {
  if (selected) return "bg-blue-500 text-white border-blue-500";
  if (partial) return "bg-blue-50 text-blue-700 border-blue-400";
  return "bg-white text-gray-700 border-gray-300";
}

export default function FilterBottomSheet({
  isOpen,
  onClose,
  versionGroups,
  selectedVersions,
  onToggleVersion,
  onToggleGroup,
  isGroupSelected,
  isGroupPartiallySelected,
  showUnstaked,
  onToggleUnstaked,
  unstakedGroups,
  unstakedTotalNodes,
  hasInfrastructure,
  clientStats,
  selectedClients,
  onToggleClient,
  asnStats,
  selectedAsns,
  onToggleAsn,
  dataCenterStats,
  selectedDataCenters,
  onToggleDataCenter,
  hasSfdp,
  sfdpStates,
  sfdpFilter,
  onSfdpFilterChange,
  onClearAll,
  onExportCsv,
}: FilterBottomSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            className="md:hidden fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            className="md:hidden fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-200">
              <div className="w-9" />
              <span className="font-semibold text-sm text-gray-900">Filters</span>
              <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700" aria-label="Close filters">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-5">
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Version</h3>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={showUnstaked} onChange={onToggleUnstaked} className="rounded" />
                    Unstaked nodes
                  </label>
                </div>

                {!showUnstaked ? (
                  <div className="space-y-2">
                    {versionGroups.map((group) => (
                      <div key={group.groupName}>
                        <button
                          onClick={() => onToggleGroup(group.groupName, group.versionsInGroup)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold ${chipClass(
                            isGroupSelected(group.versionsInGroup),
                            isGroupPartiallySelected(group.versionsInGroup)
                          )}`}
                        >
                          <span>Version {group.groupName}</span>
                          <span>{group.stakePercentage}%</span>
                        </button>
                        {group.individualVersions.length > 1 && (
                          <details className="mt-1 pl-2">
                            <summary className="text-[11px] text-gray-500 cursor-pointer">
                              {group.versionCount} individual versions
                            </summary>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {group.individualVersions.map((item) => (
                                <button
                                  key={item.version}
                                  onClick={() => onToggleVersion(item.version)}
                                  className={`px-2 py-1 rounded-full border text-[11px] font-mono ${chipClass(
                                    selectedVersions.has(item.version)
                                  )}`}
                                >
                                  {item.version} · {item.stakePercentage}%
                                </button>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500">
                      {unstakedTotalNodes.toLocaleString()} unstaked gossip nodes
                    </div>
                    {unstakedGroups.map((group) => (
                      <div
                        key={group.groupName}
                        className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold text-gray-900">
                          <span>Version {group.groupName}</span>
                          <span>{group.nodeCount.toLocaleString()} nodes</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {hasInfrastructure && (
                <>
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Software client</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {clientStats.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => onToggleClient(item.key)}
                          className={`px-2.5 py-1 rounded-full border text-[11px] ${chipClass(
                            selectedClients.has(item.key)
                          )}`}
                        >
                          {item.key} · {item.stakePercentage}%
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">ASN</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {asnStats.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => onToggleAsn(item.key)}
                          className={`px-2.5 py-1 rounded-full border text-[11px] ${chipClass(
                            selectedAsns.has(item.key)
                          )}`}
                        >
                          {item.key === "Unknown" ? "Unknown" : getAsnDisplay(Number(item.key))} ·{" "}
                          {item.stakePercentage}%
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Data center</h3>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {dataCenterStats.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => onToggleDataCenter(item.key)}
                          title={item.key}
                          className={`px-2.5 py-1 rounded-full border text-[11px] max-w-[220px] truncate ${chipClass(
                            selectedDataCenters.has(item.key)
                          )}`}
                        >
                          {item.key} · {item.stakePercentage}%
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {hasSfdp && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">SFDP</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => onSfdpFilterChange("all")}
                      className={`px-2.5 py-1 rounded-full border text-[11px] ${chipClass(sfdpFilter === "all")}`}
                    >
                      All Validators
                    </button>
                    <button
                      onClick={() => onSfdpFilterChange("sfdp")}
                      className={`px-2.5 py-1 rounded-full border text-[11px] ${chipClass(sfdpFilter === "sfdp")}`}
                    >
                      SFDP Participants
                    </button>
                    <button
                      onClick={() => onSfdpFilterChange("non-sfdp")}
                      className={`px-2.5 py-1 rounded-full border text-[11px] ${chipClass(
                        sfdpFilter === "non-sfdp"
                      )}`}
                    >
                      Non-SFDP
                    </button>
                    {sfdpStates.map((state) => (
                      <button
                        key={state}
                        onClick={() => onSfdpFilterChange(state)}
                        className={`px-2.5 py-1 rounded-full border text-[11px] ${chipClass(sfdpFilter === state)}`}
                      >
                        {state}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200">
              <button
                onClick={onClearAll}
                className="flex-1 px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-900 rounded-lg"
              >
                Clear all filters
              </button>
              <button
                onClick={onExportCsv}
                className="flex-1 px-3 py-2 text-xs font-semibold bg-green-500 text-white rounded-lg"
              >
                Export CSV
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
