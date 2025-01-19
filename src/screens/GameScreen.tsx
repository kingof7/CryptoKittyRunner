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
  AppStateStatus,
  StatusBar
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

// 엔티티 타입 정의
interface PhysicsEntity {
  engine: Matter.Engine;
  world: Matter.World;
}

interface GameEntity {
  body: Matter.Body;
  renderer: (props: any) => React.ReactNode;
  pos?: { x: number; y: number };
}

interface GameEntities {
  physics: PhysicsEntity;
  cat?: GameEntity;
  floor?: GameEntity;
  [key: string]: PhysicsEntity | GameEntity | undefined;
}

// 타입 가드 함수
const isGameEntity = (entity: any): entity is GameEntity => {
  return entity && 'body' in entity;
};

const GameScreen: React.FC<GameScreenProps> = ({ navigation }) => {
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);
  const [ethPoints, setEthPoints] = useState(0);
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
  const collisionRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const entities = setupWorld();
    entitiesRef.current = entities;
    initializeMiningService();

    const updateMiningStats = () => {
      if (miningServiceRef.current) {
        setMiningStats(miningServiceRef.current.getStats());
      }
    };

    const statsInterval = setInterval(updateMiningStats, 1000);

    return () => {
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

  const handleCoinCollection = async (isGold: boolean) => {
    // 일반 코인은 0.001 ETH, 골드 코인은 0.005 ETH
    const ethValue = isGold ? 0.005 : 0.001;
    setEthPoints(prev => prev + ethValue);

    // 코인 획득 효과음 재생 또는 시각적 효과 추가 가능
  };

  const handleCoinCollision = (coinBody: Matter.Body, isGold: boolean) => {
    const coinId = coinBody.id.toString();

    // 이미 처리된 충돌인지 확인
    if (collisionRef.current[coinId]) {
      return;
    }

    // 충돌 처리 표시
    collisionRef.current[coinId] = true;

    try {
      if (!entitiesRef.current) return;

      // 코인 제거
      Matter.World.remove(entitiesRef.current.physics.world, coinBody);

      // ETH 포인트 증가
      handleCoinCollection(isGold);

      // 새로운 코인 생성
      const newCoin = createCoin(entitiesRef.current.physics.world, {
        x: width + Math.random() * 100,
        y: height / 3 - Math.random() * 50
      }, isGold);

      // 이전 코인 엔티티 제거
      const coinEntities = { ...entitiesRef.current };
      Object.entries(coinEntities).forEach(([key, entity]) => {
        if (isGameEntity(entity) && entity.body === coinBody) {
          delete entitiesRef.current![key];
        }
      });

      // 새 코인 엔티티 추가
      const newCoinId = `coin${Date.now()}`;
      entitiesRef.current[newCoinId] = {
        body: newCoin.body,
        renderer: (props: any) => isGold ? <Gold body={newCoin.body} /> : <Coin body={newCoin.body} />
      };
    } catch (error) {
      console.error('Error handling coin collision:', error);
    } finally {
      // 일정 시간 후 충돌 상태 초기화
      setTimeout(() => {
        delete collisionRef.current[coinId];
      }, 100);
    }
  };

  const spawnGold = () => {
    if (!entitiesRef.current?.physics?.world) {
      console.log('Physics world not initialized');
      return;
    }

    try {
      // 골드 코인 생성
      const goldCoin = createCoin(
        entitiesRef.current.physics.world,
        {
          x: width + Math.random() * 100,
          y: height / 3 - Math.random() * 50
        },
        true  // isGold = true
      );

      if (goldCoin && entitiesRef.current) {
        const coinId = `Gold${Date.now()}`;
        entitiesRef.current[coinId] = {
          body: goldCoin.body,
          renderer: (props: any) => <Gold body={goldCoin.body} />
        };
      }
    } catch (error) {
      console.error('Error spawning gold:', error);
    }
  };

  // 게임 시작 시 골드 코인 스폰 타이머 설정
  useEffect(() => {
    if (running) {
      const goldSpawnInterval = setInterval(() => {
        spawnGold();
      }, 10000);  // 10초마다 골드 코인 생성

      return () => {
        clearInterval(goldSpawnInterval);
      };
    }
  }, [running]);

  const saveScore = async () => {
    try {
      const currentScore = await AsyncStorage.getItem('score') || '0';
      const newScore = parseInt(currentScore) + score;
      await AsyncStorage.setItem('score', newScore.toString());
    } catch (error) {
      console.error('Error saving score:', error);
    }
  };

  const resetJumpCount = () => {
    setJumpCount(0);
  };

  const handleFloorCollision = () => {
    resetJumpCount();
  };

  const gameLoop = (entities: GameEntities) => {
    if (!running) return entities;
    const engine = entities.physics.engine;
    const world = entities.physics.world;

    // 코인 이동 및 재활용
    Object.entries(entities).forEach(([key, entity]) => {
      if (key.startsWith('coin') && isGameEntity(entity)) {
        const coin = entity.body;
        Matter.Body.setPosition(coin, {
          x: coin.position.x - 2,
          y: coin.position.y
        });

        // 화면 밖으로 나간 코인 재활용
        if (coin.position.x < -30) {
          Matter.Body.setPosition(coin, {
            x: width + 30,
            y: height / 3 - Math.random() * 50  // 화면 높이의 1/3보다 높은 위치에 랜덤 배치
          });
        }
      }
    });

    return entities;
  };

  const updateGame = (entities: GameEntities) => {
    if (!running) return entities;

    const engine = entities.physics.engine;
    Matter.Engine.update(engine, 16);

    return entities;
  };

  const setupCoins = (world: Matter.World) => {
    const initialCoins: { [key: string]: GameEntity } = {};
    Array(5).fill(null).forEach((_, i) => {
      const coin = createCoin(
        world,
        {
          x: width / 2 + (i * 200),
          y: height / 3 - Math.random() * 50  // 화면 높이의 1/3보다 높은 위치에 랜덤 배치
        }
      );
      initialCoins[`coin${i}`] = {
        body: coin.body,
        renderer: (props: any) => <Coin body={coin.body} />
      };
    });
    return initialCoins;
  };

  const setupWorld = () => {
    const engine = Matter.Engine.create({
      enableSleeping: false,
      gravity: { x: 0, y: 1 }
    });
    const world = engine.world;

    const floorY = (height * 2) / 3;

    // 바닥 생성
    const floor = Matter.Bodies.rectangle(
      width / 2,
      floorY,
      width,
      60,
      {
        isStatic: true,
        label: 'floor',
        friction: 0.5,
        restitution: 0,
      }
    );

    // 고양이 생성
    const cat = Matter.Bodies.rectangle(
      width / 4,
      floorY - 72,
      72,
      72,
      {
        label: 'cat',
        friction: 0.5,
        restitution: 0,
        inertia: Infinity,
        inverseInertia: 0
      }
    );

    // 물리 엔진에 객체 추가
    Matter.World.add(world, [floor, cat]);

    // 충돌 이벤트 설정
    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((collision) => {
        const bodyA = collision.bodyA;
        const bodyB = collision.bodyB;

        if (!bodyA || !bodyB) return;

        const catBody = bodyA.label === 'cat' ? bodyA : (bodyB.label === 'cat' ? bodyB : null);
        const otherBody = catBody === bodyA ? bodyB : bodyA;

        if (catBody && otherBody) {
          switch (otherBody.label) {
            case 'coin':
              handleCoinCollision(otherBody, false);
              break;
            case 'gold':
              handleCoinCollision(otherBody, true);
              break;
            case 'floor':
              handleFloorCollision();
              break;
          }
        }
      });
    });

    // 초기 엔티티 생성
    const entities: GameEntities = {
      physics: { engine, world },
      cat: {
        body: cat,
        renderer: (props: any) => <Cat body={cat} />
      },
      floor: {
        body: floor,
        renderer: (props: any) => (
          <View
            style={{
              position: 'absolute',
              left: width / 2 - width / 2,
              top: floorY - 30,
              width: width,
              height: 60,
              backgroundColor: '#2E8B57',
            }}
          />
        )
      }
    };

    // 코인 추가
    const coins = setupCoins(world);
    Object.entries(coins).forEach(([key, coin]) => {
      entities[key] = coin;
    });

    // entitiesRef 업데이트
    entitiesRef.current = entities;

    return entities;
  };

  // 물리 엔진 업데이트 시스템
  const Physics = (entities: GameEntities) => {
    const { engine } = entities.physics;
    Matter.Engine.update(engine, 16.666);
    return entities;
  };

  const onJump = () => {
    const catEntity = entitiesRef.current?.cat;
    if (catEntity && isGameEntity(catEntity)) {
      const catBody = catEntity.body;

      // 바닥 충돌 확인을 위한 y 속도 체크
      const isOnGround = Math.abs(catBody.velocity.y) < 0.1;

      console.log('Jump triggered', {
        isOnGround,
        jumpCount,
        position: catBody.position,
        velocity: catBody.velocity
      });

      if (isOnGround || jumpCount < 2) {
        let jumpForce;

        if (isOnGround) {
          jumpForce = -20;  // 첫 번째 점프
          setJumpCount(1);
        } else if (jumpCount === 1) {
          jumpForce = -25;  // 두 번째 점프
          setJumpCount(2);
        }

        if (jumpForce) {
          // 점프 힘 적용
          Matter.Body.setVelocity(catBody, {
            x: catBody.velocity.x,
            y: jumpForce
          });

          console.log('Applied jump force', jumpForce);
        }
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
      setEthPoints(0);
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

  const EthPointsDisplay = () => (
    <View style={{
      position: 'absolute',
      top: 50,
      right: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: 10,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
    }}>
      <Text style={{
        color: '#00ff00',
        fontSize: 24,
        fontWeight: 'bold',
      }}>
        {ethPoints.toFixed(3)} ETH
      </Text>
    </View>
  );

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
        systems={[updateGame, gameLoop, Physics]}
        entities={setupWorld()}
        running={running}
        onEvent={(e) => {
          if (e.type === 'game-over') {
            setRunning(false);
          }
        }}
      >
        <StatusBar hidden={true} />
        <EthPointsDisplay />
        <TouchableOpacity
          onPress={onJump}
          style={{
            position: 'absolute',
            bottom: 50,
            right: 30,
            width: 100,
            height: 100,
            backgroundColor: 'rgba(0, 255, 0, 0.3)',
            borderRadius: 50,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#00ff00',
          }}
        >
          <Text style={{
            color: '#fff',
            fontSize: 24,
            fontWeight: 'bold',
          }}>
            JUMP
          </Text>
        </TouchableOpacity>
      </GameEngine>
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
    backgroundColor: '#87CEEB',  // 하늘색 배경
  },
  gameContainer: {
    flex: 1,
    backgroundColor: '#87CEEB',  // 하늘색 배경
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
    right: 30,
    width: 100,
    height: 100,
    backgroundColor: 'rgba(0, 255, 0, 0.3)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00ff00',
    zIndex: 1000,
  },
  flyingButton: {
    backgroundColor: '#FFD700',
  },
  jumpButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default GameScreen;
