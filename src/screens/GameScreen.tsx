import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  TouchableOpacity,
  Text,
  Pressable,
  Alert,
  AppState,
  AppStateStatus
} from 'react-native';
import { GameEngine } from 'react-native-game-engine';
import Matter from 'matter-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameScreenProps } from '../types/navigation';
import { MiningService } from '../services/MiningService';
import { MiningStats } from '../types/mining';
import * as ethers from 'ethers';
import Cat from '../components/Cat';
import Coin from '../components/Coin';
import Gold from '../components/Gold';

const { width, height } = Dimensions.get('window');

// 물리 엔진 객체 생성 함수들
const createCat = (world: Matter.World, pos: { x: number; y: number }) => {
  const body = Matter.Bodies.rectangle(
    pos.x,
    pos.y,
    72,  // 물리적 크기도 72x72로 조정
    72,
    {
      label: 'cat',
      friction: 1,
      restitution: 0.2,
      mass: 1,
    }
  );
  Matter.World.add(world, body);
  return { body, pos };
};

const createCoin = (world: Matter.World, pos: { x: number; y: number }, isGolden: boolean = false) => {
  const body = Matter.Bodies.circle(pos.x, pos.y, 15, {
    isSensor: true,
    isStatic: true,  // 코인을 정적으로 변경
    label: isGolden ? 'gold' : 'coin',
  });
  Matter.World.add(world, body);
  return { body, pos };
};

interface EntityRenderer {
  type: 'cat' | 'coin' | 'gold';
  props: any;
}

interface Entity {
  body: Matter.Body;
  renderer: (props: any) => JSX.Element;
  pos: { x: number; y: number };
}

interface PhysicsEntity {
  engine: Matter.Engine;
  world: Matter.World;
}

interface GameEntities {
  physics: PhysicsEntity;
  cat: Entity;
  [key: string]: Entity | PhysicsEntity;
}

// Entity 타입 가드 함수 추가
const isEntity = (entity: Entity | PhysicsEntity): entity is Entity => {
  return 'body' in entity && 'renderer' in entity;
};

const isPhysicsEntity = (entity: Entity | PhysicsEntity): entity is PhysicsEntity => {
  return 'engine' in entity && 'world' in entity;
};

