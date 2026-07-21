export interface ParsedVersion {
  original: string;
  type: 'agave' | 'firedancer' | 'unknown';
  major: number;
  minor: number;
  patch: number;
  minorGroup: string; // "3.1"
}

/**
 * Detects versions that encode their true Agave-compatible version in their
 * final dot-segment rather than in their own major.minor.patch numbering.
 * Firedancer-style clients version themselves independently, but append a
 * 5-digit MMmmpp code as the last segment - sometimes directly
 * (e.g. "0.1005.40100"), sometimes after a -rc/-beta/-alpha pre-release tag
 * (e.g. "1.100.0-beta.40201", where the tag itself becomes the 3rd segment
 * and the code moves to the 4th).
 */
export function isFiredancerVersion(version: string): boolean {
  const parts = version.split('.');
  if (parts.length < 3) return false;
  const lastSegment = parts[parts.length - 1];
  return /^\d{5}$/.test(lastSegment);
}

/**
 * Parses both Agave and Firedancer version formats.
 *
 * Agave: "3.1.8" → major=3, minor=1, patch=8
 * Firedancer: the final dot-segment is a 5-digit MMmmpp code, e.g.
 *   "...40201" → major=4, minor=02, patch=01 (Agave-compatible 4.2.1)
 */
export function parseVersion(version: string): ParsedVersion {
  if (!version || version === 'unknown') {
    return {
      original: version,
      type: 'unknown',
      major: 0,
      minor: 0,
      patch: 0,
      minorGroup: 'unknown'
    };
  }

  const parts = version.split('.');

  if (isFiredancerVersion(version)) {
    const encodedSegment = parts[parts.length - 1];

    // Format: MMmmpp - e.g. "40201" -> major=4, minor=02, patch=01
    const major = parseInt(encodedSegment[0], 10) || 0;
    const minor = parseInt(encodedSegment.substring(1, 3), 10) || 0;
    const patch = parseInt(encodedSegment.substring(3, 5), 10) || 0;

    return {
      original: version,
      type: 'firedancer',
      major,
      minor,
      patch,
      minorGroup: `${major}.${minor}`
    };
  }

  // Standard Agave/semver format
  const major = parseInt(parts[0], 10) || 0;
  const minor = parseInt(parts[1], 10) || 0;
  const patch = parseInt(parts[2], 10) || 0;

  return {
    original: version,
    type: 'agave',
    major,
    minor,
    patch,
    minorGroup: `${major}.${minor}`
  };
}

/**
 * Gets the minor version group (e.g., "3.1") for any version format.
 */
export function getMinorVersionGroup(version: string): string {
  return parseVersion(version).minorGroup;
}

/**
 * Checks if a version belongs to a specific minor version group.
 */
export function isVersionInGroup(version: string, group: string): boolean {
  return getMinorVersionGroup(version) === group;
}

/**
 * Compares two version strings for descending sort order, using each
 * version's effective (decoded) major.minor.patch so Firedancer-style
 * versions sort by their true Agave compatibility, not their own numbering.
 * "unknown" always sorts last.
 */
export function compareVersionsDesc(a: string, b: string): number {
  if (a === "unknown") return 1;
  if (b === "unknown") return -1;
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa.major !== pb.major) return pb.major - pa.major;
  if (pa.minor !== pb.minor) return pb.minor - pa.minor;
  if (pa.patch !== pb.patch) return pb.patch - pa.patch;
  return 0;
}
