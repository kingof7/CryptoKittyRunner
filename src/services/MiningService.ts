import { ethers } from 'ethers';
import { MiningResult, MiningStats } from '../types/mining';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHA3 } from 'crypto-js';

export class MiningService {
  private miningStats: MiningStats = {
    totalMined: 0,
    combo: 0,
    difficulty: 1,
    lastMiningTime: 0
  };
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    const network = process.env.ETHEREUM_NETWORK || 'sepolia';
    const infuraId = process.env.INFURA_PROJECT_ID;
    const providerUrl = `https://${network}.infura.io/v3/${infuraId}`;

    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    this.loadMiningStats();
  }

  private async loadMiningStats() {
    try {
      const stats = await AsyncStorage.getItem('mining_stats');
      if (stats) {
        this.miningStats = JSON.parse(stats);
      }
    } catch (error) {
      console.error('Error loading mining stats:', error);
    }
  }

  private async saveMiningStats() {
    try {
      await AsyncStorage.setItem('mining_stats', JSON.stringify(this.miningStats));
    } catch (error) {
      console.error('Error saving mining stats:', error);
    }
  }

  private updateCombo() {
    const now = Date.now();
    if (now - this.miningStats.lastMiningTime < 2000) { // 2초 이내 연속 채굴
      this.miningStats.combo = Math.min(this.miningStats.combo + 1, 5);
    } else {
      this.miningStats.combo = 0;
    }
    this.miningStats.lastMiningTime = now;
  }

  private async performMining(
    difficulty: number,
    combo: number,
    blockData: {
      timestamp: number;
      lastHash: string;
      data: string;
      reward: number;
    }
  ): Promise<MiningResult> {
    const target = '0'.repeat(Math.min(difficulty + Math.floor(combo / 2), 4));
    let nonce = 0;
    const startTime = Date.now();

    while (true) {
      const timestamp = Date.now();
      const dataToHash = `${blockData.lastHash}${timestamp}${JSON.stringify(blockData.data)}${nonce}${combo}`;
      const hash = SHA3(dataToHash).toString();

      if (hash.substring(0, target.length) === target) {
        const comboMultiplier = 1 + (Math.min(combo, 5) * 0.2); // Max 2x multiplier at 5 combo
        const finalReward = blockData.reward * comboMultiplier;

        return {
          success: true,
          hash,
          nonce,
          reward: finalReward
        };
      }

      if (nonce > 1000000 || Date.now() - startTime > 5000) { // 5초 제한
        return { success: false };
      }

      nonce++;
    }
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
      const result = await this.performMining(
        baseDifficulty,
        this.miningStats.combo,
        {
          timestamp: Date.now(),
          lastHash: ethers.utils.id(Date.now().toString()),
          data: `CryptoKittyRunner-${isGolden ? 'golden' : 'regular'}-coin`,
          reward: baseReward
        }
      );

      if (result.success && result.reward) {
        try {
          // 테스트넷에 트랜잭션 전송
          const tx = await this.wallet.sendTransaction({
            to: this.wallet.address,
            value: ethers.utils.parseEther(result.reward.toString())
          });

          // 통계 업데이트
          this.miningStats.totalMined += result.reward;
          await this.saveMiningStats();

          return result;
        } catch (error) {
          console.error('Error sending mining reward:', error);
          return { success: false };
        }
      }

      return { success: false };
    } catch (error) {
      console.error('Mining error:', error);
      return { success: false };
    }
  }

  public getStats(): MiningStats {
    return { ...this.miningStats };
  }
}
