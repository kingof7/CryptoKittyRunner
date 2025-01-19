import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Dimensions, TouchableOpacity } from 'react-native';
import { GameEngine } from 'react-native-game-engine';
import Matter from 'matter-js';
import Cat from '../components/Cat';
import Coin from '../components/Coin';
import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface GameEntities {
  physics: {
    engine: Matter.Engine;
    world: Matter.World;
  };
  cat: ReturnType<typeof Cat>;
  [key: string]: any;
}

const GameScreen = () => {
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);
  const gameEngineRef = useRef<GameEngine>(null);
  const entitiesRef = useRef<GameEntities | null>(null);

  useEffect(() => {
    setupWorld();
    return () => {
      saveScore();
    };
  }, []);

  const setupWorld = () => {
    const engine = Matter.Engine.create({ enableSleeping: false });
    const world = engine.world;

    // Create cat
    const cat = Cat(world, { x: width / 4, y: height - 100 });

    // Create initial coins
    const coins = Array(5).fill(null).map((_, i) => {
      return Coin(world, { x: width + (i * 150), y: height - 200 });
    });

    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((collision) => {
        if (collision.bodyA.label === 'Cat' && collision.bodyB.label === 'Coin') {
          Matter.World.remove(world, collision.bodyB);
          setScore(prevScore => prevScore + 1);
          // Add new coin
          const lastCoin = coins[coins.length - 1];
          coins.push(Coin(world, { x: lastCoin.pos.x + 150, y: height - 200 }));
        }
      });
    });

    const entities: GameEntities = {
      physics: { engine, world },
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
    if (entitiesRef.current?.cat) {
      Matter.Body.setVelocity(entitiesRef.current.cat.body, { x: 0, y: -10 });
    }
  };

  return (
    <View style={styles.container}>
      <GameEngine
        ref={gameEngineRef}
        style={styles.gameContainer}
        systems={[Physics]}
        entities={setupWorld()}
        running={running}
      />
      <TouchableOpacity style={styles.jumpButton} onPress={onJump}>
        <View style={styles.button} />
      </TouchableOpacity>
    </View>
  );
};

const Physics = (entities: GameEntities, { time }: { time: { delta: number } }) => {
  const engine = entities.physics.engine;
  Matter.Engine.update(engine, time.delta);
  return entities;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gameContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  jumpButton: {
    position: 'absolute',
    bottom: 50,
    right: 50,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});

export default GameScreen;
