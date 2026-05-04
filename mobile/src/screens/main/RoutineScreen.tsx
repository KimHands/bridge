import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, fontFamily } from '@/theme/tokens';
import { Card } from '@/components/atoms';
import { useRoutineList, useToggleRoutine } from '@/hooks/useRoutineQueries';
import { RoutineIcon } from '@/lib/routineIcon';
import type { RoutineItem } from '@/types/routine';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function BigGauge({ value }: { value: number }) {
  const r = 28, c = 2 * Math.PI * r;
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72">
      <Circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={6}/>
      <Circle cx={36} cy={36} r={r} fill="none" stroke="#fff" strokeWidth={6}
              strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - value / 100)}
              strokeLinecap="round" transform="rotate(-90 36 36)"/>
      <SvgText x={36} y={42} textAnchor="middle" fill="#fff" fontSize={18} fontWeight="800" fontFamily={fontFamily.enBold}>
        {`${Math.round(value)} %`}
      </SvgText>
    </Svg>
  );
}

export default function RoutineScreen() {
  const navigation = useNavigation<Nav>();
  const { data } = useRoutineList();
  const toggle = useToggleRoutine();
  const items: RoutineItem[] = data?.routines ?? [];

  const done = items.filter(r => r.is_completed_today).length;
  const pct = items.length > 0 ? (done / items.length) * 100 : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={s.header}>
        <Text style={s.label}>MY ROUTINE</Text>
        <Text style={s.title}>오늘의 루틴</Text>
      </View>

      <View style={{ paddingHorizontal: 24 }}>
        <Card style={{ backgroundColor: palette.primary, padding: 0 }}>
          <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <BigGauge value={pct}/>
            <View>
              <Text style={s.progressLabel}>TODAY'S PROGRESS</Text>
              <Text style={s.progressNum}>
                {done} <Text style={{ fontSize: 14, opacity: 0.75 }}>/ {items.length} 완료</Text>
              </Text>
              <Text style={s.progressSub}>
                {pct >= 100 ? '완벽해요! 이대로 계속 이어가요 ✨' : pct >= 50 ? '절반 넘었어요! 조금만 더 해요 🙌' : '오늘도 화이팅! 천천히 해나가요 💪'}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
        <Text style={s.sectionLabel}>전체 루틴</Text>
        {items.length === 0 ? (
          <Card style={{ marginTop: 10, alignItems: 'center', paddingVertical: 28 }}>
            <Text style={s.emptyTitle}>아직 추가된 루틴이 없어요</Text>
            <Text style={s.emptySub}>아래 + 버튼으로 첫 루틴을 추가해보세요.</Text>
          </Card>
        ) : (
          <View style={{ marginTop: 10, gap: 10 }}>
            {items.map((r) => {
              const routineId = r.user_routine_id;
              const isDone = r.is_completed_today;
              return (
                <Card key={routineId} onPress={() => navigation.navigate('RoutineDetail', { routineId: String(routineId) })} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
                  <View style={[s.emojiBox, { backgroundColor: isDone ? palette.mintBgSoft : palette.bgAlt, opacity: isDone ? 0.7 : 1 }]}>
                    <RoutineIcon title={r.title} size={26} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.routineName, isDone && s.routineDone]}>{r.title}</Text>
                    {r.description && (
                      <View style={s.routineMeta}>
                        <Text style={s.metaText} numberOfLines={1}>{r.description}</Text>
                      </View>
                    )}
                  </View>
                  <Pressable
                    onPress={() => toggle.mutate({ id: String(routineId), done: !isDone })}
                    style={[s.checkBtn, { backgroundColor: isDone ? palette.primary : 'transparent', borderColor: isDone ? palette.primary : palette.borderStrong }]}
                  >
                    {isDone && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
                  </Pressable>
                </Card>
              );
            })}
          </View>
        )}

        <Pressable onPress={() => navigation.navigate('RoutineAdd')} style={s.addBtn}>
          <Text style={{ fontSize: 18 }}>+</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.primary }}> 새로운 루틴 추가</Text>
        </Pressable>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { padding: 24, paddingBottom: 16 },
  label: { fontSize: 12, color: palette.primary, fontWeight: '700', letterSpacing: 1.5, fontFamily: fontFamily.enBold },
  title: { marginTop: 4, fontSize: 24, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5 },
  progressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: fontFamily.enBold, fontWeight: '600' },
  progressNum: { marginTop: 2, fontSize: 22, fontWeight: '800', color: '#fff' },
  progressSub: { marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: palette.textCaption },
  emojiBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  routineName: { fontSize: 14, fontWeight: '700', color: palette.textHeading },
  routineDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  routineMeta: { marginTop: 2, flexDirection: 'row', gap: 8 },
  metaText: { fontSize: 11, color: palette.textCaption },
  checkBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    marginTop: 14, padding: 16, borderRadius: 16,
    borderWidth: 1.5, borderColor: palette.borderStrong, borderStyle: 'dashed',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: palette.textHeading, letterSpacing: -0.3 },
  emptySub: { marginTop: 8, fontSize: 12, color: palette.textCaption, textAlign: 'center' },
});
