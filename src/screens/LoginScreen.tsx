import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, Alert, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { refreshAsync, useAutoDiscovery } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import { LoginScreenProps } from '../types/navigation';
import KakaoLogin from '../lib/kakao-login';
import * as ethers from 'ethers';
import database from '@react-native-firebase/database';

WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEYS = {
  WALLET_PRIVATE_KEY: 'eth_wallet_private_key',  // 지갑 키 저장용
  GOOGLE_TOKEN: 'googleToken',                   // 구글 로그인용
  KAKAO_ACCESS_TOKEN: 'kakaoAccessToken',        // 카카오 액세스 토큰
  KAKAO_REFRESH_TOKEN: 'kakaoRefreshToken',      // 카카오 리프레시 토큰
  USER_TOKEN: 'userToken',                       // 일반 로그인 토큰
  USER_ID: 'userId'                              // 사용자 고유 ID
};

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  // Firebase에 사용자 데이터 저장
  const saveUserDataToFirebase = async (userId: string, data: any) => {
    try {
      await database()
        .ref(`/users/${userId}`)
        .set({
          ...data,
          lastUpdated: database.ServerValue.TIMESTAMP
        });
      console.log('파이어베이스에 사용자 데이터 저장 성공');
    } catch (error) {
      console.error('파이어베이스 저장 실패:', error);
      throw error;
    }
  };

  // Firebase에서 사용자 데이터 로드
  const loadUserDataFromFirebase = async (userId: string) => {
    try {
      const snapshot = await database()
        .ref(`/users/${userId}`)
        .once('value');

      const data = snapshot.val();
      if (data) {
        console.log('파이어베이스에서 사용자 데이터 로드 성공');
        return data;
      }
      return null;
    } catch (error) {
      console.error('파이어베이스 로드 실패:', error);
      throw error;
    }
  };

  // 지갑 초기화 함수 수정
  const initializeWallet = async (userId: string) => {
    try {
      // 먼저 Firebase에서 지갑 정보 확인
      const userData = await loadUserDataFromFirebase(userId);
      if (userData?.walletPrivateKey) {
        // Firebase에 저장된 지갑이 있으면 복원
        const wallet = new ethers.Wallet(userData.walletPrivateKey);
        await AsyncStorage.setItem(STORAGE_KEYS.WALLET_PRIVATE_KEY, wallet.privateKey);
        console.log('기존 이더리움 지갑을 파이어베이스에서 복원했습니다:', {
          주소: wallet.address,
          개인키: wallet.privateKey.substring(0, 10) + '...'
        });
        return wallet;
      }

      // 저장된 지갑이 없으면 새로 생성
      const wallet = ethers.Wallet.createRandom();
      console.log('새로운 이더리움 지갑이 생성되었습니다:', {
        주소: wallet.address,
        개인키: wallet.privateKey.substring(0, 10) + '...'
      });

      // 지갑 정보를 Firebase와 로컬에 저장
      await saveUserDataToFirebase(userId, {
        walletPrivateKey: wallet.privateKey,
        walletAddress: wallet.address
      });
      await AsyncStorage.setItem(STORAGE_KEYS.WALLET_PRIVATE_KEY, wallet.privateKey);

      return wallet;
    } catch (error) {
      console.error('지갑 초기화 오류:', error);
      Alert.alert('오류', '지갑을 초기화하는 중 문제가 발생했습니다.');
      return null;
    }
  };

  // Google 프로필 가져오기
  const getGoogleProfile = async (accessToken: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Google profile fetch error:', error);
      throw error;
    }
  };

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '여기에_웹_클라이언트_ID를_넣으세요',
    iosClientId: '여기에_iOS_클라이언트_ID를_넣으세요',
    androidClientId: '여기에_Android_클라이언트_ID를_넣으세요',
    redirectUri: makeRedirectUri({
      scheme: 'cryptokittyrunner'
    })
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { idToken, accessToken } = response.params;
      handleGoogleLogin(idToken, accessToken);
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string, accessToken: string) => {
    try {
      // Google 프로필 정보 가져오기
      const profile = await getGoogleProfile(accessToken);
      const userId = `google_${profile.id}`;  // 카카오와 구분하기 위해 prefix 추가

      // 토큰 저장
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.GOOGLE_TOKEN, idToken],
        [STORAGE_KEYS.USER_TOKEN, idToken],
        [STORAGE_KEYS.USER_ID, userId]
      ]);

      // Firebase에 토큰 정보 저장
      await saveUserDataToFirebase(userId, {
        googleIdToken: idToken,
        googleAccessToken: accessToken,
        googleProfile: profile,
        lastLogin: database.ServerValue.TIMESTAMP
      });

      console.log('구글 로그인 성공:', {
        ID토큰: idToken.substring(0, 10) + '...',
        액세스토큰: accessToken.substring(0, 10) + '...',
        사용자ID: userId
      });

      // 지갑 초기화 (Firebase 연동)
      const wallet = await initializeWallet(userId);
      if (!wallet) return;

      navigation.navigate('Game');
    } catch (error) {
      console.error('Google login error:', error);
      Alert.alert('로그인 실패', '구글 로그인에 실패했습니다.');
    }
  };

  // 구글 토큰 갱신
  const refreshGoogleToken = async () => {
    try {
      const userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
      if (!userId) throw new Error('사용자 ID를 찾을 수 없습니다.');

      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.GOOGLE_TOKEN);
      if (!refreshToken) throw new Error('리프레시 토큰을 찾을 수 없습니다.');

      const discovery = useAutoDiscovery('https://accounts.google.com');
      if (!discovery) throw new Error('Google 인증 서버 정보를 찾을 수 없습니다.');

      // 새로운 토큰 발급
      const result = await refreshAsync(
        {
          clientId: '여기에_웹_클라이언트_ID를_넣으세요',
          refreshToken
        },
        discovery
      );

      if (!result.accessToken) {
        throw new Error('토큰 갱신 실패: 액세스 토큰을 받지 못했습니다.');
      }

      // 새로운 토큰 저장
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.GOOGLE_TOKEN, result.accessToken],
        [STORAGE_KEYS.USER_TOKEN, result.accessToken]
      ]);

      // Firebase에 새로운 토큰 저장
      await saveUserDataToFirebase(userId, {
        googleAccessToken: result.accessToken,
        lastUpdated: database.ServerValue.TIMESTAMP
      });

      console.log('구글 토큰 갱신 성공:', {
        새액세스토큰: result.accessToken.substring(0, 10) + '...',
        만료시간: result.issuedAt ? new Date(result.issuedAt * 1000).toLocaleString() : '알 수 없음'
      });

      return result.accessToken;
    } catch (error) {
      console.error('토큰 갱신 실패:', error);
      Alert.alert(
        '로그인 필요',
        '로그인이 만료되었습니다. 다시 로그인해주세요.',
        [
          {
            text: '확인',
            onPress: () => navigation.replace('Login')
          }
        ]
      );
      throw error;
    }
  };

  const [isLoading, setIsLoading] = useState(false);

  // 카카오 로그인 처리
  const handleKakaoLogin = async () => {
    try {
      console.log('카카오 로그인 시작');
      console.log('현재 플랫폼:', Platform.OS);
      
      // window 객체가 있는지 확인하여 웹 환경 체크
      const isWeb = typeof window !== 'undefined';
      console.log('웹 환경 여부:', isWeb);

      setIsLoading(true);
      const token = await KakaoLogin.login();
      console.log('카카오 로그인 응답:', token);

      // 웹에서는 KakaoLogin.login()이 리다이렉트를 처리
      if (isWeb) {
        console.log('웹 환경 감지');
        // 토큰이 없다는 것은 아직 인증 코드를 받기 전이라는 의미
        if (!token) {
          console.log('토큰 없음 - 카카오 로그인 페이지로 리다이렉트 예정');
          return;
        }

        console.log('토큰 있음 - 프로필 조회 시도');
        // 토큰이 있으면 프로필 정보를 가져오고 게임 화면으로 이동
        const profile = await KakaoLogin.getProfile();
        console.log('카카오 프로필:', profile);
        if (!profile || !profile.id) {
          throw new Error('카카오 프로필 정보를 가져오지 못했습니다.');
        }

        navigation.replace('Game');
        return;
      }

      if (!token) {
        throw new Error('카카오 로그인 토큰을 받지 못했습니다.');
      }

      // 카카오 사용자 정보 가져오기
      const profile = await KakaoLogin.getProfile();
      console.log('카카오 프로필:', profile);
      if (!profile || !profile.id) {
        throw new Error('카카오 프로필 정보를 가져오지 못했습니다.');
      }

      const userId = profile.id.toString();

      // 토큰 저장
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.KAKAO_ACCESS_TOKEN, token.accessToken],
        [STORAGE_KEYS.KAKAO_REFRESH_TOKEN, token.refreshToken],
        [STORAGE_KEYS.USER_TOKEN, token.accessToken],
        [STORAGE_KEYS.USER_ID, userId]
      ]);

      console.log('카카오 로그인 성공:', {
        액세스토큰: token.accessToken.substring(0, 10) + '...',
        리프레시토큰: token.refreshToken.substring(0, 10) + '...',
        사용자ID: userId
      });

      navigation.replace('Game');
    } catch (error) {
      console.error('Kakao login error:', error);
      Alert.alert(
        '로그인 실패',
        error instanceof Error ? error.message : '카카오 로그인에 실패했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 카카오 토큰 갱신 함수
  const refreshKakaoToken = async () => {
    try {
      const token = await KakaoLogin.refreshAccessToken();
      if (!token) {
        throw new Error('토큰 갱신 실패');
      }

      // 토큰 저장
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.KAKAO_ACCESS_TOKEN, token.accessToken],
        [STORAGE_KEYS.KAKAO_REFRESH_TOKEN, token.refreshToken],
        [STORAGE_KEYS.USER_TOKEN, token.accessToken]
      ]);

      return token.accessToken;
    } catch (error) {
      console.error('카카오 토큰 갱신 실패:', error);
      throw error;
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/logo.png')}
        style={styles.logo}
      />
      <TouchableOpacity
        style={[styles.button, styles.googleButton]}
        onPress={() => promptAsync()}
        disabled={!request}
      >
        <Text style={styles.buttonText}>Google로 로그인</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.kakaoButton]}
        onPress={handleKakaoLogin}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>카카오로 로그인</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 50,
    resizeMode: 'contain',
  },
  button: {
    width: '80%',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  kakaoButton: {
    backgroundColor: '#FEE500',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
