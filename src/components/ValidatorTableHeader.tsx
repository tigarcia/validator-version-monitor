import { ArrowUpDown } from "lucide-react";
import { Validator } from "../types/validator";

interface ValidatorTableHeaderProps {
  sortCfg: { key: keyof Validator; dir: "asc" | "desc" };
  onSort: (key: keyof Validator) => void;
  showInfrastructure: boolean;
}

export default function ValidatorTableHeader({ sortCfg, onSort, showInfrastructure }: ValidatorTableHeaderProps) {
  const columns = [
    { key: "name", label: "Name" },
    { key: "identityPubkey", label: "Identity" },
    { key: "voteAccountPubkey", label: "Vote Account" },
    { key: "activatedStake", label: "Stake" },
    { key: "version", label: "Version" },
    { key: "sfdpState", label: "SFDP State" },
    { key: "delinquent", label: "Is Active?" },
  ];

  const infrastructureColumns = [
    { key: "softwareClient", label: "Software Client" },
    { key: "autonomousSystemNumber", label: "ASN" },
    { key: "dataCenterKey", label: "Data Center" },
  ];

  const allColumns = showInfrastructure ? [...columns, ...infrastructureColumns] : columns;

  return (
    <thead>
      <tr className="border-b">
        {allColumns.map(({ key, label }) => (
          <th
            key={key}
            onClick={() => onSort(key as keyof Validator)}
            className={`px-3 py-2 text-left cursor-pointer select-none whitespace-nowrap text-gray-900 ${
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
                  className={`${sortCfg.dir === "asc" ? "rotate-180" : ""} text-gray-900`}
                />
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
} 