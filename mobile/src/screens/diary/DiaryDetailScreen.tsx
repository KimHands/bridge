import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily, moodMeta } from '@/theme/tokens';
import { Card, Pill } from '@/components/atoms';
import { TopBar } from '@/components/BackHeader';
import BottomCTA from '@/components/BottomCTA';
import { useDiaryEntry } from '@/hooks/useDiaryQueries';
import type { DiaryDetailResponse } from '@/types/diary';
import type { MoodScore } from '@/types/diary';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// mood_score(1~5) → moodMeta key 1:1 매핑
const SCORE_TO_MOOD_KEY: Record<MoodScore, keyof typeof moodMeta> = {
  5: 'verygood',
  4: 'good',
  3: 'normal',
  2: 'bad',
  1: 'verybad',
};

export default function DiaryDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'DiaryDetail'>>();
  const { entryId } = route.params;
  const { data, isLoading, isError } = useDiaryEntry(entryId);
  const entry: DiaryDetailResponse | null = data ?? null;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  if (isError || !entry) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <TopBar onBack={() => navigation.goBack()} title="일기" />
        <View style={s.empty}>
          <Text style={s.emptyTitle}>일기를 불러올 수 없어요</Text>
          <Text style={s.emptySub}>잠시 후 다시 시도해 주세요.</Text>
        </View>
        <BottomCTA>
          <Pressable onPress={() => navigation.popToTop()} style={s.homeBtn}>
            <Text style={s.homeBtnText}>홈으로 돌아가기</Text>
          </Pressable>
        </BottomCTA>
      </View>
    );
  }

  const moodKey = SCORE_TO_MOOD_KEY[entry.mood_score as MoodScore] ?? 'normal';
  const moodInfo = moodMeta[moodKey];

  // 백엔드 created_at은 ISO timestamp. 한국어 친화 포맷으로 변환.
  const date = new Date(entry.created_at);
  const validDate = !isNaN(date.getTime());
  const dayLabel = ['일', '월', '화', '수', '목', '금', '토'];
  const dateStr = validDate
    ? `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${dayLabel[date.getDay()]}요일`
    : '';
  const titleStr = validDate
    ? `${date.getMonth() + 1}월 ${date.getDate()}일 일기`
    : '일기';

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar
        onBack={() => navigation.goBack()}
        title="일기"
      />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.date}>{dateStr}</Text>

        <Text style={s.title}>{titleStr}</Text>

        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {moodInfo && (
            <Pill color={moodInfo.color} bg={moodInfo.color + '1A'}>
              오늘의 기분 · {moodInfo.label}
            </Pill>
          )}
        </View>

        {entry.emotion_keywords.length > 0 && (
          <Card style={{ marginTop: 20 }}>
            <Text style={s.cardLabel}>KEYWORDS</Text>
            <View style={s.kwRow}>
              {entry.emotion_keywords.map((k, i) => (
                <View key={i} style={s.kwTag}>
                  <Text style={s.kwText}>#{k}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {entry.situation_keywords.length > 0 && (
          <Card style={{ marginTop: 14 }}>
            <Text style={s.cardLabel}>BRIDGE'S QUESTION</Text>
            {entry.situation_keywords.map((sk, i) => (
              <Text key={i} style={s.answer}>{sk.answer}</Text>
            ))}
          </Card>
        )}

        {entry.memo && (
          <Card style={{ marginTop: 14 }}>
            <Text style={s.cardLabel}>MEMO</Text>
            <Text style={s.body}>{entry.memo}</Text>
          </Card>
        )}

        {/* ai_insight 섹션 제거 — 도메인 원칙(LLM 기반 기능 금지) */}
      </ScrollView>

      <BottomCTA>
        <Pressable
          onPress={() => navigation.popToTop()}
          style={s.homeBtn}
        >
          <Text style={s.homeBtnText}>홈으로 돌아가기</Text>
        </Pressable>
      </BottomCTA>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 40 },
  date: { fontSize: 12, color: palette.textCaption, fontFamily: fontFamily.enBold, fontWeight: '600' },
  title: { marginTop: 6, fontSize: 24, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5 },
  cardLabel: { fontSize: 11, color: palette.primary, fontWeight: '700', fontFamily: fontFamily.enBold, letterSpacing: 1.2 },
  kwRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kwTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, backgroundColor: palette.primaryBgWash },
  kwText: { fontSize: 12, color: palette.primary, fontWeight: '600' },
  answer: { marginTop: 14, fontSize: 14, color: palette.textBody, lineHeight: 24 },
  body: { marginTop: 10, fontSize: 14, color: palette.textBody, lineHeight: 24 },
  homeBtn: { height: 56, borderRadius: 24, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  homeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: palette.textHeading, letterSpacing: -0.4 },
  emptySub: { marginTop: 8, fontSize: 13, color: palette.textCaption },
});
