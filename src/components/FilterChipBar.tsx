import { Filter, X } from "lucide-react";
import { ActiveFilterChip } from "../utils/activeFilterChips";

interface FilterChipBarProps {
  activeChips: ActiveFilterChip[];
  onRemoveChip: (chip: ActiveFilterChip) => void;
  onOpenSheet: () => void;
  matchingStakePercentage: string;
  matchingCount: number;
  sfdpStakePercentage: string;
  showSfdpStake: boolean;
}

export default function FilterChipBar({
  activeChips,
  onRemoveChip,
  onOpenSheet,
  matchingStakePercentage,
  matchingCount,
  sfdpStakePercentage,
  showSfdpStake,
}: FilterChipBarProps) {
  return (
    <div className="md:hidden mb-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <button
          onClick={onOpenSheet}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-full whitespace-nowrap shrink-0"
        >
          <Filter size={12} />
          Filters{activeChips.length > 0 ? ` (${activeChips.length})` : ""}
        </button>
        {activeChips.map((chip) => (
          <button
            key={`${chip.type}-${chip.key}`}
            onClick={() => onRemoveChip(chip)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-900 rounded-full whitespace-nowrap shrink-0"
          >
            {chip.label}
            <X size={12} />
          </button>
        ))}
      </div>
      <div className="text-xs text-gray-700">
        Matching stake: <strong>{matchingStakePercentage}%</strong> · {matchingCount.toLocaleString()} validator
        {matchingCount !== 1 ? "s" : ""}
        {showSfdpStake && (
          <span className="ml-2">
            | SFDP stake: <strong>{sfdpStakePercentage}%</strong>
          </span>
        )}
      </div>
    </div>
  );
}
