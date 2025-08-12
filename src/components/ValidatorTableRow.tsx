import { Validator } from "../types/validator";
import { copyToClipboard } from "../utils/copyToClipboard";
import { Copy } from "lucide-react";

const LAMPORTS_PER_SOL = 10 ** 9;

interface ValidatorTableRowProps {
  validator: Validator;
  totalStake: number;
  onCopySuccess: (message: string) => void;
  onCopyError: (message: string) => void;
}

export default function ValidatorTableRow({
  validator,
  totalStake,
  onCopySuccess,
  onCopyError
}: ValidatorTableRowProps) {

  const handleCopy = async (text: string, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      onCopySuccess(`${label} copied to clipboard`);
    } else {
      onCopyError(`Failed to copy ${label}`);
    }
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-3 py-1 max-w-[200px] sm:max-w-[150px] truncate text-gray-900" title={validator.name}>
        {validator.name}
      </td>
      <td
        className="px-3 py-1 font-mono max-w-[120px] sm:max-w-[80px] truncate cursor-pointer hover:bg-gray-100 transition-colors text-gray-900"
        title="Copy"
        onClick={() => handleCopy(validator.identityPubkey, "Identity")}
      >
        <div className="flex items-center gap-1">
          <span>
            {validator.identityPubkey.substring(0, 10)}...
          </span>
          <Copy size={12} className="text-gray-500 hover:text-gray-700" />
        </div>
      </td>
      <td
        className="px-3 py-1 font-mono max-w-[120px] sm:max-w-[80px] truncate hidden sm:table-cell cursor-pointer hover:bg-gray-100 transition-colors text-gray-900"
        title="Copy"
        onClick={() => handleCopy(validator.voteAccountPubkey, "Vote Account")}
      >
        <div className="flex items-center gap-1">
          <span>
            {validator.voteAccountPubkey.substring(0, 10)}...
          </span>
          <Copy size={12} className="text-gray-500 hover:text-gray-700" />
        </div>
      </td>
      <td className="px-3 py-1 text-right text-gray-900">
        {Number(validator.activatedStake / LAMPORTS_PER_SOL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
        ({((Number(validator.activatedStake) / totalStake) * 100).toFixed(2)}%)
      </td>
      <td className="px-3 py-1 text-gray-900">{validator.version}</td>
      <td className="px-3 py-1 text-center text-gray-900">{validator.sfdpState || "N/A"}</td>
      <td className="px-3 py-1 text-center hidden lg:table-cell text-gray-900">{validator.delinquent ? "🚫" : "✅"}</td>
    </tr>
  );
}