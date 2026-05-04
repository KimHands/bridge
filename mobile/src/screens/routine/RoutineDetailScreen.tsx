import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily } from '@/theme/tokens';
import { Card } from '@/components/atoms';
import { TopBar } from '@/components/BackHeader';
import { useDeleteRoutine, useRoutineList } from '@/hooks/useRoutineQueries';
import { routineEmoji } from '@/lib/routineEmoji';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DAYS = ['월','화','수','목','금','토','일'];

export default function RoutineDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'RoutineDetail'>>();
  const { routineId } = route.params;
  const deleteRoutine = useDeleteRoutine();

  const { data } = useRoutineList();
  const r = data?.routines.find(x => x.user_routine_id === routineId);

  const safeBack = () => { if (navigation.canGoBack()) navigation.goBack(); };

  const handleDelete = () => {
    if (!r) return;
    Alert.alert('루틴 삭제', `"${r.title}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await deleteRoutine.mutateAsync(routineId);
          if (navigation.isFocused() && navigation.canGoBack()) navigation.goBack();
        },
      },
    ]);
  };

  if (!r) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <TopBar onBack={safeBack} title="루틴 상세"/>
        <View style={s.empty}>
          <Text style={s.emptyTitle}>루틴을 찾을 수 없어요</Text>
          <Text style={s.emptySub}>이미 삭제되었거나 만료된 루틴이에요.</Text>
        </View>
      </View>
    );
  }

  const displayEmoji = routineEmoji(r.title);
  const todayIdx = (new Date().getDay() + 6) % 7; // 일=0 → 토=6 → 월=0 보정

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar onBack={safeBack} title="루틴 상세"/>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header card */}
        <Card style={{ borderRadius: 20, alignItems: 'center' }}>
          <View style={s.emojiBox}><Text style={{ fontSize: 36, lineHeight: 44 }}>{displayEmoji}</Text></View>
          <Text style={s.routineTitle}>{r.title}</Text>
          {r.description ? <Text style={s.routineSub}>{r.description}</Text> : null}
        </Card>

        {/* Weekly grid — 오늘 완료 여부만 실데이터, 나머지는 시각 placeholder */}
        <Card style={{ marginTop: 14 }}>
          <Text style={s.sectionTitle}>이번 주 달성</Text>
          <View style={s.weekRow}>
            {DAYS.map((d, i) => {
              const isToday = i === todayIdx;
              const done = isToday && r.is_completed_today;
              return (
                <View key={i} style={{ alignItems: 'center', gap: 8 }}>
                  <View style={[s.dayCircle, {
                    backgroundColor: done ? palette.primary : palette.bgAlt,
                    borderWidth: isToday ? 2 : 0,
                    borderColor: isToday ? palette.primary : 'transparent',
                  }]}>
                    <Text style={{ color: done ? '#fff' : palette.textMuted, fontSize: 13, fontWeight: '700' }}>
                      {done ? '✓' : isToday ? d : '·'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: palette.textCaption, fontWeight: '600' }}>{d}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Settings — 시간/알림은 백엔드 미구현이라 placeholder */}
        <Card style={{ marginTop: 14, padding: 4 }}>
          <Row label="요일" value="매일"/>
          <Row label="알림" value="—"/>
          <Row label="설명" value={r.description || '—'}/>
        </Card>

        <Pressable onPress={handleDelete} style={s.deleteBtn}>
          <Text style={s.deleteBtnText}>이 루틴 삭제</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={s.rowValue}>{value}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 16, paddingBottom: 40 },
  emojiBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: palette.primaryBgSoft, alignItems: 'center', justifyContent: 'center' },
  routineTitle: { marginTop: 16, fontSize: 22, fontWeight: '800', color: palette.textHeading },
  routineSub: { marginTop: 6, fontSize: 13, color: palette.textCaption, textAlign: 'center', paddingHorizontal: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: palette.textHeading },
  weekRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderTopWidth: 1, borderTopColor: palette.borderSubtle },
  rowLabel: { fontSize: 13, color: palette.textHeading, fontWeight: '500' },
  rowValue: { fontSize: 13, color: palette.textCaption },
  deleteBtn: { marginTop: 20, alignItems: 'center', paddingVertical: 14 },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: palette.danger },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: palette.textHeading, letterSpacing: -0.4 },
  emptySub: { marginTop: 8, fontSize: 13, color: palette.textCaption, textAlign: 'center' },
});
