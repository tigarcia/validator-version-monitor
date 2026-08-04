import { parseVersion } from "./versionParser";

/**
 * Compact label for a version chip. Firedancer-style versions show their
 * decoded Agave-compatible minor version instead of their own literal
 * numbering, since that's what's actually comparable across the fleet.
 */
export function getVersionChipLabel(version: string): string {
  const parsed = parseVersion(version);
  if (parsed.type === "firedancer") {
    return `FD ${parsed.minorGroup}`;
  }
  return version;
}

const CHIP_PALETTE = [
  { bg: "bg-green-100", text: "text-green-800" },
  { bg: "bg-blue-100", text: "text-blue-800" },
  { bg: "bg-amber-100", text: "text-amber-800" },
  { bg: "bg-purple-100", text: "text-purple-800" },
  { bg: "bg-pink-100", text: "text-pink-800" },
  { bg: "bg-teal-100", text: "text-teal-800" },
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic color pair for a minor-version group, so the same group
 * always renders the same chip color across a list.
 */
export function getVersionChipColorClasses(minorGroup: string): { bg: string; text: string } {
  if (minorGroup === "unknown") {
    return { bg: "bg-gray-100", text: "text-gray-700" };
  }
  const index = hashString(minorGroup) % CHIP_PALETTE.length;
  return CHIP_PALETTE[index];
}
