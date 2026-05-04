import React from 'react';
import {
  PersonArmsSpread,
  PersonSimpleWalk,
  Notebook,
  BookOpen,
  FlowerLotus,
  Drop,
  MoonStars,
  Sparkle,
} from 'phosphor-react-native';
import { palette } from '@/theme/tokens';

type Props = {
  title: string;
  size?: number;
  color?: string;
  weight?: 'regular' | 'bold' | 'duotone' | 'fill' | 'light' | 'thin';
};

export function RoutineIcon({ title, size = 24, color = palette.primary, weight = 'duotone' }: Props) {
  const props = { size, color, weight };

  if (title.includes('스트레칭')) return <PersonArmsSpread {...props} />;
  if (title.includes('산책') || title.includes('걷')) return <PersonSimpleWalk {...props} />;
  if (title.includes('일기') || title.includes('적기') || title.includes('적어')) return <Notebook {...props} />;
  if (title.includes('독서') || title.includes('책')) return <BookOpen {...props} />;
  if (title.includes('명상') || title.includes('호흡') || title.includes('마음')) return <FlowerLotus {...props} />;
  if (title.includes('물') || title.includes('수분')) return <Drop {...props} />;
  if (title.includes('수면') || title.includes('취침') || title.includes('잠')) return <MoonStars {...props} />;
  return <Sparkle {...props} />;
}
