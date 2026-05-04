import React from 'react';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { palette, fontFamily } from '@/theme/tokens';

type Props = {
  value: number;
  size?: number;
  showText?: boolean;
  strokeColor?: string;
  trackColor?: string;
  textColor?: string;
};

export default function CircleGauge({
  value,
  size = 48,
  showText = false,
  strokeColor = palette.primary,
  trackColor = palette.primaryBgSoft,
  textColor = palette.textHeading,
}: Props) {
  const stroke = 4;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={stroke}/>
      <Circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={strokeColor} strokeWidth={stroke}
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c * (1 - value / 100)}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {showText && (
        <SvgText x={cx} y={cy + 6} textAnchor="middle"
                 fill={textColor} fontSize={size < 60 ? 12 : 16} fontWeight="800"
                 fontFamily={fontFamily.enBold}>
          {Math.round(value)}%
        </SvgText>
      )}
    </Svg>
  );
}
