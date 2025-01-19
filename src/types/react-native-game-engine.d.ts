declare module 'react-native-game-engine' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  export interface GameEngineProps extends ViewProps {
    systems?: ((entities: any, time: { time: { delta: number } }) => any)[];
    entities?: { [key: string]: any };
    running?: boolean;
    onEvent?: (event: any) => void;
  }

  export class GameEngine extends Component<GameEngineProps> {
    dispatch: (event: any) => void;
    swap: (entities: { [key: string]: any }) => void;
    start: () => void;
    stop: () => void;
  }
}
