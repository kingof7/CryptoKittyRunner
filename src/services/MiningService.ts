import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RewardService } from './RewardService';
import { MiningStats, MiningResult } from '../types/mining';

const MINING_STATS_KEY = 'miningStats';
const DEFAULT_DIFFICULTY = 4;

export class MiningService {
  private miningStats: MiningStats = {
    totalMined: 0,
    combo: 0,
    difficulty: DEFAULT_DIFFICULTY,
    lastMiningTime: 0
  };
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private rewardService: RewardService;

  constructor(privateKey: string) {
    const network = process.env.ETHEREUM_NETWORK || 'sepolia';
    const infuraId = process.env.INFURA_PROJECT_ID;
    const providerUrl = `https://${network}.infura.io/v3/${infuraId}`;

    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.rewardService = new RewardService(privateKey);

    this.loadMiningStats();
  }

  private async loadMiningStats() {
    try {
      const stats = await AsyncStorage.getItem(MINING_STATS_KEY);
      if (stats) {
        this.miningStats = JSON.parse(stats);
      }
    } catch (error) {
      console.error('Error loading mining stats:', error);
    }
  }

  private async saveMiningStats() {
    try {
      await AsyncStorage.setItem(MINING_STATS_KEY, JSON.stringify(this.miningStats));
    } catch (error) {
      console.error('Error saving mining stats:', error);
    }
  }

  private updateCombo() {
    const now = Date.now();
    if (now - this.miningStats.lastMiningTime < 10000) { // 10초 이내에 채굴
      this.miningStats.combo++;
    } else {
      this.miningStats.combo = 1;
    }
    this.miningStats.lastMiningTime = now;
  }

  public async mineCoin(isGolden: boolean = false): Promise<MiningResult> {
    this.updateCombo();
    const baseDifficulty = isGolden ?
      Number(process.env.MINING_DIFFICULTY_GOLDEN || 2) :
      Number(process.env.MINING_DIFFICULTY_REGULAR || 1);

    const baseReward = isGolden ?
      Number(process.env.MINING_REWARD_GOLDEN || 0.001) :
      Number(process.env.MINING_REWARD_REGULAR || 0.0001);

    try {
      const nonce = Math.floor(Math.random() * 1000000).toString();
      const data = this.wallet.address + nonce;
      const hash = CryptoJS.SHA3(data, { outputLength: 256 }).toString();

      const difficulty = baseDifficulty + Math.floor(this.miningStats.combo / 10);
      const target = '0'.repeat(difficulty);

      if (hash.startsWith(target)) {
        const comboMultiplier = 1 + (this.miningStats.combo - 1) * 0.1; // 10% 증가
        const reward = baseReward * comboMultiplier;

        // 리워드를 스마트 컨트랙트에 기록
        await this.rewardService.addReward(this.wallet.address, reward);

        // 로컬 통계 업데이트
        this.miningStats.totalMined += reward;
        await this.saveMiningStats();

        return {
          success: true,
          reward,
          hash
        };
      }

      return {
        success: false,
        hash
      };
    } catch (error) {
      console.error('Mining error:', error);
      return {
        success: false
      };
    }
  }

  public getStats(): MiningStats {
    return { ...this.miningStats };
  }

  public async getPendingRewards(): Promise<number> {
    return this.rewardService.getPendingRewards(this.wallet.address);
  }
}
