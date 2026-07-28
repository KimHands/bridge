import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, fontFamily } from '@/theme/tokens';
import { Card, Pill } from '@/components/atoms';
import { useAuth } from '@/store/auth';
import { getApiError } from '@/lib/api';
import { useWeeklyMission } from '@/hooks/useMissionQueries';
import { useDiaryList } from '@/hooks/useDiaryQueries';
import {
  Target, Trophy, ChartBar, Notepad,
  Bell, Moon, Lock, Globe,
  Question, Envelope, Scroll, ShieldCheck, Megaphone, Lifebuoy,
  ShieldPlus, SignIn,
} from 'phosphor-react-native';

const ICON_PROPS = { size: 18, color: palette.primary, weight: 'duotone' as const };

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** total_score를 단순 레벨로 환산 (100점 단위) */
function scoreToLevel(score: number): number {
  return Math.max(1, Math.floor(score / 100) + 1);
}

export default function MyPageScreen() {
  const navigation = useNavigation<Nav>();
  const { user, logout, deleteAccount } = useAuth();
  const initial = (user?.nickname?.[0] ?? 'B').toUpperCase();

  const [darkOn, setDarkOn] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { data: weeklyMission } = useWeeklyMission();
  const { data: diaryList } = useDiaryList();

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

  // 1단계: 파기 안내 경고 → 동의 시 분기
  // - 익명 사용자: 비밀번호가 없으므로(password_hash=NULL) 모달 없이 바로 탈퇴 실행(JWT 소유가 본인 증명)
  // - 비익명 사용자: 기존대로 비밀번호 확인 모달 오픈
  const handleDeleteAccount = () => {
    Alert.alert(
      '회원 탈퇴',
      '탈퇴하면 일기·감정 기록·자가평가·루틴·챗봇 대화 등 모든 데이터가 즉시 영구 삭제되며 복구할 수 없어요. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '계속',
          style: 'destructive',
          onPress: () => {
            if (user?.is_anonymous) {
              submitAnonymousDelete();
            } else {
              setDeletePw('');
              setDeleteOpen(true);
            }
          },
        },
      ],
    );
  };

  // 익명 사용자 전용: 비밀번호 없이 즉시 탈퇴 실행
  const submitAnonymousDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      // deleteAccount가 user/token을 비우면 네비게이터가 인증 스택으로 자동 전환됨.
    } catch (e) {
      const err = getApiError(e);
      Alert.alert('탈퇴 실패', err.message);
    } finally {
      setDeleting(false);
    }
  };

  // 2단계(비익명 전용): 비밀번호 재확인 후 탈퇴 실행
  const submitDeleteAccount = async () => {
    if (!deletePw.trim()) {
      Alert.alert('비밀번호 확인', '비밀번호를 입력해 주세요.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(deletePw);
      setDeleteOpen(false);
      // deleteAccount가 user/token을 비우면 네비게이터가 인증 스택으로 자동 전환됨.
    } catch (e) {
      const err = getApiError(e);
      Alert.alert('탈퇴 실패', err.message);
    } finally {
      setDeleting(false);
    }
  };

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
          { icon: <Target {...ICON_PROPS} />, label: '내 목표', onPress: () => notImplemented('내 목표') },
          { icon: <Trophy {...ICON_PROPS} />, label: '달성 기록', badge: weeklyMission?.is_achieved ? '달성' : undefined, onPress: () => notImplemented('달성 기록') },
          { icon: <ChartBar {...ICON_PROPS} />, label: '이전 자가평가 결과 보기', onPress: () => navigation.navigate('Assessment', { mode: 'view' }) },
          { icon: <Notepad {...ICON_PROPS} />, label: '자가평가 다시 하기', onPress: () => navigation.navigate('Assessment') },
        ]}/>
        {user?.is_anonymous && (
          <Section title="계정" items={[
            { icon: <ShieldPlus {...ICON_PROPS} />, label: '계정 만들기 (기록 지키기)', onPress: () => navigation.navigate('Upgrade') },
            // 기존 이메일 계정이 있는 사용자를 위한 진입점 — 재설치/기기변경 시 자동 익명
            // 부트스트랩 때문에 로그인 화면에 닿지 못하는 문제(B6 리뷰 제품흐름 이슈) 대응.
            // device_secret은 그대로 두고 로그인 화면으로만 이동한다.
            { icon: <SignIn {...ICON_PROPS} />, label: '이미 계정이 있어요 · 로그인', onPress: () => navigation.navigate('Login') },
          ]}/>
        )}
        <Section title="설정" items={[
          { icon: <Bell {...ICON_PROPS} />, label: '알림 설정', onPress: () => navigation.navigate('NotificationSettings') },
          { icon: <Moon {...ICON_PROPS} />, label: '다크 모드', toggle: true, toggleOn: darkOn, onToggle: () => setDarkOn(v => !v) },
          { icon: <Lock {...ICON_PROPS} />, label: '잠금 설정', onPress: () => notImplemented('잠금 설정') },
          { icon: <Globe {...ICON_PROPS} />, label: '언어', value: '한국어', onPress: () => notImplemented('언어 설정') },
        ]}/>
        <Section title="고객 지원" items={[
          { icon: <Lifebuoy {...ICON_PROPS} />, label: '전문가 상담·기관 안내', onPress: () => navigation.navigate('SupportConnect') },
          { icon: <Question {...ICON_PROPS} />, label: '자주 묻는 질문', onPress: () => notImplemented('자주 묻는 질문') },
          { icon: <Envelope {...ICON_PROPS} />, label: '문의하기', onPress: () => notImplemented('문의하기') },
          { icon: <Scroll {...ICON_PROPS} />, label: '이용약관', onPress: () => navigation.navigate('Legal', { kind: 'tos' }) },
          { icon: <ShieldCheck {...ICON_PROPS} />, label: '개인정보 처리방침', onPress: () => navigation.navigate('Legal', { kind: 'privacy' }) },
          { icon: <Megaphone {...ICON_PROPS} />, label: '마케팅 정보 수신 동의', onPress: () => navigation.navigate('Legal', { kind: 'marketing' }) },
        ]}/>

        <Pressable onPress={handleLogout} style={s.logoutBtn}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.textCaption }}>로그아웃</Text>
        </Pressable>
        <Pressable onPress={handleDeleteAccount} disabled={deleting} style={s.deleteBtn}>
          {deleting
            ? <ActivityIndicator size="small" color={palette.danger} />
            : <Text style={{ fontSize: 13, fontWeight: '600', color: palette.danger }}>회원 탈퇴</Text>}
        </Pressable>
        <Text style={s.version}>v1.0.0 · Bridge</Text>
      </View>
    </ScrollView>

    <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => !deleting && setDeleteOpen(false)}>
      <View style={s.modalBackdrop}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>회원 탈퇴</Text>
          <Text style={s.modalBody}>본인 확인을 위해 비밀번호를 입력해 주세요. 확인 후 모든 데이터가 즉시 영구 삭제됩니다.</Text>
          <TextInput
            style={s.modalInput}
            placeholder="비밀번호"
            placeholderTextColor={palette.textMuted}
            secureTextEntry
            autoFocus
            value={deletePw}
            onChangeText={setDeletePw}
            editable={!deleting}
          />
          <View style={s.modalRow}>
            <Pressable style={[s.modalBtn, s.modalCancel]} disabled={deleting} onPress={() => setDeleteOpen(false)}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.textCaption }}>취소</Text>
            </Pressable>
            <Pressable style={[s.modalBtn, s.modalDanger]} disabled={deleting} onPress={submitDeleteAccount}>
              {deleting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>탈퇴하기</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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

type SectionItem = {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  badge?: string;
  value?: string;
  toggle?: boolean;
  toggleOn?: boolean;
  onToggle?: () => void;
};

function Section({ title, items }: { title: string; items: SectionItem[] }) {
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
              {it.icon}
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
  deleteBtn: { paddingVertical: 10, alignItems: 'center' },
  version: { textAlign: 'center', fontSize: 11, color: palette.textMuted, fontFamily: fontFamily.enBold },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 32 },
  modalCard: { backgroundColor: palette.bg, borderRadius: 18, padding: 22 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: palette.textHeading },
  modalBody: { marginTop: 10, fontSize: 13, color: palette.textBody, lineHeight: 20 },
  modalInput: { marginTop: 16, borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: palette.textHeading },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalCancel: { borderWidth: 1, borderColor: palette.border },
  modalDanger: { backgroundColor: palette.danger },
});
