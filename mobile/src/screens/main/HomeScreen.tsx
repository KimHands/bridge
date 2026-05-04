import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, MainTabParamList } from '@/navigation/Navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, fontFamily, moodMeta } from '@/theme/tokens';
import { Card, Pill } from '@/components/atoms';
import CircleGauge from '@/components/CircleGauge';
import { useAuth } from '@/store/auth';
import { useRoutineList } from '@/hooks/useRoutineQueries';
import { useDiaryList } from '@/hooks/useDiaryQueries';
import { useStartDiary } from '@/hooks/useStartDiary';
import { routineEmoji } from '@/lib/routineEmoji';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// 5단계 mood_score 척도와 일치 (도메인 정의)
const MOODS = [
  { key: 'verybad',  emoji: '😭', label: '매우 나쁨' },
  { key: 'bad',      emoji: '😢', label: '나쁨' },
  { key: 'normal',   emoji: '😐', label: '보통' },
  { key: 'good',     emoji: '🙂', label: '좋음' },
  { key: 'verygood', emoji: '😊', label: '매우 좋음' },
] as const;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuth(s => s.user);
  const { data: routinesData } = useRoutineList();
  const { data: diariesData } = useDiaryList();
  const startDiary = useStartDiary();

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const weekDay = ['일','월','화','수','목','금','토'][today.getDay()];

  const routineList = routinesData?.routines ?? [];
  const done = routineList.filter(r => r.is_completed_today).length;
  const totalCount = routineList.length || 4;
  const pct = totalCount > 0 ? (done / totalCount) * 100 : 50;

  const recentDiaries = (diariesData?.items ?? []).slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.primaryBgSoft }} edges={['top']}>
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Hero */}
      <LinearGradient colors={[palette.primaryBgSoft, palette.bg]} style={s.hero}>
        <View style={s.heroRow}>
          <View>
            <Text style={s.heroDate}>{dateStr} · {weekDay}요일</Text>
            <Text style={s.heroGreet}>
              안녕하세요 <Text style={{ color: palette.primary }}>{user?.nickname || '친구'}</Text>님,
            </Text>
            <Text style={s.heroSub}>오늘도 마음 한 켠을 살펴볼까요?</Text>
          </View>
          <Pressable
            style={s.notifBtn}
            hitSlop={8}
            onPress={() => Alert.alert('알림', '알림 기능은 준비 중이에요.')}
          >
            <Svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke={palette.textBody} strokeWidth={1.6}>
              <Path d="M9 2a5 5 0 0 1 5 5v3l1.5 2.5h-13L4 10V7a5 5 0 0 1 5-5z"/>
              <Path d="M7 14a2 2 0 0 0 4 0"/>
            </Svg>
          </Pressable>
        </View>
      </LinearGradient>

      <View style={s.content}>
        {/* Mood card */}
        <Card style={{ borderRadius: 20 }}>
          <View style={s.moodHeader}>
            <View>
              <Text style={s.label}>TODAY'S MOOD</Text>
              <Text style={s.moodTitle}>오늘의 기분을 기록해보세요</Text>
            </View>
            <Pressable onPress={startDiary} style={s.logBtn}>
              <Text style={s.logBtnText}>기록하기 →</Text>
            </Pressable>
          </View>
          <View style={s.moodRow}>
            {MOODS.map(m => (
              <Pressable key={m.key} onPress={startDiary} style={s.moodChip}>
                <Text style={{ fontSize: 22, lineHeight: 28 }}>{m.emoji}</Text>
                <Text style={{ fontSize: 10, color: palette.textCaption }}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Routine card */}
        <Card style={{ marginTop: 14 }}>
          <View style={s.cardHeader}>
            <Text style={s.sectionTitle}>오늘의 루틴</Text>
            <Pressable onPress={() => navigation.navigate('Routine')}>
              <Text style={s.link}>전체보기 →</Text>
            </Pressable>
          </View>
          <View style={s.progressRow}>
            <View style={{ flex: 1 }}>
              <View style={s.progressNum}>
                <Text style={s.numBig}>{done}</Text>
                <Text style={s.numSub}>/ {totalCount} 완료</Text>
              </View>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${pct}%` as any }]}/>
              </View>
            </View>
            <CircleGauge value={pct} size={48}/>
          </View>
          <View style={{ marginTop: 14, gap: 0 }}>
            {routineList.length === 0 ? (
              <Text style={s.emptyHint}>아직 추가된 루틴이 없어요.</Text>
            ) : (
              routineList.slice(0, 2).map((r) => {
                const isDone = r.is_completed_today;
                return (
                  <View key={r.user_routine_id} style={s.routineLine}>
                    <View style={[s.routineIcon, { backgroundColor: palette.bgAlt }]}>
                      <Text style={{ fontSize: 14, lineHeight: 18 }}>{routineEmoji(r.title)}</Text>
                    </View>
                    <Text style={[s.routineName, isDone && s.routineDone]}>{r.title}</Text>
                    <View style={[s.checkCircle, { backgroundColor: isDone ? palette.primary : 'transparent', borderColor: isDone ? palette.primary : palette.borderStrong }]}>
                      {isDone && <Text style={{ color: '#fff', fontSize: 10, lineHeight: 12 }}>✓</Text>}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </Card>

        {/* Recent diary */}
        <View style={s.cardHeader}>
          <Text style={s.sectionTitle}>최근 일기</Text>
          <Pressable onPress={() => navigation.navigate('Diary')}>
            <Text style={s.link}>전체보기 →</Text>
          </Pressable>
        </View>
        {recentDiaries.length === 0 ? (
          <Card style={{ marginTop: 10 }}>
            <Text style={s.emptyHint}>아직 작성한 일기가 없어요.{'\n'}오늘의 마음을 기록해보세요.</Text>
          </Card>
        ) : (
          recentDiaries.map((d: any, i: number) => (
            <DiaryRow
              key={d.diary_id ?? i}
              diary={d}
              onPress={() => {
                if (d.diary_id) navigation.navigate('DiaryDetail', { entryId: String(d.diary_id) });
              }}
            />
          ))
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

function DiaryRow({ diary, onPress }: { diary: any; onPress?: () => void }) {
  const date = diary.created_at ? new Date(diary.created_at) : null;
  const day = date ? String(date.getDate()).padStart(2, '0') : '—';
  const month = date ? `${date.getMonth() + 1}` : '';
  const moodScore = (diary.mood_score ?? 3) as 1 | 2 | 3 | 4 | 5;
  const moodKey = (['verybad', 'bad', 'normal', 'good', 'verygood'] as const)[moodScore - 1] ?? 'normal';
  const moodInfo = moodMeta[moodKey];
  return (
    <Card onPress={onPress} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 44, alignItems: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: palette.textHeading, fontFamily: fontFamily.enBold, lineHeight: 18 }}>{day}</Text>
        <Text style={{ fontSize: 9, color: palette.textMuted, fontWeight: '600', marginTop: 2, fontFamily: fontFamily.enBold }}>{month}월</Text>
      </View>
      <View style={{ width: 1, height: 28, backgroundColor: palette.borderSubtle }}/>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Pill color={moodInfo.color} bg={moodInfo.color + '1A'}>{moodInfo.label}</Pill>
        {diary.memo_preview && (
          <Text style={{ marginTop: 6, fontSize: 12, color: palette.textBody }} numberOfLines={1}>{diary.memo_preview}</Text>
        )}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  hero: { padding: 24, paddingTop: 16, paddingBottom: 28 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroDate: { fontSize: 12, color: palette.textCaption, fontFamily: fontFamily.enBold, fontWeight: '600' },
  heroGreet: { marginTop: 4, fontSize: 22, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5 },
  heroSub: { fontSize: 14, color: palette.textCaption, marginTop: 2 },
  notifBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: palette.primary, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  content: { paddingHorizontal: 24, marginTop: -8 },
  moodHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 11, color: palette.primary, fontWeight: '700', letterSpacing: 1.2, fontFamily: fontFamily.enBold },
  moodTitle: { marginTop: 4, fontSize: 15, fontWeight: '700', color: palette.textHeading },
  logBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, backgroundColor: palette.primary },
  logBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  moodRow: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  moodChip: { flex: 1, marginHorizontal: 2, height: 64, borderRadius: 14, backgroundColor: palette.bgAlt, alignItems: 'center', justifyContent: 'center', gap: 4 },
  cardHeader: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: palette.textHeading },
  link: { fontSize: 12, color: palette.primary, fontWeight: '600' },
  progressRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressNum: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  numBig: { fontSize: 28, fontWeight: '800', color: palette.primary, fontFamily: fontFamily.enBold },
  numSub: { fontSize: 14, color: palette.textCaption, fontFamily: fontFamily.en },
  barTrack: { marginTop: 8, height: 6, backgroundColor: palette.bgAlt, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%' as any, backgroundColor: palette.primary, borderRadius: 3 },
  routineLine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  routineIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  routineName: { flex: 1, fontSize: 13, fontWeight: '600', color: palette.textHeading },
  routineDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  emptyHint: { fontSize: 13, color: palette.textCaption, lineHeight: 20, paddingVertical: 4 },
});
