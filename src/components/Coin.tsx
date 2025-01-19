import React from 'react';
import { Image } from 'react-native';
import Matter from 'matter-js';

const Coin = (props: any) => {
  const width = 30;
  const height = 30;

  const { body } = props;

  const x = body.position.x - width / 2;
  const y = body.position.y - height / 2;

  return (
    <Image
      source={require('../assets/images/coin.png')}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: width,
        height: height,
        resizeMode: 'contain',
      }}
    />
  );
};

export default (world: Matter.World, pos: { x: number; y: number }) => {
  const initialCoin = Matter.Bodies.circle(
    pos.x,
    pos.y,
    15,
    {
      label: 'Coin',
      isSensor: true,
      isStatic: true,
    }
  );

  Matter.World.add(world, initialCoin);

  return {
    body: initialCoin,
    pos,
    renderer: <Coin />,
  };
};
