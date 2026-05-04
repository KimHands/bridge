import React, { useRef, useState } from 'react';
import {
  View, Text, FlatList, Pressable, Dimensions, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily } from '@/theme/tokens';
import { PrimaryButton, Card } from '@/components/atoms';
import { DecorativeBlobs } from '@/components/BackHeader';
import CircleGauge from '@/components/CircleGauge';

const { width: SW } = Dimensions.get('window');
type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

// ── Page 1: Mood preview ──────────────────────────────────────────
// 도메인 정의(CLAUDE.md): mood_score는 5단계 척도. Onboarding 미리보기도 동일 라벨 사용.
function Page1() {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 28, paddingTop: 0 }}>
        <Card style={{ borderRadius: 24 }}>
          <Text style={s.label}>SELECT MOOD</Text>
          <Text style={s.cardTitle}>오늘 기분이 어떠신가요?</Text>
          <View style={s.moodGrid}>
            {[
              { icon: '😭', label: '매우 나쁨', tone: 'ghost' },
              { icon: '😢', label: '나쁨',     tone: 'ghost' },
              { icon: '😐', label: '보통',     tone: 'ghost' },
              { icon: '🙂', label: '좋음',     tone: 'mint' },
              { icon: '😊', label: '매우 좋음', tone: 'purple', selected: true },
            ].map((m, i) => {
              const tones: Record<string, { bg: string; fg: string; border: string }> = {
                mint:   { bg: palette.mintBgSoft, fg: palette.mintDeep, border: 'transparent' },
                purple: { bg: palette.primaryBgSoft, fg: palette.primary, border: palette.primary },
                ghost:  { bg: palette.bgAlt, fg: palette.textBody, border: 'transparent' },
              };
              const t = tones[m.tone];
              return (
                <View key={i} style={[s.moodCard, { backgroundColor: t.bg, borderColor: m.selected ? t.border : 'transparent' }]}>
                  <Text style={{ fontSize: 22 }}>{m.icon}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: t.fg }}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        </Card>
      </View>
      <View style={{ paddingHorizontal: 28, marginTop: 32, alignItems: 'center' }}>
        <Text style={s.headline}>내 감정을 매일{'\n'}기록해요</Text>
        <Text style={s.sub}>매일의 감정을 기록하고 분석하여{'\n'}당신의 마음 건강을 돌봐드려요.</Text>
      </View>
    </View>
  );
}

// ── Page 2: Routine preview ──────────────────────────────────────
function Page2() {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 28 }}>
        <Card style={{ borderRadius: 24 }}>
          <Text style={{ fontFamily: fontFamily.enBold, fontSize: 12, color: palette.primary, fontWeight: '700' }}>07:30 AM</Text>
          <Text style={[s.cardTitle, { marginTop: 4 }]}>오늘의 루틴</Text>
          <View style={{ marginTop: 16, gap: 10 }}>
            {[
              { icon: '🧘', title: '아침 명상', sub: '5분 · 마음 챙김', done: true },
              { icon: '💧', title: '미지근한 물 한 잔', sub: '매일 아침 · 수분 공급', highlight: true },
              { icon: '🚶', title: '가벼운 스트레칭', sub: '10분 · 몸 풀기' },
            ].map((r, i) => (
              <View key={i} style={[s.routineRow, r.highlight && { backgroundColor: palette.primary }]}>
                <View style={[s.routineIcon, { backgroundColor: r.highlight ? 'rgba(255,255,255,0.18)' : palette.bgAlt }]}>
                  <Text style={{ fontSize: 18 }}>{r.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: r.highlight ? '#fff' : palette.textHeading }}>{r.title}</Text>
                  <Text style={{ fontSize: 12, color: r.highlight ? 'rgba(255,255,255,0.75)' : palette.textCaption, marginTop: 2 }}>{r.sub}</Text>
                </View>
                <View style={[s.check, {
                  backgroundColor: r.done ? palette.primary : 'transparent',
                  borderColor: r.done ? palette.primary : r.highlight ? 'rgba(255,255,255,0.5)' : palette.borderStrong,
                  borderWidth: r.done ? 0 : 1.5,
                }]}>
                  {r.done && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                </View>
              </View>
            ))}
          </View>
        </Card>
      </View>
      <View style={{ paddingHorizontal: 28, marginTop: 32, alignItems: 'center' }}>
        <Text style={s.headline}>나만의 루틴으로{'\n'}일상을 회복해요</Text>
        <Text style={s.sub}>가벼운 명상부터 작은 운동까지,{'\n'}당신만의 페이스로 활력을 찾으세요.</Text>
      </View>
    </View>
  );
}

