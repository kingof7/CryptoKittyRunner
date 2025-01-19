-    ***[프로젝트 설치, 셋팅 가이드]***

```
1. Node.js 설치:
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:$PATH"
brew install node
```

```
2. 프로젝트 생성:
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:$PATH"
yes | npx create-expo-app CryptoKittyRunner --template expo-template-blank-typescript
```

```
3. 필요한 패키지 설치:
cd CryptoKittyRunner
yes | npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/database @react-native-google-signin/google-signin @react-native-seoul/kakao-login ethers react-native-game-engine matter-js react-native-reanimated expo-auth-session expo-web-browser @react-native-async-storage/async-storage
```

```
4. 추가 패키지 설치:
cd CryptoKittyRunner
yes | npm install @react-navigation/native @react-navigation/native-stack
```

```
5. 프로젝트 구조 생성:
cd CryptoKittyRunner
mkdir -p src/components src/screens src/assets/images src/utils src/hooks src/services
```

```
6. 이미지 파일 다운로드:
cd CryptoKittyRunner/src/assets/images
curl -o cat.png https://raw.githubusercontent.com/expo/expo/master/templates/expo-template-blank/assets/icon.png
curl -o coin.png https://raw.githubusercontent.com/expo/expo/master/templates/expo-template-blank/assets/icon.png
curl -o logo.png https://raw.githubusercontent.com/expo/expo/master/templates/expo-template-blank/assets/icon.png
```

```
7. TypeScript 타입 정의 설치:
cd CryptoKittyRunner
yes | npm install --save-dev @types/matter-js
```

```
8. 앱 실행 명령어:
cd CryptoKittyRunner
npx expo start
```