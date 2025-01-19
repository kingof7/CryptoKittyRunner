import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import GameScreen from './src/screens/GameScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { RootStackParamList } from './src/types/navigation';
import { Platform } from 'react-native';
import { LinkingOptions } from '@react-navigation/native';

const Stack = createNativeStackNavigator<RootStackParamList>();

// 웹 링킹 설정
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'http://localhost:8081',
    'kr.co.jcompany.CryptoKittyRunner://'
  ],
  config: {
    initialRouteName: 'Login',
    screens: {
      Login: {
        path: '',
        screens: {
          OAuthCallback: 'oauth/callback/kakao'
        }
      },
      Game: 'game',
      Wallet: 'wallet'
    }
  },
  getInitialURL: () => {
    // 웹에서 현재 URL 반환
    if (Platform.OS === 'web') {
      return window.location.href;
    }
    return null;
  }
};

export default function App() {
  // 앱 초기화
  React.useEffect(() => {
    const initializeApp = async () => {
      try {
        // 기타 초기화 코드...
      } catch (error) {
        console.error('앱 초기화 실패:', error);
      }
    };

    initializeApp();
  }, []);

  return (
    <NavigationContainer linking={linking}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: Platform.OS !== 'web',
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
        />
        <Stack.Screen
          name="Game"
          component={GameScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Wallet"
          component={WalletScreen}
          options={{
            title: 'My Wallet',
            headerStyle: {
              backgroundColor: '#4285F4',
            },
            headerTintColor: '#fff',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
