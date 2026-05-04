import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, fontFamily } from '@/theme/tokens';
import { Card, Pill } from '@/components/atoms';
import { useAuth } from '@/store/auth';
import { useWeeklyMission } from '@/hooks/useMissionQueries';
import { useQuery } from '@tanstack/react-query';
import { diary } from '@/lib/api';
import type { DiaryListResponse } from '@/types/diary';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** total_score를 단순 레벨로 환산 (100점 단위) */
function scoreToLevel(score: number): number {
  return Math.max(1, Math.floor(score / 100) + 1);
}

export default function MyPageScreen() {
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuth();
  const initial = (user?.nickname?.[0] ?? 'B').toUpperCase();

  const [notifOn, setNotifOn] = useState(true);
  const [darkOn, setDarkOn] = useState(false);

  const { data: weeklyMission } = useWeeklyMission();
  const { data: diaryList } = useQuery<DiaryListResponse, Error>({
    queryKey: ['diary', 'list'],
    queryFn: () => diary.list(),
  });

  const totalScore = weeklyMission?.total_score ?? 0;
  const level = scoreToLevel(totalScore);
  const diaryCount = diaryList?.items?.length ?? 0;
  const routineDays = weeklyMission?.routine_days ?? 0;

  const handleLogout = async () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  const notImplemented = (label: string) =>
    Alert.alert(label, '해당 기능은 준비 중이에요.');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={s.header}>
        <Text style={s.label}>MY PAGE</Text>
        <Text style={s.title}>마이페이지</Text>
      </View>

      <View style={{ paddingHorizontal: 24, gap: 14 }}>
        {/* Profile card */}
        <Card onPress={() => navigation.navigate('ProfileEdit')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <LinearGradient colors={[palette.primary, palette.primarySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={s.nickname}>{user?.nickname ?? '친구'}</Text>
            <Text style={s.email}>{user?.email ?? ''}</Text>
            <View style={{ marginTop: 8, flexDirection: 'row', gap: 6 }}>
              <Pill bg={palette.mintBgSoft} color={palette.mintDeep}>이번 주 루틴 {routineDays}일</Pill>
              <Pill>Lv.{level}</Pill>
            </View>
          </View>
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={palette.textMuted} strokeWidth={1.5}>
            <Path d="M6 4l4 4-4 4"/>
          </Svg>
        </Card>

        {/* Stats */}
        <View style={s.statsRow}>
          <StatCard label="이번 주 루틴" value={routineDays} suffix="일"/>
          <StatCard label="작성 일기" value={diaryCount} suffix="개"/>
          <StatCard label="누적 미션 점수" value={totalScore} suffix="점"/>
        </View>

        <Section title="활동" items={[
          { icon: '🎯', label: '내 목표', onPress: () => notImplemented('내 목표') },
          { icon: '🏆', label: '달성 기록', badge: weeklyMission?.is_achieved ? '달성' : undefined, onPress: () => notImplemented('달성 기록') },
          { icon: '📊', label: '이전 자가평가 결과 보기', onPress: () => navigation.navigate('Assessment', { mode: 'view' }) },
          { icon: '📝', label: '자가평가 다시 하기', onPress: () => navigation.navigate('Assessment') },
        ]}/>
        <Section title="설정" items={[
          { icon: '🔔', label: '알림 설정', toggle: true, toggleOn: notifOn, onToggle: () => setNotifOn(v => !v) },
          { icon: '🌙', label: '다크 모드', toggle: true, toggleOn: darkOn, onToggle: () => setDarkOn(v => !v) },
          { icon: '🔒', label: '잠금 설정', onPress: () => notImplemented('잠금 설정') },
          { icon: '🌐', label: '언어', value: '한국어', onPress: () => notImplemented('언어 설정') },
        ]}/>
        <Section title="고객 지원" items={[
          { icon: '❓', label: '자주 묻는 질문', onPress: () => notImplemented('자주 묻는 질문') },
          { icon: '✉️', label: '문의하기', onPress: () => notImplemented('문의하기') },
          { icon: '📜', label: '이용약관', onPress: () => navigation.navigate('Legal', { kind: 'tos' }) },
          { icon: '🔐', label: '개인정보 처리방침', onPress: () => navigation.navigate('Legal', { kind: 'privacy' }) },
          { icon: '📣', label: '마케팅 정보 수신 동의', onPress: () => navigation.navigate('Legal', { kind: 'marketing' }) },
        ]}/>

        <Pressable onPress={handleLogout} style={s.logoutBtn}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.textCaption }}>로그아웃</Text>
        </Pressable>
        <Text style={s.version}>v1.0.0 · Bridge</Text>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, color: palette.textCaption, fontWeight: '600' }}>{label}</Text>
      <Text style={{ marginTop: 6, fontSize: 22, fontWeight: '800', color: palette.textHeading, fontFamily: fontFamily.enBold }}>
        {value}<Text style={{ fontSize: 11, color: palette.textMuted, fontWeight: '500' }}>{suffix}</Text>
      </Text>
    </Card>
  );
}

function Section({ title, items }: { title: string; items: any[] }) {
  return (
    <View>
      <Text style={s.sectionTitle}>{title}</Text>
      <Card style={{ padding: 4 }}>
        {items.map((it, i) => (
          <Pressable
            key={i}
            onPress={it.toggle ? it.onToggle : it.onPress}
            style={[s.row, i > 0 && s.rowBorder]}
          >
            <View style={s.rowIcon}>
              <Text style={{ fontSize: 14, lineHeight: 18 }}>{it.icon}</Text>
            </View>
            <Text style={s.rowLabel}>{it.label}</Text>
            {it.badge && (
              <View style={s.badge}><Text style={s.badgeText}>{it.badge}</Text></View>
            )}
            {it.value && !it.toggle && <Text style={s.rowValue}>{it.value}</Text>}
            {it.toggle && (
              <View style={[s.switch, { backgroundColor: it.toggleOn ? palette.primary : palette.borderStrong }]}>
                <View style={[s.thumb, { left: it.toggleOn ? 16 : 2 }]}/>
              </View>
            )}
            {!it.toggle && (
              <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={palette.textMuted} strokeWidth={1.5}>
                <Path d="M5 3l4 4-4 4"/>
              </Svg>
            )}
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  header: { padding: 24, paddingBottom: 16 },
  label: { fontSize: 12, color: palette.primary, fontWeight: '700', letterSpacing: 1.5, fontFamily: fontFamily.enBold },
  title: { marginTop: 4, fontSize: 24, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5 },
  avatar: { width: 64, height: 64, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800', fontFamily: fontFamily.display },
  nickname: { fontSize: 17, fontWeight: '800', color: palette.textHeading },
  email: { fontSize: 12, color: palette.textCaption, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: palette.textCaption, marginBottom: 8, paddingLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: palette.borderSubtle },
  rowIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: palette.primaryBgWash, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: palette.textHeading },
  rowValue: { fontSize: 12, color: palette.textCaption },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: palette.primary + '1A' },
  badgeText: { fontSize: 11, fontWeight: '600', color: palette.primary },
  switch: { width: 36, height: 22, borderRadius: 11, position: 'relative' },
  thumb: { position: 'absolute', top: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  logoutBtn: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: palette.border, alignItems: 'center' },
  version: { textAlign: 'center', fontSize: 11, color: palette.textMuted, fontFamily: fontFamily.enBold },
});
