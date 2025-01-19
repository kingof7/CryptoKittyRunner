import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  Game: undefined;
  Wallet: undefined;
};

export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
export type GameScreenProps = NativeStackScreenProps<RootStackParamList, 'Game'>;
export type WalletScreenProps = NativeStackScreenProps<RootStackParamList, 'Wallet'>;
