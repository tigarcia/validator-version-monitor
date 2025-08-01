import { Validator } from "../types/validator";

const LAMPORTS_PER_SOL = 10 ** 9;

interface ValidatorTableRowProps {
  validator: Validator;
  totalStake: number;
  windowWidth: number;
}

export default function ValidatorTableRow({ validator, totalStake, windowWidth }: ValidatorTableRowProps) {
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-3 py-1 max-w-[200px] sm:max-w-[150px] truncate" title={validator.name}>
        {validator.name}
      </td>
      <td className="px-3 py-1 font-mono max-w-[120px] sm:max-w-[80px] truncate hidden sm:table-cell" title={validator.voteAccountPubkey}>
        {windowWidth >= 1400 ? validator.voteAccountPubkey : validator.voteAccountPubkey.substring(0, 20) + '...'}
      </td>
      <td className="px-3 py-1 font-mono max-w-[120px] sm:max-w-[80px] truncate" title={validator.identityPubkey}>
        {windowWidth >= 1400 ? validator.identityPubkey : validator.identityPubkey.substring(0, 20) + '...'}
      </td>
      <td className="px-3 py-1 text-right">
        {Number(validator.activatedStake / LAMPORTS_PER_SOL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
        ({((Number(validator.activatedStake) / totalStake) * 100).toFixed(2)}%)
      </td>
      <td className="px-3 py-1">{validator.version}</td>
      <td className="px-3 py-1 text-center">{validator.sfdpState || "N/A"}</td>
      <td className="px-3 py-1 text-center hidden lg:table-cell">{validator.delinquent ? "🚫" : "✅"}</td>
    </tr>
  );
}