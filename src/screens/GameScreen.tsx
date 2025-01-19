import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Dimensions, TouchableOpacity, Text, Pressable, Alert } from 'react-native';
import { GameEngine } from 'react-native-game-engine';
import Matter from 'matter-js';
import Cat from '../components/Cat';
import Coin from '../components/Coin';
import GoldenCoin from '../components/GoldenCoin';
import Floor from '../components/Floor';
import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameScreenProps } from '../types/navigation';
import { MiningService } from '../services/MiningService';
import * as ethers from 'ethers';

const { width, height } = Dimensions.get('window');

interface GameEntities {
  physics: {
    engine: Matter.Engine;
    world: Matter.World;
  };
  cat: ReturnType<typeof Cat>;
  floor: ReturnType<typeof Floor>;
  [key: string]: any;
}

interface MiningStats {
  totalMined: number;
  combo: number;
  difficulty: number;
  lastMiningTime: number;
}

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
  const goldenCoinTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isButtonPressedRef = useRef(false);
  const miningServiceRef = useRef<MiningService | null>(null);

  useEffect(() => {
    setupWorld();
    startGoldenCoinSpawner();
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
      if (goldenCoinTimerRef.current) clearTimeout(goldenCoinTimerRef.current);
      clearInterval(statsInterval);
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

  const startGoldenCoinSpawner = () => {
    const spawnGoldenCoin = () => {
      if (Math.random() < 0.01) { // 1% 확률
        const randomY = Math.random() * (height - 400) + 100; // 점프로 도달할 수 있는 높이
        const goldenCoin = GoldenCoin(entitiesRef.current!.physics.world, {
          x: width + 50,
          y: randomY,
        });
        const coinId = `goldenCoin${Date.now()}`;
        if (entitiesRef.current) {
          entitiesRef.current[coinId] = goldenCoin;
        }
      }
      goldenCoinTimerRef.current = setTimeout(spawnGoldenCoin, 1000);
    };
    spawnGoldenCoin();
  };

  const setupWorld = () => {
    const engine = Matter.Engine.create({ enableSleeping: false });
    const world = engine.world;

    // Create floor
    const floor = Floor(world, { x: width / 2, y: height - 30 }, width);

    // Create cat
    const cat = Cat(world, { x: width / 4, y: height - 100 });

    // Create initial coins
    const coins = Array(5).fill(null).map((_, i) => {
      return Coin(world, { x: width + (i * 150), y: height - 200 });
    });

    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((collision) => {
        if (collision.bodyA.label === 'Cat') {
          if (collision.bodyB.label === 'Coin') {
            Matter.World.remove(world, collision.bodyB);
            setScore(prevScore => prevScore + 1);
            handleCoinCollection(false);
            // Add new coin
            const lastCoin = coins[coins.length - 1];
            coins.push(Coin(world, { x: lastCoin.pos.x + 150, y: height - 200 }));
          } else if (collision.bodyB.label === 'GoldenCoin') {
            Matter.World.remove(world, collision.bodyB);
            handleCoinCollection(true);
            setCanFly(true);
            setFlyingTimeLeft(15);
            if (flyingTimerRef.current) clearTimeout(flyingTimerRef.current);
            flyingTimerRef.current = setTimeout(() => {
              setCanFly(false);
              setIsFlying(false);
            }, 15000);
          } else if (collision.bodyB.label === 'Floor') {
            setJumpCount(0);
            setCombo(0); // Reset combo when touching the floor
          }
        }
      });
    });

    const entities: GameEntities = {
      physics: { engine, world },
      floor: floor,
      cat: cat,
      ...coins.reduce((acc, coin, i) => ({ ...acc, [`coin${i}`]: coin }), {}),
    };

    entitiesRef.current = entities;
    return entities;
  };

  const saveScore = async () => {
    try {
      const user = auth().currentUser;
      if (user) {
        const currentScore = await AsyncStorage.getItem('score') || '0';
        const newScore = parseInt(currentScore) + score;
        await AsyncStorage.setItem('score', newScore.toString());

        await database()
          .ref(`users/${user.uid}/score`)
          .set(newScore);
      }
    } catch (error) {
      console.error('Error saving score:', error);
    }
  };

  const onJump = () => {
    if (!canFly && jumpCount < 2 && entitiesRef.current?.cat) {
      Matter.Body.setVelocity(entitiesRef.current.cat.body, { x: 0, y: -10 });
      setJumpCount(prev => prev + 1);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      navigation.replace('Login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleFlyingPress = () => {
    if (canFly && entitiesRef.current?.cat) {
      isButtonPressedRef.current = true;
      setIsFlying(true);
    }
  };

  const handleFlyingRelease = () => {
    isButtonPressedRef.current = false;
    setIsFlying(false);
  };

  const Physics = (entities: GameEntities, { time }: { time: { delta: number } }) => {
    const engine = entities.physics.engine;
    Matter.Engine.update(engine, time.delta);

    // Move coins to the left
    Object.keys(entities).forEach(key => {
      if (key.startsWith('coin') || key.startsWith('goldenCoin')) {
        const coin = entities[key];
        Matter.Body.translate(coin.body, { x: -2, y: 0 });

        // If coin goes off screen, remove it and add new one
        if (coin.body.position.x < -50) {
          Matter.World.remove(entities.physics.world, coin.body);
          delete entities[key];

          if (key.startsWith('coin')) {
            // Add new regular coin
            const newCoin = Coin(entities.physics.world, {
              x: width + 150,
              y: height - 200 - Math.random() * 200
            });
            entities[`coin${Date.now()}`] = newCoin;
          }
        }
      }
    });

    // Apply gravity or flying physics to cat
    const cat = entities.cat;
    if (canFly && isButtonPressedRef.current) {
      // Flying physics
      const upwardForce = -0.5 - (time.delta * 0.001); // 가속도 적용
      Matter.Body.translate(cat.body, { x: 0, y: upwardForce });
    } else if (!canFly && cat.body.position.y < height - 100) {
      // Normal gravity
      Matter.Body.translate(cat.body, { x: 0, y: 0.5 });
    } else if (canFly && !isButtonPressedRef.current && cat.body.position.y < height - 100) {
      // Slow descent when flying but not pressing
      Matter.Body.translate(cat.body, { x: 0, y: 0.2 });
    }

    // Update renderers
    Object.keys(entities).forEach(key => {
      if (entities[key].body) {
        const { body, renderer } = entities[key];
        if (renderer) {
          const updatedRenderer = React.cloneElement(renderer, {
            style: {
              ...renderer.props.style,
              left: body.position.x - (renderer.props.style.width / 2),
              top: body.position.y - (renderer.props.style.height / 2),
            },
          });
          entities[key].renderer = updatedRenderer;
        }
      }
    });

    return entities;
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
        <View>
          <Text style={styles.scoreText}>Score: {score}</Text>
          <Text style={styles.ethText}>
            ETH Mined: {miningStats.totalMined.toFixed(6)}
          </Text>
          {miningStats.combo > 0 && (
            <Text style={[styles.comboText, { color: getComboColor(miningStats.combo) }]}>
              Combo: {miningStats.combo}x
            </Text>
          )}
        </View>
        {canFly && (
          <Text style={styles.flyingText}>Flying: {flyingTimeLeft}s</Text>
        )}
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
      <GameEngine
        ref={gameEngineRef}
        style={styles.gameContainer}
        systems={[Physics]}
        entities={setupWorld()}
        running={running}
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
    backgroundColor: '#F5FCFF',
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
  gameContainer: {
    flex: 1,
    backgroundColor: '#87CEEB',
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
