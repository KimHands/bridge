import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { palette, fontFamily } from '@/theme/tokens';

export default function MoodLineChart({ values, labels }: { values: (number | null)[]; labels: string[] }) {
  const W = 320, H = 120, pad = 16;
  const max = 5, min = 1;
  const stepX = (W - pad * 2) / Math.max(values.length - 1, 1);
  // 결측일(null)은 좌표에서 제외하고 유효 포인트만 이어 그린다.
  // (빈 날을 0으로 채우면 도메인(1~5) 밖이라 점이 바닥 아래로 찍히는 문제 방지 — M8)
  const pts = values
    .map((v, i) =>
      v == null ? null : {
        x: pad + stepX * i,
        y: H - pad - ((v - min) / (max - min)) * (H - pad * 2),
      },
    )
    .filter((p): p is { x: number; y: number } => p !== null);

  if (pts.length === 0) return null; // 빈 상태는 부모(ReportScreen)가 렌더

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;

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
