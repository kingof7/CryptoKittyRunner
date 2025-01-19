import Matter from 'matter-js';
import { Image } from 'react-native';

const Cat = (world: Matter.World, pos: { x: number; y: number }) => {
  const width = 50;
  const height = 50;

  const body = Matter.Bodies.rectangle(pos.x, pos.y, width, height, {
    label: 'Cat',
    friction: 1,
    restitution: 0.2,
  });

  Matter.World.add(world, body);

  return {
    body,
    pos,
    width,
    height,
    renderer: <Image
      source={require('../assets/images/cat.png')}
      style={{
        position: 'absolute',
        left: body.position.x,
        top: body.position.y,
        width: width,
        height: height,
        resizeMode: 'contain',
      }}
    />,
  };
};

export default Cat;
