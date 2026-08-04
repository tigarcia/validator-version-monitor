export interface VersionGroupStat {
  groupName: string;
  stakePercentage: string;
  stake: number;
  versionCount: number;
  versionsInGroup: Set<string>;
  individualVersions: { version: string; stakePercentage: string; stake: number }[];
}

export interface UnstakedVersionGroupStat {
  groupName: string;
  nodeCount: number;
  versionCount: number;
  individualVersions: { version: string; count: number }[];
}

export interface StatItem {
  key: string;
  stakePercentage: string;
  stake: number;
}
