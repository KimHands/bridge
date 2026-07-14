import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, fontFamily } from '@/theme/tokens';
import { Card } from '@/components/atoms';
import MoodLineChart from '@/components/MoodLineChart';
import { useWeeklyReport, useMonthlyReport } from '@/hooks/useReportQueries';
import { Calendar, ChartLineUp, Notebook } from 'phosphor-react-native';

const PERIODS = [{ k: 'week', l: '주간' }, { k: 'month', l: '월간' }, { k: 'year', l: '연간' }] as const;
type Period = 'week' | 'month' | 'year';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export default function ReportScreen() {
  const [period, setPeriod] = useState<Period>('week');
  const weekQ = useWeeklyReport();
  const monthQ = useMonthlyReport({ enabled: period === 'month' });

  if (period === 'year') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
        <View style={s.header}>
          <Text style={s.label}>INSIGHTS</Text>
          <Text style={s.title}>나의 리포트</Text>
        </View>
        <View style={s.toggleRow}>
          {PERIODS.map(p => (
            <Pressable key={p.k} onPress={() => setPeriod(p.k)} style={[s.toggleBtn, period === p.k && s.toggleActive]}>
              <Text style={[s.toggleText, period === p.k && s.toggleActiveText]}>{p.l}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Calendar size={48} color={palette.primary} weight="duotone" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.textHeading }}>연간 리포트 준비 중</Text>
          <Text style={{ fontSize: 13, color: palette.textCaption, textAlign: 'center', paddingHorizontal: 40 }}>
            더 많은 기록이 쌓이면{'\n'}연간 변화를 확인할 수 있어요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const weekData = weekQ.data;
  const monthData = monthQ.data;

  // 주간: mood_scores(7개, 결측일은 null) → null 유지(0으로 뭉개면 차트 밖으로 찍힘 — M8)
  const weekChartValues: (number | null)[] = weekData ? weekData.mood_scores : [];
  const weekLabels = DAY_LABELS;

  // 월간: mood_trend MoodPoint[] → 날짜 라벨 + 점수
  const monthChartValues: number[] = monthData
    ? monthData.mood_trend.map(p => p.mood_score)
    : [];
  const monthLabels: string[] = monthData
    ? monthData.mood_trend.map(p => p.date.slice(8)) // "DD" 부분만
    : [];

  const chartValues: (number | null)[] = period === 'week' ? weekChartValues : monthChartValues;
  const chartLabels = period === 'week' ? weekLabels : monthLabels;
  // 유효 데이터(비결측)가 하나라도 있어야 차트를 그린다. 주간은 항상 length 7이라
  // length 기반 빈상태 판정이 안 되므로 값 존재 여부로 판정한다(M8).
  const hasChartData = chartValues.some(v => v != null);

  const moodAverage = period === 'week'
    ? (weekData?.mood_average ?? null)
    : (monthData?.mood_average ?? null);

  // 감정 키워드
  const weekKeywords = weekData?.top_emotion_keywords ?? [];
  const monthKeywords = monthData
    ? Object.keys(monthData.emotion_keyword_distribution).sort(
        (a, b) => monthData.emotion_keyword_distribution[b] - monthData.emotion_keyword_distribution[a]
      ).slice(0, 6)
    : [];
  const keywords = period === 'week' ? weekKeywords : monthKeywords;

  // 루틴 달성률
  const routineRate = period === 'week'
    ? (weekData?.routine_completion_rate ?? null)
    : (monthData?.routine_completion_rate ?? null);

  // 일기 수
  const diaryCount = period === 'week'
    ? (weekData?.diary_count ?? null)
    : (monthData?.diary_count ?? null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={s.header}>
        <Text style={s.label}>INSIGHTS</Text>
        <Text style={s.title}>나의 리포트</Text>
      </View>

      {/* Period toggle */}
      <View style={s.toggleRow}>
        {PERIODS.map(p => (
          <Pressable key={p.k} onPress={() => setPeriod(p.k)} style={[s.toggleBtn, period === p.k && s.toggleActive]}>
            <Text style={[s.toggleText, period === p.k && s.toggleActiveText]}>{p.l}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ paddingHorizontal: 24, gap: 14, marginTop: 16 }}>
        {/* Mood trend */}
        <Card>
          <View style={s.trendHeader}>
            <View>
              <Text style={s.cardSub}>{period === 'week' ? '이번 주' : '이번 달'} 평균 기분</Text>
              <Text style={s.avgNum}>
                {moodAverage !== null ? moodAverage.toFixed(1) : '--'}
                <Text style={s.avgDenom}> / 5.0</Text>
              </Text>
            </View>
            <View style={s.emojiBox}><ChartLineUp size={20} color={palette.mintDeep} weight="duotone" /></View>
          </View>
          {hasChartData && (
            <View style={{ marginTop: 24 }}>
              <MoodLineChart values={chartValues} labels={chartLabels}/>
            </View>
          )}
          {!hasChartData && (
            <Text style={{ marginTop: 16, fontSize: 13, color: palette.textCaption, textAlign: 'center' }}>
              아직 기록된 일기가 없어요.
            </Text>
          )}
        </Card>

        {/* Keyword cloud */}
        {keywords.length > 0 && (
          <Card>
            <Text style={s.sectionTitle}>{period === 'week' ? '이번 주' : '이번 달'} 자주 느낀 감정</Text>
            <View style={s.tagRow}>
              {keywords.map((word, i) => (
                <View key={i} style={[s.tag, { backgroundColor: i < 2 ? palette.primary : palette.primaryBgWash }]}>
                  <Text style={[s.tagText, { color: i < 2 ? '#fff' : palette.primary, fontSize: i < 2 ? 14 : 12 }]}>
                    #{word}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Routine completion rate */}
        <Card>
          <Text style={s.sectionTitle}>루틴 달성률</Text>
          {routineRate !== null ? (
            <View style={{ marginTop: 14 }}>
              <View style={s.barHeader}>
                <Text style={{ fontSize: 13, color: palette.textHeading }}>전체 루틴</Text>
                <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '700', fontFamily: fontFamily.enBold }}>
                  {routineRate}%
                </Text>
              </View>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${Math.min(routineRate, 100)}%` as any }]}/>
              </View>
            </View>
          ) : (
            <Text style={{ marginTop: 12, fontSize: 13, color: palette.textCaption }}>
              아직 루틴 기록이 없어요.
            </Text>
          )}
        </Card>

        {/* Diary count summary */}
        {diaryCount !== null && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={s.emojiBox}><Notebook size={20} color={palette.mintDeep} weight="duotone" /></View>
            <View>
              <Text style={s.cardSub}>{period === 'week' ? '이번 주' : '이번 달'} 일기</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: palette.textHeading, fontFamily: fontFamily.enBold }}>
                {diaryCount}<Text style={{ fontSize: 13, color: palette.textMuted, fontWeight: '500' }}>개</Text>
              </Text>
            </View>
          </Card>
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { padding: 24, paddingBottom: 16 },
  label: { fontSize: 12, color: palette.primary, fontWeight: '700', letterSpacing: 1.5, fontFamily: fontFamily.enBold },
  title: { marginTop: 4, fontSize: 24, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5 },
  toggleRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24 },
  toggleBtn: { flex: 1, height: 36, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  toggleActive: { backgroundColor: palette.primary },
  toggleText: { fontSize: 13, fontWeight: '600', color: palette.textBody },
  toggleActiveText: { color: '#fff' },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardSub: { fontSize: 12, color: palette.textCaption, fontWeight: '600' },
  avgNum: { marginTop: 4, fontSize: 28, fontWeight: '800', color: palette.textHeading, fontFamily: fontFamily.enBold },
  avgDenom: { fontSize: 14, color: palette.textMuted, fontWeight: '600' },
  emojiBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.mintBgSoft, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: palette.textHeading },
  tagRow: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9999 },
  tagText: { fontWeight: '600' },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barTrack: { height: 6, backgroundColor: palette.bgAlt, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%' as any, backgroundColor: palette.primary, borderRadius: 3 },
});
