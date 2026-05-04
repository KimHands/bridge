import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { palette } from '@/theme/tokens';

export default function TabBarIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  const fill = focused ? palette.primaryBgSoft : 'none';
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' };

  switch (name) {
    case 'Home':
      return (
        <Svg {...p}>
          <Path d="M3 12L12 4L21 12V20a1 1 0 0 1-1 1h-5v-7h-4v7H4a1 1 0 0 1-1-1V12Z"
                fill={fill} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      );
    case 'Routine':
      return (
        <Svg {...p}>
          <Rect x={4} y={4} width={16} height={16} rx={3} fill={fill} stroke={color} strokeWidth={1.8}/>
          <Path d="M9 10h6M9 14h6M9 18h4" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
        </Svg>
      );
    case 'Diary':
      return (
        <Svg {...p}>
          <Path d="M6 4h10a2 2 0 0 1 2 2v14l-4-2-4 2-4-2V6a2 2 0 0 1 2-2Z"
                fill={fill} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      );
    case 'Report':
      return (
        <Svg {...p}>
          <Path d="M5 19V10M10 19V5M15 19V13M20 19V8"
                stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
        </Svg>
      );
    case 'My':
      return (
        <Svg {...p}>
          <Circle cx={12} cy={8} r={4} fill={fill} stroke={color} strokeWidth={1.8}/>
          <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
        </Svg>
      );
    default:
      return null;
  }
}
