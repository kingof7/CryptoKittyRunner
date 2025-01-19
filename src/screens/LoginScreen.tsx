import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen = ({ navigation }: any) => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: 'YOUR_WEB_CLIENT_ID',
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleLogin(authentication?.accessToken);
    }
  }, [response]);

  const handleGoogleLogin = async (accessToken: string | undefined) => {
    if (!accessToken) return;

    try {
      const credential = auth.GoogleAuthProvider.credential(null, accessToken);
      const userCredential = await auth().signInWithCredential(credential);

      await AsyncStorage.setItem('user', JSON.stringify(userCredential.user));
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
