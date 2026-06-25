// mobile/src/screens/support/SupportConnectScreen.tsx
// 상시 '전문가 도움 안내' 진입점 — 위기 게이트와 무관하게 마이페이지에서 항상 접근 가능.
// 정보 제공·연결만 한다(진단·치료 아님). 위기 자산(crisis.ts)을 재사용한다.
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Phone, MapPin } from 'phosphor-react-native';
import { TopBar } from '@/components/BackHeader';
import { palette, typography } from '@/theme/tokens';
import { CRISIS_HOTLINES, HOSPITAL_MAP_QUERY } from '@/lib/crisis';

const NOTICE =
  'Bridge는 정보 제공과 습관 형성을 돕는 도구로, 상담이나 진단을 제공하지 않아요. '
  + '혼자 견디기 버겁다면 아래 전문기관에 편하게 연락해보세요.';

const CONSIDER = [
  '마음이 힘든 상태가 2주 넘게 이어질 때',
  '일상(수면·식사·일·관계)에 지장이 느껴질 때',
  '혼자서는 풀기 어렵다고 느껴질 때',
];

export default function SupportConnectScreen() {
  const navigation = useNavigation();

  const call = (number: string) => {
    Linking.openURL(`tel:${number.replace(/-/g, '')}`).catch(() => {});
  };

  return (
    <View style={s.container}>
      <TopBar title="전문가 상담·기관 안내" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.noticeCard}>
          <Text style={s.noticeText}>{NOTICE}</Text>
        </View>

        <Text style={s.sectionTitle}>이럴 때 전문가 도움을 고려해보세요</Text>
        <View style={s.considerCard}>
          {CONSIDER.map(line => (
            <View key={line} style={s.considerRow}>
              <Text style={s.dot}>·</Text>
              <Text style={s.considerText}>{line}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>전문기관 연결</Text>
        <View style={s.linkCard}>
          {CRISIS_HOTLINES.map(h => (
            <Pressable key={h.number} style={s.row} onPress={() => call(h.number)}>
              <Phone size={20} color={palette.primary} weight="duotone" />
              <Text style={s.rowLabel}>{h.label}</Text>
              <Text style={s.rowValue}>{h.number}</Text>
            </Pressable>
          ))}
          <Pressable
            style={s.row}
            onPress={() => { Linking.openURL(HOSPITAL_MAP_QUERY).catch(() => {}); }}
          >
            <MapPin size={20} color={palette.primary} weight="duotone" />
            <Text style={s.rowLabel}>내 주변 기관 찾아보기</Text>
            <Text style={s.rowArrow}>→</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  scroll: { padding: 16, gap: 8 },
  noticeCard: { backgroundColor: palette.primaryBgWash, borderRadius: 12, padding: 14, marginBottom: 8 },
  noticeText: { ...typography.body, color: palette.textBody },
  sectionTitle: { ...typography.bodyBold, color: palette.textHeading, marginTop: 12, marginBottom: 8 },
  considerCard: { backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.borderSubtle, padding: 14, gap: 8 },
  considerRow: { flexDirection: 'row', gap: 8 },
  dot: { ...typography.body, color: palette.primary },
  considerText: { flex: 1, ...typography.body, color: palette.textBody },
  linkCard: { backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.borderSubtle, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: palette.borderSubtle },
  rowLabel: { flex: 1, ...typography.body, color: palette.textHeading },
  rowValue: { ...typography.bodyBold, color: palette.primary },
  rowArrow: { ...typography.bodyBold, color: palette.primary },
});
