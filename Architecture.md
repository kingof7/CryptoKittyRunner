# CryptoKittyRunner Architecture

## Project Structure
// 전체 앱의 구조와 주요 컴포넌트 간의 관계를 보여주는 다이어그램

```mermaid
graph TD
    %% 메인 앱과 네비게이션
    App[App.tsx] --> Nav[Navigation]
    Nav --> Login[LoginScreen]
    Nav --> Game[GameScreen]
    Nav --> Wallet[WalletScreen]
    
    %% 게임 엔진 및 물리 엔진
    Game --> GameEngine[Game Engine]
    GameEngine --> Physics[Matter.js Physics]
    GameEngine --> Components[Game Components]
    Components --> Cat[Cat.tsx]
    Components --> Floor[Floor.tsx]
    
    %% 서비스 레이어
    Game --> Services[Services]
    Services --> Mining[MiningService]
    Services --> Reward[RewardService]
    
    %% 블록체인 연동
    Mining --> Contract[Smart Contract]
    Reward --> Contract
    
    %% 로컬 저장소
    Mining --> Storage[AsyncStorage]
```

## Component Architecture
// 각 컴포넌트의 상세 구조와 관계를 보여주는 클래스 다이어그램

```mermaid
classDiagram
    %% 메인 앱 컴포넌트
    class App {
        +NavigationContainer %% 네비게이션 컨테이너
        +Stack.Navigator %% 스택 네비게이터
    }
    
    %% 게임 화면 컴포넌트
    class GameScreen {
        -engine: GameEngine %% 게임 엔진 인스턴스
        -running: boolean %% 게임 실행 상태
        -score: number %% 현재 점수
        -miningStats: MiningStats %% 채굴 통계
        +handleMining() %% 채굴 처리 함수
        +setupWorld() %% 게임 월드 초기화
    }
    
    %% 지갑 화면 컴포넌트
    class WalletScreen {
        -pendingRewards: number %% 대기 중인 보상
        -minWithdrawAmount: number %% 최소 출금 금액
        +withdrawRewards() %% 보상 출금 함수
        +fetchRewards() %% 보상 조회 함수
    }
    
    %% 채굴 서비스
    class MiningService {
        -miningStats: MiningStats %% 채굴 통계 정보
        -rewardService: RewardService %% 보상 서비스 인스턴스
        +mineCoin() %% 코인 채굴 함수
        +updateCombo() %% 콤보 업데이트
    }
    
    %% 보상 서비스
    class RewardService {
        -contract: GameTokenContract %% 스마트 컨트랙트 인스턴스
        -provider: JsonRpcProvider %% 이더리움 프로바이더
        +addReward() %% 보상 추가 함수
        +withdrawRewards() %% 보상 출금 함수
    }
    
    %% 컴포넌트 간의 관계
    App --> GameScreen
    App --> WalletScreen
    GameScreen --> MiningService
    MiningService --> RewardService
```

## Data Flow
// 게임 플레이 중 데이터의 흐름을 보여주는 시퀀스 다이어그램

```mermaid
sequenceDiagram
    %% 참여자 정의
    participant User
    participant GameScreen
    participant MiningService
    participant RewardService
    participant Contract
    participant Storage
    
    %% 코인 수집 및 채굴 프로세스
    User->>GameScreen: Collect Coin %% 사용자가 코인 수집
    GameScreen->>MiningService: mineCoin() %% 채굴 시작
    MiningService->>MiningService: Calculate Hash %% 해시 계산
    MiningService->>RewardService: addReward() %% 보상 추가
    RewardService->>Contract: Record Reward %% 블록체인에 기록
    MiningService->>Storage: Save Stats %% 로컬 저장소에 통계 저장
    Contract-->>User: ETH Rewards %% 사용자에게 ETH 보상
```

## Smart Contract Structure
// 게임 토큰 스마트 컨트랙트의 구조를 보여주는 클래스 다이어그램

```mermaid
classDiagram
    class GameToken {
        +mapping(address => uint256) pendingRewards %% 주소별 대기 중인 보상
        +uint256 minWithdrawAmount %% 최소 출금 금액
        +uint256 totalRewardsDistributed %% 총 분배된 보상
        +addReward(address, uint256) %% 보상 추가 함수
        +withdrawRewards() %% 보상 출금 함수
        +getPendingReward(address) %% 대기 중인 보상 조회
    }
```

## Directory Structure
// 프로젝트의 파일 시스템 구조

```
CryptoKittyRunner/
├── src/                      # 소스 코드 디렉토리
│   ├── components/           # 재사용 가능한 컴포넌트
│   │   ├── Cat.tsx          # 고양이 캐릭터 컴포넌트
│   │   └── Floor.tsx        # 바닥 컴포넌트
│   ├── screens/             # 화면 컴포넌트
│   │   ├── GameScreen.tsx   # 게임 화면
│   │   ├── LoginScreen.tsx  # 로그인 화면
│   │   └── WalletScreen.tsx # 지갑 화면
│   ├── services/            # 서비스 레이어
│   │   ├── MiningService.ts # 채굴 서비스
│   │   └── RewardService.ts # 보상 서비스
│   └── types/               # 타입 정의
│       ├── contracts.d.ts   # 컨트랙트 타입
│       ├── mining.ts        # 채굴 관련 타입
│       └── navigation.ts    # 네비게이션 타입
├── contracts/               # 스마트 컨트랙트
│   └── GameToken.sol       # 게임 토큰 컨트랙트
├── App.tsx                 # 앱 진입점
└── package.json           # 프로젝트 설정
```

## Technology Stack
// 사용된 기술 스택과 그들 간의 관계를 보여주는 다이어그램

```mermaid
graph LR
    %% 프론트엔드
    Frontend[React Native] --> GameEngine[react-native-game-engine]
    GameEngine --> Physics[matter-js]
    
    %% 블록체인 연동
    Frontend --> Blockchain[Ethereum]
    Blockchain --> Contract[Smart Contract]
    Contract --> Network[Sepolia/Mainnet]
    
    %% 로컬 저장소
    Frontend --> Storage[AsyncStorage]
```

## Environment Configuration
// 환경 설정 파일의 구조를 보여주는 다이어그램

```mermaid
graph TD
    %% 환경 변수
    ENV[.env] --> Network[ETHEREUM_NETWORK]
    ENV --> Infura[INFURA_PROJECT_ID]
    ENV --> Contract[GAME_CONTRACT_ADDRESS]
    
    %% 채굴 설정
    ENV --> Mining[Mining Configuration]
    Mining --> Difficulty[MINING_DIFFICULTY]
    Mining --> Rewards[MINING_REWARDS]