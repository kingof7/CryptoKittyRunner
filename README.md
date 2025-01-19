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

```
9. web으로 실행시 패키지 설치
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:$PATH"
yes | npx expo install react-dom react-native-web @expo/metro-runtime
```

```
10. Google OAuth Client ID 설정

Google Cloud Console(https://console.cloud.google.com/)에 접속
새 프로젝트 생성 또는 기존 프로젝트 선택
"API 및 서비스" > "사용자 인증 정보"로 이동
"사용자 인증 정보 만들기" > "OAuth 클라이언트 ID" 선택
애플리케이션 유형에 따라 다음 클라이언트 ID를 생성:
iOS 앱용
Android 앱용
웹 애플리케이션용
각각의 클라이언트 ID를 생성할 때 필요한 정보:

iOS 앱:
Bundle ID: com.cryptokittyrunner
Android 앱:
패키지 이름: com.cryptokittyrunner
웹 애플리케이션:
승인된 리디렉션 URI: https://auth.expo.io/@your-expo-username/CryptoKittyRunner
생성된 클라이언트 ID들을 LoginScreen.tsx의 해당 위치에 넣으면 Google 로그인이 정상적으로 작동할 것입니다.
```