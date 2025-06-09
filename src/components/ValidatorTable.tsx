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
};

export default function ValidatorTable({ initialData }: { initialData: Validator[] }) {
  const [validators] = useState<Validator[]>(initialData);
  const [sortCfg, setSortCfg] = useState<{ key: keyof Validator; dir: "asc" | "desc" }>({
    key: "activatedStake",
    dir: "desc",
  });
  const [regex, setRegex] = useState("");

  const filtered = useMemo(() => {
    if (!regex.trim()) return validators;
    try {
      const r = new RegExp(regex, "i");
      const isVersionRegex = /\d/.test(regex); // Check if regex contains a digit

      if (isVersionRegex) {
        return validators.filter((v) => r.test(v.version));
      } else {
        return validators.filter((v) => r.test(v.name));
      }
    } catch {
      return validators; // invalid regex — ignore filter
    }
  }, [validators, regex]);

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

  const toggleSort = (key: keyof Validator) => {
    setSortCfg((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm">
          Version regex:
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="1\\.18\\..*"
            value={regex}
            onChange={(e) => setRegex(e.target.value)}
          />
        </label>
        <div className="text-sm text-gray-700">
          Matching stake: <strong>{pct}%</strong>
        </div>
      </div>

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
                { key: "delinquent", label: "Is Active?" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key as keyof Validator)}
                  className="px-3 py-2 text-left cursor-pointer select-none whitespace-nowrap"
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
                <td className="px-3 py-1">{v.name}</td>
                <td className="px-3 py-1 font-mono">{v.voteAccountPubkey}</td>
                <td className="px-3 py-1 font-mono">{v.identityPubkey}</td>
                <td className="px-3 py-1 text-right">{Number(v.activatedStake / LAMPORTS_PER_SOL).toLocaleString(undefined, { minimumFractionDigits: 4 })}</td>
                <td className="px-3 py-1">{v.version}</td>
                <td className="px-3 py-1 text-center">{v.delinquent ? "🚫" : "✅"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
