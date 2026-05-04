import React from 'react';
import {
  Bed,
  GraduationCap,
  MagicWand,
  Money,
  UsersThree,
  Barbell,
  SealQuestion,
} from 'phosphor-react-native';
import { palette } from '@/theme/tokens';
import type { CauseCode } from '@/types/assessment';

type Props = {
  code: CauseCode;
  size?: number;
  color?: string;
  weight?: 'regular' | 'bold' | 'duotone' | 'fill' | 'light' | 'thin';
};

const ICONS: Record<CauseCode, React.ComponentType<any>> = {
  sleep:        Bed,
  academic:     GraduationCap,
  future:       MagicWand,
  financial:    Money,
  relationship: UsersThree,
  physical:     Barbell,
  unknown:      SealQuestion,
};

export function CauseIcon({ code, size = 32, color = palette.primary, weight = 'duotone' }: Props) {
  const Icon = ICONS[code];
  return <Icon size={size} color={color} weight={weight} />;
}
