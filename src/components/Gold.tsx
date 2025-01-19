import React from 'react';
import { Image, View } from 'react-native';
import Matter from 'matter-js';

interface GoldProps {
  body: Matter.Body;
}

const Gold: React.FC<GoldProps> = ({ body }) => {
  const width = 30;
  const height = 30;

  return (
    <Image
      source={require('../assets/images/gold.jpg')}
      style={{
        position: 'absolute',
        left: body.position.x - width / 2,
        top: body.position.y - height / 2,
        width: width,
        height: height,
        resizeMode: 'contain',
      }}
    />
  );
};

export default Gold;
