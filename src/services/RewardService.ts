import { ethers, BigNumber } from 'ethers';
import { GameTokenContract } from '../types/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GAME_TOKEN_ABI = [
  "function addReward(address player, uint256 amount)",
  "function withdrawRewards()",
  "function pendingRewards(address) view returns (uint256)",
  "function minWithdrawAmount() view returns (uint256)",
  "function totalRewardsDistributed() view returns (uint256)",
  "function getPendingReward(address player) view returns (uint256)"
];

export class RewardService {
  private contract: GameTokenContract;
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    const network = process.env.ETHEREUM_NETWORK || 'sepolia';
    const infuraId = process.env.INFURA_PROJECT_ID;
    const contractAddress = process.env.GAME_CONTRACT_ADDRESS;

    if (!contractAddress) {
      throw new Error('Game contract address not configured');
    }

    const providerUrl = `https://${network}.infura.io/v3/${infuraId}`;
    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(
      contractAddress,
      GAME_TOKEN_ABI,
      this.wallet
    ) as unknown as GameTokenContract;
  }

  async addReward(playerAddress: string, amount: number): Promise<boolean> {
    try {
      const amountInWei = ethers.utils.parseEther(amount.toString());
      const tx = await this.contract.addReward(playerAddress, amountInWei);
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error adding reward:', error);
      return false;
    }
  }

  async withdrawRewards(): Promise<boolean> {
    try {
      const tx = await this.contract.withdrawRewards();
      await tx.wait();
      return true;
    } catch (error) {
      console.error('Error withdrawing rewards:', error);
      return false;
    }
  }

  async getPendingRewards(playerAddress: string): Promise<number> {
    try {
      const rewards: BigNumber = await this.contract.getPendingReward(playerAddress);
      return Number(ethers.utils.formatEther(rewards));
    } catch (error) {
      console.error('Error getting pending rewards:', error);
      return 0;
    }
  }

  async getMinWithdrawAmount(): Promise<number> {
    try {
      const amount: BigNumber = await this.contract.minWithdrawAmount();
      return Number(ethers.utils.formatEther(amount));
    } catch (error) {
      console.error('Error getting min withdraw amount:', error);
      return 0.01;
    }
  }
}
