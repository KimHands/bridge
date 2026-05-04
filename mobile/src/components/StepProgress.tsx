import React from 'react';
import { View, StyleSheet } from 'react-native';
import { palette } from '@/theme/tokens';

export default function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${(step / total) * 100}%` as any }]}/>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4, marginHorizontal: 24,
    backgroundColor: palette.borderSubtle, borderRadius: 2,
  },
  fill: { height: 4, backgroundColor: palette.primary, borderRadius: 2 },
});
