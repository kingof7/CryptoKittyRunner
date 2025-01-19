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
```

```
7. TypeScript 타입 정의 설치:
cd CryptoKittyRunner
yes | npm install --save-dev @types/matter-js
```

```
8. 앱 실행 명령어:
cd CryptoKittyRunner
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:$PATH" && npx expo start
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

```
11. Kakao OAuth Client ID 설정
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:$PATH" && cd CryptoKittyRunner && yes | npm install @react-navigation/native @react-navigation/native-stack

export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:$PATH" && cd CryptoKittyRunner && yes | npm install @react-native-seoul/kakao-login matter-js @types/matter-js react-native-game-engine

```

```
12. 이더리움 설정
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:$PATH" && cd CryptoKittyRunner && yes | npm install ethers@5.7.2 crypto-js @types/crypto-js
```

```
13. Hardhat 설정
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:$PATH" && cd CryptoKittyRunner && yes | npm install @openzeppelin/contracts hardhat @nomiclabs/hardhat-ethers @nomiclabs/hardhat-waffle ethereum-waffle chai @types/chai
```

```
14. Hardhat Smart Contract 배포
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@20/bin:$PATH" && cd CryptoKittyRunner && npx hardhat run scripts/deploy.ts --network sepolia
```

```
15. 테스트넷(sepolia)에서 테스트용 ETH 제공받기
Sepolia 테스트넷에서 개발을 시작하기 위한 단계:

1.  MetaMask 지갑 복구 또는 생성:
  - Chrome 웹 스토어에서 MetaMask 설치
  - 새 지갑 생성 또는 기존 지갑 복구
  - Sepolia 테스트넷 추가 (Settings -> Networks -> Add Network)
  - MetaMask가 준비되면, 다음 Faucet에서 테스트용 ETH를 받을 수 있음:
  - https://sepoliafaucet.com
  - MetaMask 지갑 주소를 입력하고 테스트 ETH를 요청

2. Infura 계정생성:
  - https://infura.io에서 무료 계정 생성
  - 새 프로젝트 생성 (Create New Project)
  - Project ID 복사
  - .env 파일에 다음 정보 업데이트:
    - INFURA_PROJECT_ID: Infura에서 받은 Project ID
    - DEPLOYER_PRIVATE_KEY: MetaMask 지갑의 private key
```
```

16. 메인넷 전환 과정
- 환경 설정 변경
  1. .env 파일의 ETHEREUM_NETWORK를 'mainnet'으로 변경
  2. 실제 ETH가 있는 지갑의 private key 설정
  3. 메인넷용 Infura Project ID 설정

- 스마트 컨트랙트 재배포
  ```npx hardhat run scripts/deploy.ts --network mainnet
  ```

*** 주의: 실제 ETH 필요 (가스비 + 컨트랙트 배포비용)***
*** 가스비는 네트워크 상황에 따라 크게 변동될 수 있음***

- 메인넷 전환 전 체크리스트
  1. 스마트 컨트랙트 감사 (Audit)
     - 전문 감사 기관을 통한 보안 검증
     - Known vulnerabilities 체크
   
  2. 게임 경제 시뮬레이션
     - 일일 최대 채굴량 검증
     - 리워드 지속 가능성 확인
   
  3. 가스비 최적화
     - 배치 처리로 트랜잭션 수 최소화
     - 가스비 효율적인 시간대 선택
   
  4. 비상 시나리오 준비
     - 컨트랙트 일시 중지 기능
     - 리워드 지급 제한 기능
   
  5. 법적 검토
     - 게임물 등급 심의
     - 가상자산 관련 규제 준수

- 보안 및 경제성 강화
  1. 일일 채굴량 제한 설정
  2. 최소 출금액 상향 조정
  3. 난이도 및 보상 재조정
  4. 이상 행동 감지 시스템 구축
```

```
17. 가스비(Gas Fee) 설명
- 기본 개념
  - 이더리움 네트워크에서 트랜잭션(거래나 계약 실행)을 처리하기 위해 지불하는 수수료
  - 이더리움 네트워크를 사용하는 "사용료" 개념
  - 채굴자(validator)들에게 지불되는 보상
  - ETH로 지불됨

- 가스비 계산 방식
  ```
  총 가스비 = 가스 사용량 × 가스 가격
  - 가스 사용량: 작업의 복잡도에 따라 결정
  - 가스 가격: 네트워크 혼잡도에 따라 변동
  ```

- 게임에서의 가스비 발생 상황
  1. 스마트 컨트랙트 배포할 때
  2. 플레이어가 채굴한 리워드를 출금할 때
  3. 게임 운영자가 플레이어에게 리워드를 추가할 때

- 가스비 최적화 방법
  1. 여러 번의 작은 거래 대신 한 번에 모아서 처리
  2. 네트워크가 한산한 시간대에 거래
  3. 스마트 컨트랙트 코드 최적화

- 예시 가스비
  - 간단한 ETH 전송: 약 21,000 가스
  - 스마트 컨트랙트 배포: 약 1,000,000 가스 이상
  - 계산 예시 (가스 가격이 50 Gwei일 때):
    ```
    스마트 컨트랙트 배포 비용 = 1,000,000 × 50 Gwei = 0.05 ETH (약 $100~150)
    ```
  * 네트워크 상황에 따라 가스비가 크게 변동될 수 있음
```

## 보안 설정 가이드

### 1. 환경 변수 설정
1. `.env.example` 파일을 복사하여 `.env` 파일 생성
```bash
cp .env.example .env
```
2. `.env` 파일에 실제 값들을 입력
   - Firebase 설정
   - 스마트 컨트랙트 주소
   - OAuth 인증 정보
   - 게임 설정 값

### 2. 키스토어 설정 (Android 릴리즈 빌드용)
1. 키스토어 생성
```bash
./upload-keystore.sh
```
2. 생성된 키스토어 정보 안전하게 백업
3. `android/gradle.properties`에 키스토어 설정 추가

### 3. Firebase 설정
1. Firebase 콘솔에서 프로젝트 설정
2. 안드로이드/iOS 앱 등록
3. 설정 파일 다운로드:
   - Android: `google-services.json`를 `android/app/`에 복사
   - iOS: `GoogleService-Info.plist`를 `ios/`에 복사

### 4. 보안 주의사항
- 키스토어 파일 (.jks)은 절대 Git에 커밋하지 않기
- 환경 변수 파일 (.env)은 절대 Git에 커밋하지 않기
- Firebase 설정 파일은 절대 Git에 커밋하지 않기
- 개인 키나 토큰은 안전한 방식으로 관리