import React from 'react';
import {
  SmileyXEyes,
  SmileySad,
  SmileyMeh,
  Smiley,
  SmileyWink,
} from 'phosphor-react-native';
import { palette } from '@/theme/tokens';
import type { MoodId } from '@/theme/tokens';

type Props = {
  id: MoodId;
  size?: number;
  color?: string;
  weight?: 'regular' | 'bold' | 'duotone' | 'fill' | 'light' | 'thin';
};

const ICONS: Record<MoodId, React.ComponentType<any>> = {
  verybad:  SmileyXEyes,
  bad:      SmileySad,
  normal:   SmileyMeh,
  good:     Smiley,
  verygood: SmileyWink,
};

export function MoodIcon({ id, size = 24, color = palette.textBody, weight = 'duotone' }: Props) {
  const Icon = ICONS[id];
  return <Icon size={size} color={color} weight={weight} />;
}
