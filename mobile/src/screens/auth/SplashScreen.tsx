import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily } from '@/theme/tokens';
import { DecorativeBlobs } from '@/components/BackHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const id = setTimeout(() => navigation.replace('Onboarding'), 1600);
    return () => clearTimeout(id);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DecorativeBlobs/>
      <View style={styles.center}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>bridge</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.brandName}>Bridge</Text>
          <Text style={styles.tagline}>방치된 당신과 병원 사이의 다리, Bridge</Text>
        </View>
      </View>
      <View style={styles.bottom}>
        <View style={styles.dots}>
          <View style={[styles.dot, { width: 24, backgroundColor: palette.primary }]}/>
          <View style={[styles.dot, { width: 8, backgroundColor: palette.borderStrong }]}/>
        </View>
        <Text style={styles.wellness}>YOUR PATH TO WELLNESS</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, zIndex: 2 },
  logoBox: {
    width: 124, height: 124, borderRadius: 32,
    backgroundColor: '#1A1B21', alignItems: 'center', justifyContent: 'center',
    shadowColor: palette.primary, shadowOpacity: 0.12, shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  logoText: {
    fontFamily: fontFamily.display, fontSize: 28, color: '#3FA9F5',
    fontWeight: '800', letterSpacing: -1,
  },
  brandName: {
    fontFamily: fontFamily.display, fontSize: 56, fontWeight: '800',
    color: palette.primary, letterSpacing: -1.5,
  },
  tagline: { marginTop: 14, fontSize: 14, color: palette.textMuted },
  bottom: { paddingBottom: 80, alignItems: 'center', zIndex: 2 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dot: { height: 3, borderRadius: 2 },
  wellness: {
    fontSize: 11, letterSpacing: 2, color: palette.textMuted,
    fontWeight: '600', fontFamily: fontFamily.enBold,
  },
});
