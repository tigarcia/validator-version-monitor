export interface ParsedVersion {
  original: string;
  type: 'agave' | 'firedancer' | 'unknown';
  major: number;
  minor: number;
  patch: number;
  minorGroup: string; // "3.1"
}

/**
 * Detects if a version string is a Firedancer version.
 * Firedancer versions follow the pattern: 0.XXX.YYYYY
 * where YYYYY (5+ digits) encodes the protocol version.
 */
export function isFiredancerVersion(version: string): boolean {
  if (!version.startsWith('0.')) return false;
  const parts = version.split('.');
  if (parts.length < 3) return false;
  const thirdSegment = parts[2];
  return thirdSegment.length >= 5 && /^\d+$/.test(thirdSegment);
}

/**
 * Parses both Agave and Firedancer version formats.
 *
 * Agave: "3.1.8" → major=3, minor=1, patch=8
 * Firedancer: "0.811.30108" → major=3, minor=1, patch=8
 *   - Decoding: First digit (3) = major, next 2 (01) = minor, last 2 (08) = patch
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

  // Check if it's Firedancer format
  if (isFiredancerVersion(version)) {
    const patchSegment = parts[2];

    // Extract protocol version from patch segment
    // Format: MMMPP where M=major digit, MM=minor, PP=patch
    const major = parseInt(patchSegment[0], 10) || 0;
    const minor = parseInt(patchSegment.substring(1, 3), 10) || 0;
    const patch = parseInt(patchSegment.substring(3, 5), 10) || 0;

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
