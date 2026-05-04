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

const MOCK = { id: '1', emoji: '🧘', title: '아침 명상', time: '07:30', duration: '5분', streak: 12, done_today: true };

export default function RoutineDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'RoutineDetail'>>();
  const { routineId } = route.params;
  const deleteRoutine = useDeleteRoutine();

  const { data } = useRoutineList();
  const rawList: any[] = (data as any)?.routines ?? (Array.isArray(data) ? data : []);
  const found = rawList.find(x => String(x.user_routine_id ?? x.id) === routineId);
  const r = found ?? MOCK;
  const displayEmoji = r.emoji ?? routineEmoji(r.title ?? '');

  const handleDelete = () => {
    Alert.alert('루틴 삭제', `"${r.title}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await deleteRoutine.mutateAsync(routineId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar onBack={() => navigation.goBack()} title="루틴 상세"/>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header card */}
        <Card style={{ borderRadius: 20, alignItems: 'center' }}>
          <View style={s.emojiBox}><Text style={{ fontSize: 36, lineHeight: 44 }}>{displayEmoji}</Text></View>
          <Text style={s.routineTitle}>{r.title}</Text>
          <Text style={s.routineSub}>매일 {r.time} · {r.duration}</Text>
        </Card>

        {/* Streak card */}
        <Card style={{ marginTop: 14, backgroundColor: palette.primary }}>
          <Text style={s.streakLabel}>CURRENT STREAK</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <Text style={s.streakNum}>🔥 {r.streak}</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>일 연속</Text>
          </View>
          <Text style={s.streakSub}>대단해요! 7일만 더 하면 30일 배지를 받아요.</Text>
        </Card>

        {/* Weekly grid */}
        <Card style={{ marginTop: 14 }}>
          <Text style={s.sectionTitle}>이번 주 달성</Text>
          <View style={s.weekRow}>
            {DAYS.map((d, i) => {
              const done = i < 5;
              const isToday = i === 5;
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

        {/* Settings */}
        <Card style={{ marginTop: 14, padding: 4 }}>
          <Row label="시간" value={r.time}/>
          <Row label="요일" value="매일"/>
          <Row label="알림" value="ON"/>
          <Row label="메모" value="—"/>
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
  routineSub: { marginTop: 6, fontSize: 13, color: palette.textCaption },
  streakLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.2, fontWeight: '600', fontFamily: fontFamily.enBold },
  streakNum: { fontSize: 36, fontWeight: '800', color: '#fff', fontFamily: fontFamily.enBold },
  streakSub: { marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: palette.textHeading },
  weekRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderTopWidth: 1, borderTopColor: palette.borderSubtle },
  rowLabel: { fontSize: 13, color: palette.textHeading, fontWeight: '500' },
  rowValue: { fontSize: 13, color: palette.textCaption },
  deleteBtn: { marginTop: 20, alignItems: 'center', paddingVertical: 14 },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: palette.danger },
});
