import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@/theme/tokens';

export default function BottomCTA({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={['rgba(250,248,255,0)', 'rgba(250,248,255,1)']}
      locations={[0, 0.5]}
      style={[styles.container, { paddingBottom: Math.max(insets.bottom + 8, 24) }]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 24, paddingTop: 24,
  },
});
