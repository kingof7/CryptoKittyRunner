export interface MiningResult {
  success: boolean;
  hash?: string;
  nonce?: number;
  reward?: number;
}

export interface MiningStats {
  totalMined: number;
  combo: number;
  difficulty: number;
  lastMiningTime: number;
}
