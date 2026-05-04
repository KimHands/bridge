import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily, moodMeta } from '@/theme/tokens';
import { Card, Pill } from '@/components/atoms';
import { useDiaryList } from '@/hooks/useDiaryQueries';
import { useStartDiary } from '@/hooks/useStartDiary';
import type { DiaryListItem, MoodScore } from '@/types/diary';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterKey = 'all' | MoodScore;

const FILTERS: { k: FilterKey; l: string }[] = [
  { k: 'all', l: '전체' },
  { k: 1,     l: '😭 매우 나쁨' },
  { k: 2,     l: '😢 나쁨' },
  { k: 3,     l: '😐 보통' },
  { k: 4,     l: '🙂 좋음' },
  { k: 5,     l: '😊 매우 좋음' },
];

const SCORE_TO_MOOD_KEY: Record<MoodScore, keyof typeof moodMeta> = {
  1: 'verybad',
  2: 'bad',
  3: 'normal',
  4: 'good',
  5: 'verygood',
};

const DAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

export default function DiaryListScreen() {
  const navigation = useNavigation<Nav>();
  const startDiary = useStartDiary();
  const [filter, setFilter] = useState<FilterKey>('all');
  const { data, isLoading } = useDiaryList();

  const entries: DiaryListItem[] = data?.items ?? [];
  const filtered = filter === 'all' ? entries : entries.filter(e => e.mood_score === filter);

  const grouped = filtered.reduce<Record<string, DiaryListItem[]>>((acc, e) => {
    const m = e.created_at.slice(0, 7);
    (acc[m] = acc[m] || []).push(e);
    return acc;
  }, {});

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={s.label}>MY JOURNAL</Text>
          <Text style={s.title}>감정 일기</Text>
        </View>
        <Pressable onPress={startDiary} style={s.fab}>
          <Svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
            <Path d="M11 4v14M4 11h14"/>
          </Svg>
        </Pressable>
      </View>

      {/* Filter chips */}
      <View style={{ height: 56 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => (
            <Pressable key={String(f.k)} onPress={() => setFilter(f.k)} style={[s.chip, filter === f.k && s.chipActive]}>
              <Text style={[s.chipText, filter === f.k && s.chipActiveText]}>{f.l}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {/* 가로 스크롤 우측 페이드: 추가 chip 존재 시각 hint */}
        <LinearGradient
          pointerEvents="none"
          colors={[palette.bg + '00', palette.bg]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={s.fadeRight}
        />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}>
        {filtered.length === 0 ? (
          <Card style={s.emptyCard}>
            <Text style={s.emptyTitle}>
              {isLoading ? '일기를 불러오는 중이에요' :
                filter === 'all' ? '아직 작성한 일기가 없어요' : '해당 기분의 일기가 없어요'}
            </Text>
            {!isLoading && filter === 'all' && (
              <Text style={s.emptySub}>오른쪽 위 + 버튼으로 첫 일기를 작성해보세요.</Text>
            )}
          </Card>
        ) : (
          Object.entries(grouped).map(([month, items]) => (
            <View key={month} style={{ marginBottom: 24 }}>
              <Text style={s.monthLabel}>{month.replace('-', '. ')}</Text>
              {items.map(e => {
                const date = new Date(e.created_at);
                const moodKey = SCORE_TO_MOOD_KEY[e.mood_score] ?? 'normal';
                const moodInfo = moodMeta[moodKey];
                return (
                  <Card
                    key={e.diary_id}
                    onPress={() => navigation.navigate('DiaryDetail', { entryId: e.diary_id })}
                    style={{ marginBottom: 10, flexDirection: 'row', gap: 14 }}
                  >
                    <View style={{ alignItems: 'center', paddingTop: 2 }}>
                      <Text style={s.dayNum}>{String(date.getDate()).padStart(2, '0')}</Text>
                      <Text style={s.dayName}>{DAY_KR[date.getDay()]}요일</Text>
                    </View>
                    <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: palette.borderSubtle }}/>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Pill color={moodInfo.color} bg={moodInfo.color + '1A'}>{moodInfo.label}</Pill>
                      {e.emotion_keywords.length > 0 && (
                        <Text style={s.entryKeywords}>
                          {e.emotion_keywords.map(k => `#${k}`).join(' ')}
                        </Text>
                      )}
                      {e.memo_preview && (
                        <Text style={s.entryPreview} numberOfLines={2}>{e.memo_preview}</Text>
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { padding: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, color: palette.primary, fontWeight: '700', letterSpacing: 1.5, fontFamily: fontFamily.enBold },
  title: { marginTop: 4, fontSize: 24, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5 },
  fab: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: palette.primary, shadowOpacity: 0.32, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  filterRow: { paddingHorizontal: 24, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border },
  chipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: palette.textBody },
  chipActiveText: { color: '#fff' },
  monthLabel: { fontSize: 12, fontWeight: '700', color: palette.textCaption, marginBottom: 10, fontFamily: fontFamily.enBold, letterSpacing: 1 },
  dayNum: { fontSize: 20, fontWeight: '800', color: palette.textHeading, fontFamily: fontFamily.enBold, lineHeight: 22 },
  dayName: { fontSize: 9, color: palette.textMuted, fontWeight: '600', marginTop: 2, fontFamily: fontFamily.enBold },
  entryKeywords: { marginTop: 6, fontSize: 12, color: palette.primary, fontWeight: '600' },
  entryPreview: { marginTop: 4, fontSize: 12, color: palette.textCaption, lineHeight: 18 },
  emptyCard: { marginTop: 8, alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: palette.textHeading, letterSpacing: -0.3 },
  emptySub: { marginTop: 8, fontSize: 12, color: palette.textCaption, textAlign: 'center' },
  fadeRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 28 },
});
