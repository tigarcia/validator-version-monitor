"use client";
import React, { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";

const LAMPORTS_PER_SOL = 10 ** 9;

type Validator = {
  voteAccountPubkey: string;
  identityPubkey: string;
  activatedStake: number;
  version: string;
  delinquent: boolean;
  name: string;
  sfdp: boolean;
  sfdpState: string | null;
};

export default function ValidatorTable({ initialData }: { initialData: Validator[] }) {
  const [validators] = useState<Validator[]>(initialData);
  const [sortCfg, setSortCfg] = useState<{ key: keyof Validator; dir: "asc" | "desc" }>({
    key: "activatedStake",
    dir: "desc",
  });
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(new Set());
  const [sfdpFilter, setSfdpFilter] = useState("all");
  const [showVersionFilter, setShowVersionFilter] = useState(false);

  // Get unique versions with their stake percentages
  const versionStats = useMemo(() => {
    const versionMap = new Map<string, number>();
    const totalStake = validators.reduce((sum, v) => sum + Number(v.activatedStake || 0), 0);
    
    validators.forEach((v) => {
      const version = v.version || "unknown";
      const currentStake = versionMap.get(version) || 0;
      versionMap.set(version, currentStake + Number(v.activatedStake || 0));
    });

    const sortedVersions = Array.from(versionMap.entries())
      .map(([version, stake]) => ({
        version,
        stakePercentage: totalStake ? ((stake / totalStake) * 100).toFixed(2) : "0.00",
        stake,
      }))
      .sort((a, b) => {
        // Handle "unknown" version
        if (a.version === "unknown") return 1;
        if (b.version === "unknown") return -1;
        
        // Parse semantic versions
        const aParts = a.version.split('.').map(Number);
        const bParts = b.version.split('.').map(Number);
        
        // Compare major, minor, patch
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aPart = aParts[i] || 0;
          const bPart = bParts[i] || 0;
          if (aPart !== bPart) {
            return bPart - aPart; // Descending order
          }
        }
        return 0;
      });

    // Split into two columns - first column gets higher versions
    const midPoint = Math.ceil(sortedVersions.length / 2);
    const column1 = sortedVersions.slice(0, midPoint);
    const column2 = sortedVersions.slice(midPoint);

    return { column1, column2 };
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
      const av: any = a[sortCfg.key] ?? "";
      const bv: any = b[sortCfg.key] ?? "";
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
    const sfdpValidators = validators.filter((v) => v.sfdp);
    return sfdpValidators.reduce((sum, v) => sum + Number(v.activatedStake || 0), 0);
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

  const clearAllFilters = () => {
    setSelectedVersions(new Set());
    setSfdpFilter("all");
    setShowVersionFilter(false);
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <button
          onClick={clearAllFilters}
          className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
        >
          Clear All Filters
        </button>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setShowVersionFilter(!showVersionFilter)}
            className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-colors flex items-center gap-1"
          >
            <span>Version Filter</span>
            <span className={`transition-transform duration-200 ${showVersionFilter ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          SFDP Filter:
          <select
            className="border rounded px-2 py-1 text-sm"
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
        <div className="bg-gray-50 border rounded-lg p-3 mb-4 transition-all duration-200">
          <div className="flex gap-8">
            <div className="flex flex-col gap-1">
              {versionStats.column1.map(({ version, stakePercentage }) => (
                <label key={version} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedVersions.has(version)}
                    onChange={() => toggleVersion(version)}
                    className="rounded"
                  />
                  <span className="whitespace-nowrap">
                    {version} ({stakePercentage}%)
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {versionStats.column2.map(({ version, stakePercentage }) => (
                <label key={version} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedVersions.has(version)}
                    onChange={() => toggleVersion(version)}
                    className="rounded"
                  />
                  <span className="whitespace-nowrap">
                    {version} ({stakePercentage}%)
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-center text-gray-500">No data found. Update <code>data/validators.json</code> and refresh.</p>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              {[
                { key: "name", label: "Name" },
                { key: "voteAccountPubkey", label: "Vote Account" },
                { key: "identityPubkey", label: "Identity" },
                { key: "activatedStake", label: "Stake" },
                { key: "version", label: "Version" },
                { key: "sfdpState", label: "SFDP State" },
                { key: "delinquent", label: "Is Active?" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key as keyof Validator)}
                  className={`px-3 py-2 text-left cursor-pointer select-none whitespace-nowrap ${
                    key === "delinquent" ? "hidden lg:table-cell" : ""
                  } ${
                    key === "voteAccountPubkey" ? "hidden sm:table-cell" : ""
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    {sortCfg.key === key && (
                      <ArrowUpDown
                        size={12}
                        className={sortCfg.dir === "asc" ? "rotate-180" : ""}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr key={v.voteAccountPubkey} className="border-b hover:bg-gray-50">
                <td className="px-3 py-1 max-w-[200px] sm:max-w-[150px] truncate" title={v.name}>
                  {v.name}
                </td>
                <td className="px-3 py-1 font-mono max-w-[120px] sm:max-w-[80px] truncate hidden sm:table-cell" title={v.voteAccountPubkey}>
                  {v.voteAccountPubkey}
                </td>
                <td className="px-3 py-1 font-mono max-w-[120px] sm:max-w-[80px] truncate" title={v.identityPubkey}>
                  {v.identityPubkey}
                </td>
                <td className="px-3 py-1 text-right">{Number(v.activatedStake / LAMPORTS_PER_SOL).toLocaleString(undefined, { minimumFractionDigits: 4 })}</td>
                <td className="px-3 py-1">{v.version}</td>
                <td className="px-3 py-1 text-center">{v.sfdpState || "N/A"}</td>
                <td className="px-3 py-1 text-center hidden lg:table-cell">{v.delinquent ? "🚫" : "✅"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