const GameScreen: React.FC<GameScreenProps> = ({ navigation }) => {
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [canFly, setCanFly] = useState(false);
  const [jumpCount, setJumpCount] = useState(0);
  const [flyingTimeLeft, setFlyingTimeLeft] = useState(0);
  const [ethMined, setEthMined] = useState(0);
  const [combo, setCombo] = useState(0);
  const [miningStats, setMiningStats] = useState<MiningStats>({
    totalMined: 0,
    combo: 0,
    difficulty: 1,
    lastMiningTime: 0
  });
  const gameEngineRef = useRef<GameEngine>(null);
  const entitiesRef = useRef<GameEntities | null>(null);
  const flyingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const GoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isButtonPressedRef = useRef(false);
  const miningServiceRef = useRef<MiningService | null>(null);
  const appState = useRef(AppState.currentState);
  const backgroundTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setupWorld();
    startGoldSpawner();
    initializeMiningService();
    const updateMiningStats = () => {
      if (miningServiceRef.current) {
        setMiningStats(miningServiceRef.current.getStats());
      }
    };

    const statsInterval = setInterval(updateMiningStats, 1000);
    return () => {
      saveScore();
      if (flyingTimerRef.current) clearTimeout(flyingTimerRef.current);
      if (GoldTimerRef.current) clearTimeout(GoldTimerRef.current);
      clearInterval(statsInterval);
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (backgroundTimer.current) {
        clearTimeout(backgroundTimer.current);
      }
    };
  }, []);

  const initializeMiningService = async () => {
    try {
      // 실제 구현시에는 안전한 방법으로 private key를 관리해야 합니다
      const privateKey = await AsyncStorage.getItem('wallet_private_key');
      if (privateKey) {
        miningServiceRef.current = new MiningService(privateKey);
      } else {
        // 테스트용 지갑 생성 (실제 서비스에서는 이렇게 하면 안 됩니다)
        const wallet = ethers.Wallet.createRandom();
        await AsyncStorage.setItem('wallet_private_key', wallet.privateKey);
        miningServiceRef.current = new MiningService(wallet.privateKey);
      }
    } catch (error) {
      console.error('Error initializing mining service:', error);
    }
  };

  const handleCoinCollection = async (isGolden: boolean) => {
    if (!miningServiceRef.current) return;

    try {
      const result = await miningServiceRef.current.mineCoin(isGolden);
      if (result.success && result.reward) {
        setMiningStats(miningServiceRef.current.getStats());

        // Show mining success message with animation
        Alert.alert(
          'Mining Success! 🎉',
          `Mined ${result.reward.toFixed(6)} ETH\n` +
          `Combo: ${miningStats.combo + 1}x\n` +
          `Total Mined: ${(miningStats.totalMined + result.reward).toFixed(6)} ETH`,
          [{ text: 'OK' }],
          { cancelable: true }
        );
      }
    } catch (error) {
      console.error('Mining error:', error);
    }
  };

  const startGoldSpawner = () => {
    const spawnGold = () => {
      if (Math.random() < 0.01) { // 1% 확률
        const randomY = Math.random() * (height - 400) + 100; // 점프로 도달할 수 있는 높이
        const goldCoin = createCoin(entitiesRef.current!.physics.world, {
          x: width + 50,
          y: randomY,
        }, true);
        const coinId = `Gold${Date.now()}`;
        if (entitiesRef.current) {
          entitiesRef.current[coinId] = {
            ...goldCoin,
            renderer: (props: any) => <Gold body={goldCoin.body} />
          };
        }
      }
      GoldTimerRef.current = setTimeout(spawnGold, 1000);
    };
    spawnGold();
  };

  const setupWorld = () => {
    const engine = Matter.Engine.create({ enableSleeping: false });
    const world = engine.world;

    engine.world.gravity.y = 0.8;

    // 바닥 생성
    const floor = Matter.Bodies.rectangle(
      width / 2,
      height - 30,
      width,
      60,
      {
        isStatic: true,
        label: 'floor',
        friction: 1,
        restitution: 0.2,
      }
    );
    Matter.World.add(world, floor);

    // 고양이 캐릭터 생성
    const cat = createCat(world, {
      x: width / 4,
      y: height - 250  // 코인과 같은 높이로 조정
    });
    const catEntity: Entity = {
      ...cat,
      renderer: (props: any) => <Cat body={cat.body} />
    };

    // 초기 코인 생성 - 다양한 높이에 배치
    const initialCoins: { [key: string]: Entity } = {};
    Array(5).fill(null).forEach((_, i) => {
      const coin = createCoin(
        world,
        {
          x: width / 2 + (i * 200),  // 코인 간격을 200으로 늘림
          y: height - 250 + (Math.random() * 50)  // 점프로 먹을 수 있는 높이로 조정
        }
      );
      initialCoins[`coin${i}`] = {
        ...coin,
        renderer: (props: any) => <Coin body={coin.body} />
      };
    });

    const entities: GameEntities = {
      physics: { engine, world },
      cat: catEntity,
      floor: {
        body: floor,
        renderer: (props: any) => (
          <View
            style={{
              position: 'absolute',
              left: width / 2 - width / 2,
              top: height - 60,
              width: width,
              height: 60,
              backgroundColor: '#2E8B57',  // 초록색 바닥
            }}
          />
        ),
        pos: { x: width / 2, y: height - 30 }
      }
    };

    // Add coins with their renderers
    Object.entries(initialCoins).forEach(([key, coin]) => {
      entities[key] = coin;
    });

    // 충돌 이벤트 설정
    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((collision) => {
        if (collision.bodyA.label === 'cat') {
          if (collision.bodyB.label === 'coin') {
            Matter.World.remove(world, collision.bodyB);
            setScore(prevScore => prevScore + 1);
            handleCoinCollection(false);

            // 새로운 코인 생성 - 화면 오른쪽 랜덤한 높이에 생성
            const newCoin = createCoin(world, {
              x: width + Math.random() * 100,
              y: height - 250 + (Math.random() * 50)  // 새로운 코인도 같은 높이 범위에 생성
            });

            if (entitiesRef.current) {
              const coinId = `coin${Date.now()}`;
              entitiesRef.current[coinId] = {
                ...newCoin,
                renderer: (props: any) => <Coin body={newCoin.body} />
              };
            }
          } else if (collision.bodyB.label === 'gold') {
            Matter.World.remove(world, collision.bodyB);
            setScore(prevScore => prevScore + 5);
            handleCoinCollection(true);
          }
        }
      });
    });

    entitiesRef.current = entities;
    return entities;
  };

  const gameLoop = (entities: GameEntities) => {
    if (!running) return entities;
    const engine = entities.physics.engine;
    const world = entities.physics.world;

    Matter.Engine.update(engine, 16.666);

    // 코인 이동 및 재활용
    Object.entries(entities).forEach(([key, entity]) => {
      if (key.startsWith('coin') && isEntity(entity)) {
        const coin = entity.body;
        Matter.Body.setPosition(coin, {
          x: coin.position.x - 2,
          y: coin.position.y
        });

        // 화면 밖으로 나간 코인 재활용
        if (coin.position.x < -30) {
          Matter.Body.setPosition(coin, {
            x: width + 30,
            y: height / 4 + Math.random() * (height / 2)
          });
        }
      }
    });

    // 플라잉 모드에서 고양이 상승/하강
    if (isButtonPressedRef.current && entitiesRef.current?.cat && canFly) {
      Matter.Body.setVelocity(entitiesRef.current.cat.body, {
        x: 0,
        y: -5
      });
    } else if (entitiesRef.current?.cat) {
      // 중력 효과로 천천히 하강
      const currentVelocity = entitiesRef.current.cat.body.velocity;
      Matter.Body.setVelocity(entitiesRef.current.cat.body, {
        x: 0,
        y: Math.min(currentVelocity.y + 0.2, 5)  // 최대 하강 속도 제한
      });
    }

    return entities;
  };

  const updateGame = (entities: GameEntities) => {
    const engine = entities.physics.engine;
    Matter.Engine.update(engine, 16);

    return entities;
  };

  const saveScore = async () => {
    try {
      // Firebase 임시 비활성화
      // const user = auth().currentUser;
      // if (user) {
      const currentScore = await AsyncStorage.getItem('score') || '0';
      const newScore = parseInt(currentScore) + score;
      await AsyncStorage.setItem('score', newScore.toString());
      // await database()
      //   .ref(`users/${user.uid}/score`)
      //   .set(newScore);
      // }
    } catch (error) {
      console.error('Error saving score:', error);
    }
  };

  const onJump = () => {
    if (entitiesRef.current?.cat) {
      const catBody = entitiesRef.current.cat.body;
      // 현재 속도를 확인하여 바닥에 있는지 체크
      const isOnGround = Math.abs(catBody.velocity.y) < 0.1;

      if (isOnGround) {
        Matter.Body.setVelocity(catBody, {
          x: catBody.velocity.x,
          y: -20  // 점프력 증가
        });
      }
    }
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
      // 앱이 백그라운드로 전환될 때
      console.log('앱이 백그라운드로 전환됩니다.');

      // 30초 타이머 시작
      backgroundTimer.current = setTimeout(() => {
        handleForceLogout();
      }, 30000); // 30초
    } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // 앱이 포그라운드로 돌아올 때
      console.log('앱이 포그라운드로 돌아왔습니다.');

      // 타이머 취소
      if (backgroundTimer.current) {
        clearTimeout(backgroundTimer.current);
        backgroundTimer.current = null;
      }
    }
    appState.current = nextAppState;
  };

  const handleForceLogout = async () => {
    try {
      // 게임 상태 저장
      await saveScore();

      // 로그인 토큰 삭제
      await AsyncStorage.multiRemove([
        'userToken',
        'kakaoAccessToken',
        'kakaoRefreshToken',
        'googleToken'
      ]);

      // 파이어베이스 로그아웃
      // await auth().signOut();

      // 게임 상태 초기화
      setRunning(false);
      setScore(0);
      setEthMined(0);
      setCombo(0);

      // 로그인 화면으로 이동
      navigation.replace('Login');
    } catch (error) {
      console.error('Force logout error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      // 타이머가 있다면 취소
      if (backgroundTimer.current) {
        clearTimeout(backgroundTimer.current);
        backgroundTimer.current = null;
      }

      await handleForceLogout();
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('로그아웃 실패', '로그아웃 중 오류가 발생했습니다.');
    }
  };

  const handleFlyingPress = () => {
    if (canFly && entitiesRef.current?.cat) {
      isButtonPressedRef.current = true;
      setIsFlying(true);

      const catBody = entitiesRef.current.cat.body;
      Matter.Body.setVelocity(catBody, {
        x: catBody.velocity.x,
        y: -5  // 상승 속도
      });
    }
  };

  const handleFlyingRelease = () => {
    isButtonPressedRef.current = false;
    setIsFlying(false);
  };

  const getComboColor = (combo: number): string => {
    const colors = [
      '#FFFFFF',   // 1x
      '#90EE90',   // 2x
      '#87CEEB',   // 3x
      '#DDA0DD',   // 4x
      '#FFD700'    // 5x
    ];
    return colors[Math.min(combo - 1, colors.length - 1)];
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.scoreText}>Score: {score}</Text>
        <Text style={styles.ethText}>ETH: {ethMined.toFixed(6)}</Text>
        <Text style={[styles.comboText, { color: getComboColor(combo) }]}>
          Combo: {combo}x
        </Text>
      </View>
      <GameEngine
        ref={gameEngineRef}
        style={styles.gameContainer}
        systems={[updateGame, gameLoop]}
        entities={setupWorld()}
        running={running}
        onEvent={(e) => {
          if (e.type === 'game-over') {
            setRunning(false);
          }
        }}
      />
      {canFly ? (
        <Pressable
          style={[styles.jumpButton, isFlying && styles.flyingButton]}
          onPressIn={handleFlyingPress}
          onPressOut={handleFlyingRelease}
        >
          <Text style={styles.jumpButtonText}>FLY</Text>
        </Pressable>
      ) : (
        <TouchableOpacity
          style={styles.jumpButton}
          onPress={onJump}
          activeOpacity={0.7}
        >
          <Text style={styles.jumpButtonText}>JUMP</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#87CEEB', // 하늘색 배경
  },
  gameContainer: {
    flex: 1,
    backgroundColor: '#87CEEB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#4285F4',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  ethText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  comboText: {
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  flyingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  logoutText: {
    fontSize: 16,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  jumpButton: {
    position: 'absolute',
    bottom: 50,
    right: 50,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  flyingButton: {
    backgroundColor: '#FFD700',
  },
  jumpButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default GameScreen;
