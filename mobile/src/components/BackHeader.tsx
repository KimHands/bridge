import React, { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, fontFamily } from '@/theme/tokens';

export function TopBar({
  title,
  onBack,
  trailing,
  transparent = false,
}: {
  title?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  transparent?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: 56 + insets.top }, transparent && styles.transparent]}>
      <View style={styles.side}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
            <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
              <Path d="M14 5L8 11L14 17" stroke={palette.primary} strokeWidth={2}
                    strokeLinecap="round" strokeLinejoin="round"/>
            </Svg>
          </Pressable>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={[styles.side, styles.trailingSide]}>{trailing}</View>
    </View>
  );
}

export function DecorativeBlobs() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.blob, { left: -60, top: -120, width: 240, height: 320, backgroundColor: 'rgba(228,223,255,0.55)' }]}/>
      <View style={[styles.blob, { right: -80, top: 60, width: 280, height: 280, backgroundColor: 'rgba(228,223,255,0.45)' }]}/>
      <View style={[styles.blob, { left: -40, bottom: 80, width: 220, height: 280, backgroundColor: 'rgba(168,216,208,0.30)' }]}/>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: palette.bg,
  },
  transparent: { backgroundColor: 'transparent' },
  side: { minWidth: 40, alignItems: 'flex-start', justifyContent: 'center' },
  trailingSide: { alignItems: 'flex-end', paddingLeft: 8 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1, textAlign: 'center',
    fontFamily: fontFamily.display, fontSize: 18, fontWeight: '700',
    color: palette.primary, letterSpacing: -0.2,
  },
  blob: { position: 'absolute', borderRadius: 9999 },
});

export default TopBar;