// ── Page 3: Insights preview ─────────────────────────────────────
function Page3() {
  const bars = [3.4, 3.0, 4.1, 4.5, 3.8, 3.2, 4.0];
  const days = ['월','화','수','목','금','토','일'];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 28 }}>
        <Card style={{ borderRadius: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={s.label}>WEEKLY INSIGHTS</Text>
              <Text style={[s.cardTitle, { marginTop: 4 }]}>주간 리포트</Text>
            </View>
            <View style={s.iconBox}><Text style={{ fontSize: 18 }}>📈</Text></View>
          </View>
          <View style={{ marginTop: 24, height: 90, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 4 }}>
            {bars.map((v, i) => (
              <View key={i} style={{ width: 16, height: v * 20, backgroundColor: i === 3 ? palette.primary : palette.primaryBgSoft, borderRadius: 4 }}/>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 8 }}>
            {days.map((d, i) => (
              <Text key={i} style={{ fontSize: 11, color: i === 3 ? palette.primary : palette.textMuted, fontWeight: i === 3 ? '700' : '400', width: 16, textAlign: 'center' }}>{d}</Text>
            ))}
          </View>
          <View style={{ marginTop: 14, backgroundColor: palette.primaryBgWash, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: palette.textCaption }}>마음 챙김 달성률</Text>
              <Text style={{ marginTop: 2, fontSize: 22, fontWeight: '800', color: palette.textHeading, fontFamily: fontFamily.enBold }}>
                82%<Text style={{ fontSize: 12, color: palette.success }}> ↑12%</Text>
              </Text>
            </View>
            <CircleGauge value={82} size={48}/>
          </View>
        </Card>
      </View>
      <View style={{ paddingHorizontal: 28, marginTop: 24, alignItems: 'center' }}>
        <Text style={[s.headline, { fontSize: 22 }]}>당신의 변화를 함께 확인해요</Text>
        <Text style={s.sub}>매일 쌓이는 감정의 조각들이 모여{'\n'}더 단단해지는 당신의 내일을 보여드려요.</Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }: Props) {
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const pages = [Page1, Page2, Page3];

  const goTo = (n: number) => {
    listRef.current?.scrollToIndex({ index: n, animated: true });
    setPage(n);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <DecorativeBlobs/>
      {/* Header */}
      <View style={s.header}>
        <View style={{ width: 40 }}/>
        <Text style={s.logo}>Bridge</Text>
        <Pressable onPress={() => navigation.replace('Login')} hitSlop={8}>
          <Text style={{ fontSize: 14, color: palette.textBody, fontFamily: fontFamily.en }}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(_, i) => String(i)}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        renderItem={({ item: PageComp }) => (
          <View style={{ width: SW, paddingTop: 24 }}>
            <PageComp/>
          </View>
        )}
        style={{ flex: 1 }}
      />

      {/* Bottom controls */}
      <View style={s.controls}>
        {/* Dots */}
        <View style={s.dotsRow}>
          {pages.map((_, i) => (
            <View key={i} style={[s.dotNav, {
              width: i === page ? 24 : 6,
              backgroundColor: i === page ? palette.primary : palette.borderStrong,
            }]}/>
          ))}
        </View>

        {page === 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
            <Pressable onPress={() => goTo(1)} style={s.fab}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 12h14M13 5l7 7-7 7"/>
              </Svg>
            </Pressable>
          </View>
        )}
        {page === 1 && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <PrimaryButton variant="soft" onPress={() => goTo(0)} style={{ flex: 1 }}>이전</PrimaryButton>
            <PrimaryButton onPress={() => goTo(2)} style={{ flex: 2 }}>다음</PrimaryButton>
          </View>
        )}
        {page === 2 && (
          <View style={{ marginTop: 16, gap: 0 }}>
            <PrimaryButton onPress={() => navigation.replace('Signup')}>시작하기</PrimaryButton>
            <Pressable onPress={() => navigation.replace('Login')} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: palette.textCaption }}>기존 계정으로 로그인하기</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { height: 56, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  logo: { fontFamily: fontFamily.display, fontSize: 20, fontWeight: '700', color: palette.primary },
  moodGrid: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moodCard: { width: '47%', borderRadius: 18, paddingVertical: 16, alignItems: 'center', gap: 4, borderWidth: 2 },
  routineRow: { backgroundColor: palette.surface, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  routineIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.mintBgSoft, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, letterSpacing: 1.5, color: palette.primary, fontWeight: '700', fontFamily: fontFamily.enBold },
  cardTitle: { marginTop: 8, fontSize: 18, fontWeight: '700', color: palette.textHeading },
  headline: { fontSize: 28, fontWeight: '800', color: palette.textHeading, lineHeight: 38, textAlign: 'center' },
  sub: { marginTop: 16, fontSize: 14, color: palette.textCaption, lineHeight: 22, textAlign: 'center' },
  controls: { paddingHorizontal: 28, paddingBottom: 40, zIndex: 2 },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dotNav: { height: 4, borderRadius: 2 },
  fab: {
    width: 56, height: 56, borderRadius: 9999,
    backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: palette.primary, shadowOpacity: 0.32, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
});
