"use client";
import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Validator } from "../types/validator";
import ValidatorTableRow from "./ValidatorTableRow";
import ValidatorTableHeader from "./ValidatorTableHeader";
import CopyNotification from "./CopyNotification";
import { getMinorVersionGroup } from "../utils/versionParser";

export default function ValidatorTable({ initialData }: { initialData: Validator[] }) {
  const searchParams = useSearchParams();
  const [validators] = useState<Validator[]>(initialData);
  const [sortCfg, setSortCfg] = useState<{ key: keyof Validator; dir: "asc" | "desc" }>({
    key: "activatedStake",
    dir: "desc",
  });
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(new Set());
  const [sfdpFilter, setSfdpFilter] = useState("all");
  const [showVersionFilter, setShowVersionFilter] = useState(false);
  const [copyNotification, setCopyNotification] = useState<{
    message: string;
    isVisible: boolean;
    isError: boolean;
  }>({ message: "", isVisible: false, isError: false });

  const handleCopySuccess = (message: string) => {
    setCopyNotification({ message, isVisible: true, isError: false });
  };

  const handleCopyError = (message: string) => {
    setCopyNotification({ message, isVisible: true, isError: true });
  };

  const hideCopyNotification = () => {
    setCopyNotification(prev => ({ ...prev, isVisible: false }));
  };

  // Initialize filters from URL parameters
  useEffect(() => {
    const versions = searchParams.get('versions');
    const sfdp = searchParams.get('sfdp');
    const sort = searchParams.get('sort');
    const sortDir = searchParams.get('sortDir');

    if (versions) {
      setSelectedVersions(new Set(versions.split(',')));
      // Show version filter if versions are selected in URL
      setShowVersionFilter(true);
    }
    if (sfdp) {
      setSfdpFilter(sfdp);
    }
    if (sort && sortDir) {
      setSortCfg({ key: sort as keyof Validator, dir: sortDir as "asc" | "desc" });
    }
  }, [searchParams]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedVersions.size > 0) {
      params.set('versions', Array.from(selectedVersions).join(','));
    }
    if (sfdpFilter !== 'all') {
      params.set('sfdp', sfdpFilter);
    }
    if (sortCfg.key !== 'activatedStake' || sortCfg.dir !== 'desc') {
      params.set('sort', sortCfg.key);
      params.set('sortDir', sortCfg.dir);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : '';

    // Update URL without causing a page reload
    window.history.replaceState({}, '', newUrl);
  }, [selectedVersions, sfdpFilter, sortCfg]);

  // Get unique versions with their stake percentages, including groups
  const versionStats = useMemo(() => {
    const versionMap = new Map<string, number>();
    const groupMap = new Map<string, Set<string>>(); // group -> set of versions
    const totalStake = validators.reduce((sum, v) => sum + Number(v.activatedStake || 0), 0);

    // Build version stake map and group membership
    validators.forEach((v) => {
      const version = v.version || "unknown";
      const stake = Number(v.activatedStake || 0);

      versionMap.set(version, (versionMap.get(version) || 0) + stake);

      // Add to group
      const group = getMinorVersionGroup(version);
      if (!groupMap.has(group)) {
        groupMap.set(group, new Set());
      }
      groupMap.get(group)!.add(version);
    });

    // Build group data with individual versions
    const groups = Array.from(groupMap.entries()).map(([group, versions]) => {
      const stake = Array.from(versions).reduce((sum, v) => sum + (versionMap.get(v) || 0), 0);

      // Build individual version stats for this group
      const individualVersions = Array.from(versions).map(version => ({
        version,
        stakePercentage: totalStake ? ((versionMap.get(version)! / totalStake) * 100).toFixed(2) : "0.00",
        stake: versionMap.get(version)!
      })).sort((a, b) => {
        // Sort individuals within group
        if (a.version === "unknown") return 1;
        if (b.version === "unknown") return -1;
        const aParts = a.version.split('.').map(Number);
        const bParts = b.version.split('.').map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aPart = aParts[i] || 0;
          const bPart = bParts[i] || 0;
          if (aPart !== bPart) return bPart - aPart;
        }
        return 0;
      });

      return {
        groupName: group,
        stakePercentage: totalStake ? ((stake / totalStake) * 100).toFixed(2) : "0.00",
        stake,
        versionCount: versions.size,
        versionsInGroup: versions,
        individualVersions
      };
    });

    // Sort groups by version
    const sortedGroups = groups.sort((a, b) => {
      if (a.groupName === "unknown") return 1;
      if (b.groupName === "unknown") return -1;
      const aParts = a.groupName.split('.').map(Number);
      const bParts = b.groupName.split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        if (aPart !== bPart) return bPart - aPart;
      }
      return 0;
    });

    return { groups: sortedGroups };
  }, [validators]);

  // Get unique SFDP states for the dropdown
  const sfdpStates = useMemo(() => {
    const states = new Set<string>();
    validators.forEach((v) => {
      if (v.sfdp && v.sfdpState) {
        states.add(v.sfdpState);
      }
    });
    return Array.from(states).sort();
  }, [validators]);

  const filtered = useMemo(() => {
    let filteredValidators = validators;

    // Apply SFDP filter
    if (sfdpFilter !== "all") {
      if (sfdpFilter === "sfdp") {
        filteredValidators = filteredValidators.filter((v) => v.sfdp);
      } else if (sfdpFilter === "non-sfdp") {
        filteredValidators = filteredValidators.filter((v) => !v.sfdp);
      } else {
        filteredValidators = filteredValidators.filter((v) => v.sfdpState === sfdpFilter);
      }
    }

    // Apply version filter
    if (selectedVersions.size > 0) {
      filteredValidators = filteredValidators.filter((v) => 
        selectedVersions.has(v.version || "unknown")
      );
    }

    return filteredValidators;
  }, [validators, selectedVersions, sfdpFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const av = a[sortCfg.key] ?? "";
      const bv = b[sortCfg.key] ?? "";
      if (av < bv) return sortCfg.dir === "asc" ? -1 : 1;
      if (av > bv) return sortCfg.dir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filtered, sortCfg]);

  const totalStake = validators.reduce((sum, v) => sum + Number(v.activatedStake || 0), 0);
  const filteredStake = filtered.reduce((sum, v) => sum + Number(v.activatedStake || 0), 0);
  const pct = totalStake ? ((filteredStake / totalStake) * 100).toFixed(2) : "0.00";

  // Calculate total SFDP stake
  const totalSfdpStake = useMemo(() => {
    const approvedSfdpValidators = validators.filter((v) => v.sfdp && v.sfdpState === "Approved");
    return approvedSfdpValidators.reduce((sum, v) => sum + Number(v.activatedStake || 0), 0);
  }, [validators]);

  const sfdpStakePercentage = totalStake ? ((totalSfdpStake / totalStake) * 100).toFixed(2) : "0.00";

  const toggleSort = (key: keyof Validator) => {
    setSortCfg((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  };

  const toggleVersion = (version: string) => {
    setSelectedVersions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(version)) {
        newSet.delete(version);
      } else {
        newSet.add(version);
      }
      return newSet;
    });
  };

  const toggleGroup = (group: string, versionsInGroup: Set<string>) => {
    setSelectedVersions((prev) => {
      const newSet = new Set(prev);
      // Check if all versions in group are selected
      const allSelected = Array.from(versionsInGroup).every(v => newSet.has(v));

      if (allSelected) {
        // Deselect all versions in group
        versionsInGroup.forEach(v => newSet.delete(v));
      } else {
        // Select all versions in group
        versionsInGroup.forEach(v => newSet.add(v));
      }
      return newSet;
    });
  };

  const isGroupSelected = (versionsInGroup: Set<string>) => {
    return Array.from(versionsInGroup).every(v => selectedVersions.has(v));
  };

  const isGroupPartiallySelected = (versionsInGroup: Set<string>) => {
    const selectedCount = Array.from(versionsInGroup).filter(v => selectedVersions.has(v)).length;
    return selectedCount > 0 && selectedCount < versionsInGroup.size;
  };

  const clearAllFilters = () => {
    setSelectedVersions(new Set());
    setSfdpFilter("all");
    setShowVersionFilter(false);
    // Clear URL parameters
    window.history.replaceState({}, '', window.location.pathname);
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow text-gray-900">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <button
          onClick={clearAllFilters}
          className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
        >
          Clear All Filters
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-900">
          <button
            onClick={() => setShowVersionFilter(!showVersionFilter)}
            className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 rounded transition-colors flex items-center gap-1"
          >
            <span>Version Filter</span>
            <span className={`transition-transform duration-200 ${showVersionFilter ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-900">
          SFDP Filter:
          <select
            className="border rounded px-2 py-1 text-sm bg-white text-gray-900"
            value={sfdpFilter}
            onChange={(e) => setSfdpFilter(e.target.value)}
          >
            <option value="all">All Validators</option>
            <option value="sfdp">SFDP Participants</option>
            <option value="non-sfdp">Non-SFDP</option>
            {sfdpStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm text-gray-700">
          Matching stake: <strong>{pct}%</strong>
          {sfdpFilter !== "all" && (
            <span className="ml-4">
              | Total SFDP stake: <strong>{sfdpStakePercentage}%</strong>
            </span>
          )}
        </div>
      </div>

      {showVersionFilter && (
        <div className="bg-gray-50 border rounded-lg p-4 mb-4 transition-all duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {versionStats.groups.map((group) => {
              const isSelected = isGroupSelected(group.versionsInGroup);
              const isPartial = isGroupPartiallySelected(group.versionsInGroup);

              return (
                <div
                  key={group.groupName}
                  className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm"
                >
                  {/* Group header with checkbox */}
                  <label className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isPartial;
                      }}
                      onChange={() => toggleGroup(group.groupName, group.versionsInGroup)}
                      className="rounded"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-900">
                        Version {group.groupName}
                      </div>
                      <div className="text-xs text-gray-600">
                        {group.stakePercentage}% stake • {group.versionCount} version{group.versionCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </label>

                  {/* Individual versions */}
                  <div className="flex flex-col gap-1 mt-2">
                    {group.individualVersions.map((item) => (
                      <label
                        key={item.version}
                        className="flex items-center gap-2 text-xs text-gray-700 pl-6 cursor-pointer hover:bg-gray-50 py-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedVersions.has(item.version)}
                          onChange={() => toggleVersion(item.version)}
                          className="rounded"
                        />
                        <span className="flex-1 whitespace-nowrap">
                          {item.version}
                        </span>
                        <span className="text-gray-500">
                          {item.stakePercentage}%
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-center text-gray-500">No data found. Update <code>data/validators.json</code> and refresh.</p>
      ) : (
        <table className="min-w-full text-sm text-gray-900">
          <ValidatorTableHeader
            sortCfg={sortCfg}
            onSort={toggleSort}
          />
          <tbody>
            {sorted.map((v) => (
              <ValidatorTableRow
                key={v.voteAccountPubkey}
                validator={v}
                totalStake={totalStake}
                onCopySuccess={handleCopySuccess}
                onCopyError={handleCopyError}
              />
            ))}
          </tbody>
        </table>
      )}
      <CopyNotification
        message={copyNotification.message}
        isVisible={copyNotification.isVisible}
        isError={copyNotification.isError}
        onHide={hideCopyNotification}
      />
    </div>
  );
}
