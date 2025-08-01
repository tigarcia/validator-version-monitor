export type Validator = {
  voteAccountPubkey: string;
  identityPubkey: string;
  activatedStake: number;
  version: string;
  delinquent: boolean;
  name: string;
  sfdp: boolean;
  sfdpState: string | null;
};
