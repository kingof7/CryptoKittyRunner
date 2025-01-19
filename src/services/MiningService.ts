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
  private rewardService: RewardService | null = null;
  private isProduction: boolean;
  private readonly MAINNET_URL = 'https://eth-mainnet.g.alchemy.com/v2/your-api-key'; // 실제 API 키로 교체 필요
  private readonly TESTNET_URL = 'https://eth-sepolia.g.alchemy.com/v2/your-api-key'; // 테스트넷용 API 키로 교체 필요

  constructor(privateKey: string) {
    this.isProduction = process.env.NODE_ENV === 'production';

    if (this.isProduction) {
      // 프로덕션 환경: 이더리움 메인넷 사용
      console.log('Production mode: Using Ethereum Mainnet');
      this.provider = new ethers.providers.JsonRpcProvider(this.MAINNET_URL, {
        name: 'mainnet',
        chainId: 1
      });

      // 프로덕션에서만 RewardService 초기화
      try {
        this.rewardService = new RewardService(privateKey);
      } catch (error) {
        console.error('Failed to initialize RewardService:', error);
      }
    } else {
      // 개발 환경: Sepolia 테스트넷 사용
      console.log('Development mode: Using Sepolia Testnet');
      this.provider = new ethers.providers.JsonRpcProvider(this.TESTNET_URL, {
        name: 'sepolia',
        chainId: 11155111
      });
    }

    this.wallet = new ethers.Wallet(privateKey, this.provider);

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

        if (this.isProduction && this.rewardService) {
          try {
            // 프로덕션 환경: 실제 트랜잭션 시도
            await this.rewardService.addReward(this.wallet.address, reward);
          } catch (error) {
            console.error('Blockchain transaction failed:', error);
            // 트랜잭션 실패해도 게임은 계속 진행
          }
        }

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
    if (this.rewardService) {
      return this.rewardService.getPendingRewards(this.wallet.address);
    } else {
      return 0;
    }
  }
}
