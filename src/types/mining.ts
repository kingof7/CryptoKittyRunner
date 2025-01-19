export interface MiningStats {
  totalMined: number;
  combo: number;
  difficulty: number;
  lastMiningTime: number;
}

export interface MiningResult {
  success: boolean;
  reward?: number;
  hash?: string;
}
