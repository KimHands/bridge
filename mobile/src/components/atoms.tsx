// Reusable atomic components (RN). Mirrors the prototype's atoms (theme.jsx).
import React, { ReactNode } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { palette, radius, shadow, typography } from '@/theme/tokens';

// ── PrimaryButton ─────────────────────────────────────────────
type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'mint' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';
export function PrimaryButton({
  children, onPress, disabled, variant = 'primary', size = 'lg', style,
}: { children: ReactNode; onPress?: () => void; disabled?: boolean; variant?: ButtonVariant; size?: ButtonSize; style?: StyleProp<ViewStyle> }) {
  const v = {
    primary: { bg: palette.primary, color: '#fff', border: 'transparent' },
    soft:    { bg: palette.primaryBgSoft, color: palette.primary, border: 'transparent' },
    ghost:   { bg: 'transparent', color: palette.primary, border: 'transparent' },
    mint:    { bg: palette.mintDeep, color: '#fff', border: 'transparent' },
    outline: { bg: 'transparent', color: palette.primary, border: palette.primary },
  }[variant];
  const s = { sm: { h: 36, fs: 13 }, md: { h: 44, fs: 14 }, lg: { h: 56, fs: 16 } }[size];
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [
      {
        height: s.h, borderRadius: radius.xl,
        backgroundColor: disabled ? palette.borderStrong : v.bg,
        borderWidth: v.border === 'transparent' ? 0 : 1,
        borderColor: v.border,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 24,
        opacity: pressed ? 0.85 : 1,
      }, style]}>
      <Text style={{ color: v.color, fontSize: s.fs, fontWeight: '600' as const }}>{children}</Text>
    </Pressable>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, style, padding = 20, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; padding?: number; onPress?: () => void }) {
  const inner = <View style={[{ backgroundColor: palette.surface, borderRadius: radius.lg, padding }, shadow.card, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

// ── TextField ─────────────────────────────────────────────────
export function TextField({ label, placeholder, value, onChangeText, secureTextEntry, autoCapitalize = 'none' }: {
  label?: string; placeholder?: string; value: string; onChangeText: (v: string) => void; secureTextEntry?: boolean; autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={{ ...typography.bodyBold, color: palette.textBody }}>{label}</Text>}
      <View style={{ height: 48, borderRadius: radius.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 16, justifyContent: 'center' }}>
        <TextInput
          placeholder={placeholder} placeholderTextColor={palette.textMuted}
          value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} autoCapitalize={autoCapitalize}
          style={{ fontSize: 14, color: palette.textHeading }}
        />
      </View>
    </View>
  );
}

// ── Pill ──────────────────────────────────────────────────────
export function Pill({ children, color = palette.primary, bg = palette.primaryBgSoft }: { children: ReactNode; color?: string; bg?: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, height: 22, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

// ── Screen — safe-area + bg wrapper ───────────────────────────
import { SafeAreaView } from 'react-native-safe-area-context';
export function Screen({ children, bg = palette.bg, edges, style }: { children: ReactNode; bg?: string; edges?: any; style?: StyleProp<ViewStyle> }) {
  return <SafeAreaView edges={edges ?? ['top']} style={[{ flex: 1, backgroundColor: bg }, style]}>{children}</SafeAreaView>;
}

// ── Divider ───────────────────────────────────────────────────
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: palette.divider }, style]}/>;
}
