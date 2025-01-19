import Matter from 'matter-js';
import { View } from 'react-native';

const Floor = (world: Matter.World, pos: { x: number; y: number }, width: number) => {
  const height = 50;

  const body = Matter.Bodies.rectangle(pos.x, pos.y, width, height, {
    label: 'Floor',
    isStatic: true,
  });

  Matter.World.add(world, body);

  return {
    body,
    pos,
    width,
    height,
    renderer: <View
      style={{
        position: 'absolute',
        left: pos.x - width / 2,
        top: pos.y - height / 2,
        width: width,
        height: height,
        backgroundColor: '#2E7D32',
      }}
    />,
  };
};

export default Floor;
