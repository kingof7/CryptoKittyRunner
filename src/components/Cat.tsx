import React from 'react';
import { Image } from 'react-native';
import Matter from 'matter-js';

const Cat = (props: any) => {
  const width = 50;
  const height = 50;

  const { body, color } = props;

  const x = body.position.x - width / 2;
  const y = body.position.y - height / 2;

  return (
    <Image
      source={require('../assets/images/cat.png')}
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
  const initialCat = Matter.Bodies.rectangle(
    pos.x,
    pos.y,
    50,
    50,
    {
      label: 'Cat',
      friction: 0,
      restitution: 0.5,
    }
  );

  Matter.World.add(world, initialCat);

  return {
    body: initialCat,
    pos,
    renderer: <Cat />,
  };
};
