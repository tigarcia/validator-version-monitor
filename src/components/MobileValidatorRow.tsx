import { useState } from "react";
import { ChevronDown, Copy } from "lucide-react";
import { Validator } from "../types/validator";
import { copyToClipboard } from "../utils/copyToClipboard";
import { getVersionChipLabel, getVersionChipColorClasses } from "../utils/versionChip";
import { getMinorVersionGroup } from "../utils/versionParser";
import { getAsnDisplay, getAsnProviderName } from "../utils/asnLookup";
import { LAMPORTS_PER_SOL } from "./ValidatorTableRow";

interface MobileValidatorRowProps {
  validator: Validator;
  totalStake: number;
  hasInfrastructure: boolean;
  onCopySuccess: (message: string) => void;
  onCopyError: (message: string) => void;
}

export default function MobileValidatorRow({
  validator,
  totalStake,
  hasInfrastructure,
  onCopySuccess,
  onCopyError,
}: MobileValidatorRowProps) {
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async (text: string, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      onCopySuccess(`${label} copied to clipboard`);
    } else {
      onCopyError(`Failed to copy ${label}`);
    }
  };

  const chipColors = getVersionChipColorClasses(getMinorVersionGroup(validator.version));
  const stakePercentage = ((Number(validator.activatedStake) / totalStake) * 100).toFixed(2);
  const stakeSol = Number(validator.activatedStake / LAMPORTS_PER_SOL).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="md:hidden border-b border-gray-200">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-gray-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {validator.delinquent && (
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Delinquent" />
            )}
            <span className="font-semibold text-sm text-gray-900 truncate">{validator.name}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono font-semibold ${chipColors.bg} ${chipColors.text}`}
            >
              {getVersionChipLabel(validator.version)}
            </span>
            {hasInfrastructure && (
              <span className="text-[11px] text-gray-500 truncate">
                {validator.softwareClient || "Unknown"} · {getAsnProviderName(validator.autonomousSystemNumber)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold text-sm text-gray-900">{stakePercentage}%</div>
          <div className="text-[11px] text-gray-500">{stakeSol} SOL</div>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 bg-gray-50 text-xs text-gray-700 space-y-1.5">
          <div
            className="flex justify-between items-center gap-2 cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5"
            onClick={() => handleCopy(validator.identityPubkey, "Identity")}
          >
            <span className="text-gray-500">Identity</span>
            <span className="font-mono flex items-center gap-1">
              {validator.identityPubkey.substring(0, 20)}...
              <Copy size={11} className="text-gray-400" />
            </span>
          </div>
          <div
            className="flex justify-between items-center gap-2 cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5"
            onClick={() => handleCopy(validator.voteAccountPubkey, "Vote Account")}
          >
            <span className="text-gray-500">Vote Account</span>
            <span className="font-mono flex items-center gap-1">
              {validator.voteAccountPubkey.substring(0, 20)}...
              <Copy size={11} className="text-gray-400" />
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Full version</span>
            <span className="font-mono">{validator.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">SFDP state</span>
            <span>{validator.sfdpState || "N/A"}</span>
          </div>
          {hasInfrastructure && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">ASN</span>
                <span>{getAsnDisplay(validator.autonomousSystemNumber)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500 shrink-0">Data center</span>
                <span className="truncate" title={validator.dataCenterKey || "Unknown"}>
                  {validator.dataCenterKey || "Unknown"}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
