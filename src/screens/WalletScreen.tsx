import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { RewardService } from '../services/RewardService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';

export const WalletScreen: React.FC = () => {
  const [pendingRewards, setPendingRewards] = useState(0);
  const [minWithdrawAmount, setMinWithdrawAmount] = useState(0.01);
  const [withdrawing, setWithdrawing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rewardService, setRewardService] = useState<RewardService | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      const privateKey = await AsyncStorage.getItem('wallet_private_key');
      if (privateKey) {
        const wallet = new ethers.Wallet(privateKey);
        setWalletAddress(wallet.address);
        const service = new RewardService(privateKey);
        setRewardService(service);

        // 초기 데이터 로드
        const [rewards, minAmount] = await Promise.all([
          service.getPendingRewards(wallet.address),
          service.getMinWithdrawAmount()
        ]);

        setPendingRewards(rewards);
        setMinWithdrawAmount(minAmount);
      } else {
        Alert.alert('Error', 'Wallet not initialized');
      }
    } catch (error) {
      console.error('Error initializing wallet:', error);
      Alert.alert('Error', 'Failed to initialize wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!rewardService) return;

    try {
      setWithdrawing(true);
      const success = await rewardService.withdrawRewards();

      if (success) {
        Alert.alert('Success', 'Rewards withdrawn to your wallet!');
        setPendingRewards(0);
      } else {
        Alert.alert('Error', 'Failed to withdraw rewards');
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      Alert.alert('Error', 'Failed to withdraw rewards');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Your Wallet</Text>
        <Text style={styles.address}>{walletAddress}</Text>

        <View style={styles.rewardsContainer}>
          <Text style={styles.label}>Pending Rewards:</Text>
          <Text style={styles.value}>{pendingRewards.toFixed(6)} ETH</Text>
        </View>

        <View style={styles.minAmountContainer}>
          <Text style={styles.label}>Minimum Withdrawal:</Text>
          <Text style={styles.value}>{minWithdrawAmount} ETH</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.withdrawButton,
            (pendingRewards < minWithdrawAmount || withdrawing) && styles.disabledButton
          ]}
          onPress={handleWithdraw}
          disabled={pendingRewards < minWithdrawAmount || withdrawing}
        >
          {withdrawing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {pendingRewards < minWithdrawAmount
                ? `Need ${minWithdrawAmount} ETH to withdraw`
                : 'Withdraw Rewards'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  rewardsContainer: {
    marginBottom: 15,
  },
  minAmountContainer: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  withdrawButton: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#B0B0B0',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
