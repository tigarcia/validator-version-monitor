"use client";
import React, { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Validator } from "../types/validator";
import ValidatorTableRow from "./ValidatorTableRow";
import ValidatorTableHeader from "./ValidatorTableHeader";
import CopyNotification from "./CopyNotification";

export default function ValidatorTable({ initialData }: { initialData: Validator[] }) {
  const router = useRouter();
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
        <div className="bg-gray-50 border rounded-lg p-3 mb-4 transition-all duration-200">
          <div className="flex gap-8">
            <div className="flex flex-col gap-1">
              {versionStats.column1.map(({ version, stakePercentage }) => (
                <label key={version} className="flex items-center gap-2 text-xs text-gray-900">
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
                <label key={version} className="flex items-center gap-2 text-xs text-gray-900">
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
