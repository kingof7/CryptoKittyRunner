import Matter from 'matter-js';
import { Image } from 'react-native';
import React from 'react';

interface CatProps {
  body: Matter.Body;
}

const Cat: React.FC<CatProps> = ({ body }) => {
  const width = 72;  // 추가 20% 증가 (60 * 1.2)
  const height = 72; // 추가 20% 증가 (60 * 1.2)

  return (
    <Image
      source={require('../assets/images/cat.jpg')}
      style={{
        position: 'absolute',
        left: body.position.x - width / 2,
        top: body.position.y - height / 2,
        width: width,
        height: height,
        resizeMode: 'contain',
        backgroundColor: 'transparent'
      }}
    />
  );
};

export default Cat;
