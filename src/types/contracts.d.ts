import { BigNumber } from 'ethers';

export interface GameTokenContract {
  addReward(player: string, amount: BigNumber): Promise<any>;
  withdrawRewards(): Promise<any>;
  pendingRewards(address: string): Promise<BigNumber>;
  minWithdrawAmount(): Promise<BigNumber>;
  totalRewardsDistributed(): Promise<BigNumber>;
  getPendingReward(player: string): Promise<BigNumber>;
}
