import Matter from 'matter-js';
import { Image } from 'react-native';

const GoldenCoin = (world: Matter.World, pos: { x: number; y: number }) => {
  const width = 40;
  const height = 40;

  const body = Matter.Bodies.circle(pos.x, pos.y, width / 2, {
    label: 'GoldenCoin',
    isSensor: true,
    isStatic: true,
  });

  Matter.World.add(world, body);

  return {
    body,
    pos,
    width,
    height,
    renderer: <Image
      source={require('../assets/images/coin.png')}
      style={{
        position: 'absolute',
        left: body.position.x - width / 2,
        top: body.position.y - height / 2,
        width: width,
        height: height,
        resizeMode: 'contain',
        tintColor: '#FFD700', // 황금색으로 변경
      }}
    />,
  };
};

export default GoldenCoin;
