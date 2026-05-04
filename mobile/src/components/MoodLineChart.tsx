import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { palette, fontFamily } from '@/theme/tokens';

export default function MoodLineChart({ values, labels }: { values: number[]; labels: string[] }) {
  const W = 320, H = 120, pad = 16;
  const max = 5, min = 1;
  const stepX = (W - pad * 2) / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => ({
    x: pad + stepX * i,
    y: H - pad - ((v - min) / (max - min)) * (H - pad * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pad},${H} Z`;

  return (
    <Svg width="100%" height={H + 24} viewBox={`0 0 ${W} ${H + 24}`}>
      <Defs>
        <LinearGradient id="mg" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0%" stopColor={palette.primary} stopOpacity={0.3}/>
          <Stop offset="100%" stopColor={palette.primary} stopOpacity={0}/>
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#mg)"/>
      <Path d={line} stroke={palette.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={4} fill="white" stroke={palette.primary} strokeWidth={2}/>
      ))}
      {labels.map((l, i) => (
        <SvgText key={i} x={pad + stepX * i} y={H + 16} fontSize={11}
                 fill={palette.textCaption} textAnchor="middle" fontFamily={fontFamily.kr}>
          {l}
        </SvgText>
      ))}
    </Svg>
  );
}
