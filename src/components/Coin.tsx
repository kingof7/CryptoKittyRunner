import Matter from 'matter-js';
import { Image, View, Text } from 'react-native';
import React from 'react';

interface CoinProps {
  body: Matter.Body;
}

const Coin: React.FC<CoinProps> = ({ body }) => {
  const width = 30;
  const height = 30;

  return (
    <View
      style={{
        position: 'absolute',
        left: body.position.x - width / 2,
        top: body.position.y - height / 2,
        width: width,
        height: height,
      }}
    >
      {/* 코인 본체 */}
      <View style={{
        width: '100%',
        height: '100%',
        borderRadius: width / 2,
        backgroundColor: body.label === 'gold' ? '#FFD700' : '#FFA500',
        borderWidth: 3,
        borderColor: body.label === 'gold' ? '#DAA520' : '#FF8C00',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      }}>
        {/* 코인 심볼 */}
        <Text style={{
          fontSize: 16,
          fontWeight: 'bold',
          color: body.label === 'gold' ? '#B8860B' : '#CD853F'
        }}>
          ₿
        </Text>
      </View>
    </View>
  );
};

export default Coin;
