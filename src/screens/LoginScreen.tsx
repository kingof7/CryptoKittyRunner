import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import { LoginScreenProps } from '../types/navigation';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
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
      const { id_token } = response.params;
      handleGoogleLogin(id_token);
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    try {
      // Save the token
      await AsyncStorage.setItem('userToken', idToken);
      
      // Navigate to game screen
      navigation.navigate('Game');
    } catch (error) {
      console.error('Google login error:', error);
    }
  };

  const handleKakaoLogin = async () => {
    // Implement Kakao Login
    try {
      // Add Kakao Login implementation
      navigation.navigate('Game');
    } catch (error) {
      console.error('Kakao login error:', error);
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
