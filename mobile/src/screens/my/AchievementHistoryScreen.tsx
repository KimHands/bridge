// mobile/src/screens/my/AchievementHistoryScreen.tsx
// 달성 기록 — 주차별 미션 달성 이력. GET /missions/total(weekly_history)을 사용한다.
// 데이터·API·훅(useTotalMission)은 이미 있었고 화면만 없던 항목을 채운다.
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Trophy } from 'phosphor-react-native';
import { TopBar } from '@/components/BackHeader';
import { palette, typography } from '@/theme/tokens';
import { useTotalMission } from '@/hooks/useMissionQueries';

const INTRO =
  '주간 점수는 루틴 달성과 일기 작성으로 쌓여요. 각 주의 기록과 달성 여부를 모아 보여드려요.';

/** "2026-W31" → "2026년 31주차" 표기 */
function formatWeek(weekYear: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekYear);
  if (!m) return weekYear;
  return `${m[1]}년 ${Number(m[2])}주차`;
}

export default function AchievementHistoryScreen() {
  const navigation = useNavigation();
  const { data, isLoading } = useTotalMission();

  // 백엔드는 오래된 주차부터 오름차순으로 내려주므로 최신 주차가 위로 오게 뒤집는다.
  const history = [...(data?.weekly_history ?? [])].reverse();

  return (
    <View style={s.container}>
      <TopBar title="달성 기록" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>누적 미션 점수</Text>
          <Text style={s.summaryValue}>{data?.total_score ?? 0}점</Text>
          <Text style={s.summaryNote}>{INTRO}</Text>
        </View>

        <Text style={s.sectionTitle}>주차별 기록</Text>

        {isLoading ? (
          <View style={s.centerBox}>
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : history.length === 0 ? (
          <View style={s.emptyCard}>
            <Trophy size={28} color={palette.textCaption} weight="duotone" />
            <Text style={s.emptyText}>아직 달성 기록이 없어요.{'\n'}루틴과 일기를 꾸준히 채워보세요.</Text>
          </View>
        ) : (
          <View style={s.listCard}>
            {history.map((item, idx) => (
              <View
                key={item.week_year}
                style={[s.row, idx < history.length - 1 && s.rowDivider]}
              >
                <View style={s.rowLeft}>
                  <Text style={s.rowWeek}>{formatWeek(item.week_year)}</Text>
                  <Text style={s.rowScore}>{item.weekly_score}점</Text>
                </View>
                <View style={[s.badge, item.is_achieved ? s.badgeOn : s.badgeOff]}>
                  <Text style={[s.badgeText, item.is_achieved ? s.badgeTextOn : s.badgeTextOff]}>
                    {item.is_achieved ? '달성' : '미달'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  scroll: { padding: 16, gap: 8 },
  summaryCard: { backgroundColor: palette.primaryBgWash, borderRadius: 12, padding: 16, marginBottom: 8 },
  summaryLabel: { ...typography.body, color: palette.textBody },
  summaryValue: { ...typography.h2, color: palette.primary, marginTop: 4 },
  summaryNote: { ...typography.caption, color: palette.textCaption, marginTop: 8 },
  sectionTitle: { ...typography.bodyBold, color: palette.textHeading, marginTop: 12, marginBottom: 8 },
  listCard: { backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.borderSubtle, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: palette.borderSubtle },
  rowLeft: { gap: 2 },
  rowWeek: { ...typography.bodyBold, color: palette.textHeading },
  rowScore: { ...typography.caption, color: palette.textCaption },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  badgeOn: { backgroundColor: palette.primaryBgWash },
  badgeOff: { backgroundColor: palette.bg },
  badgeText: { ...typography.captionBold },
  badgeTextOn: { color: palette.primary },
  badgeTextOff: { color: palette.textCaption },
  centerBox: { paddingVertical: 40, alignItems: 'center' },
  emptyCard: { backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.borderSubtle, padding: 28, alignItems: 'center', gap: 10 },
  emptyText: { ...typography.body, color: palette.textCaption, textAlign: 'center' },
});
