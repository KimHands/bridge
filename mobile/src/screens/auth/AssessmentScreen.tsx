import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily } from '@/theme/tokens';
import { PrimaryButton, Card } from '@/components/atoms';
import { TopBar, DecorativeBlobs } from '@/components/BackHeader';
import { assessments } from '@/lib/api';
import type { CauseCode, AssessmentTier } from '@/types/assessment';
import { CauseIcon } from '@/lib/causeIcon';
import { CRISIS_HOTLINES, HOSPITAL_MAP_QUERY } from '@/lib/crisis';
import { Plant, Heart, Phone } from 'phosphor-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'Assessment'>;

const QUESTIONS = [
  '지난 2주간, 일상에 대한 흥미나 즐거움이 줄어들었다고 느꼈나요?',
  '지난 2주간, 우울하거나 절망감을 느낀 적이 있나요?',
  '지난 2주간, 잠들기 어렵거나 너무 많이 잤나요?',
  '지난 2주간, 피곤하거나 기운이 없다고 느꼈나요?',
  '지난 2주간, 식욕이 줄거나 과식한 적이 있나요?',
  '지난 2주간, 자신이 실패자라고 느낀 적이 있나요?',
  '지난 2주간, 집중하기 어려웠나요?',
  '지난 2주간, 평소보다 말이나 행동이 느려졌다고 느꼈나요?',
  '지난 2주간, 차라리 죽는 게 낫겠다는 생각을 한 적이 있나요?',
];
const OPTIONS = [
  { score: 0, label: '전혀 없음' },
  { score: 1, label: '며칠 동안' },
  { score: 2, label: '절반 이상' },
  { score: 3, label: '거의 매일' },
];

const CAUSES: { code: CauseCode; label: string }[] = [
  { code: 'sleep',        label: '수면 문제' },
  { code: 'academic',     label: '학업·업무' },
  { code: 'future',       label: '미래·진로' },
  { code: 'financial',    label: '경제적 걱정' },
  { code: 'relationship', label: '대인관계' },
  { code: 'physical',     label: '신체 건강' },
  { code: 'unknown',      label: '잘 모르겠음' },
];

const RESULT_NOTES = [
  { short: '편안한 상태네요', note: '현재 마음 상태가 안정적이에요. 가벼운 루틴으로 이 흐름을 이어가요.' },
  { short: '조금 지치셨나요', note: '조금 지친 신호가 보여요. 작은 회복 루틴부터 함께 시작해봐요.' },
  { short: '마음에 무게가 느껴지나요', note: '마음에 무게가 쌓여있어요. 매일의 기록과 명상이 도움이 될 거예요.' },
  { short: '지금 많이 힘드시군요', note: '지금 많이 힘드시군요. 전문가의 도움을 받는 것도 고려해보세요. 브릿지가 함께할게요.' },
];

function getNote(total: number) {
  if (total < 5) return RESULT_NOTES[0];
  if (total < 10) return RESULT_NOTES[1];
  if (total < 15) return RESULT_NOTES[2];
  return RESULT_NOTES[3];
}

function getNoteByTier(tier: AssessmentTier) {
  return RESULT_NOTES[tier - 1];
}

// 화면 단계: 0~8 = PHQ-9 문항, 9 = cause 선택, 10 = 결과
export default function AssessmentScreen({ navigation, route }: Props) {
  const isViewMode = route.params?.mode === 'view';
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(9).fill(null));
  const [cause, setCause] = useState<CauseCode | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewTier, setViewTier] = useState<AssessmentTier | null>(null);
  const [viewLoading, setViewLoading] = useState(isViewMode);
  // PHQ-9 9번(자살사고) 양성 신호. 백엔드 needs_professional_flag를 소비해 위기 안내를 분기한다.
  const [needsProfessional, setNeedsProfessional] = useState(false);

  // viewMode: 최신 자가평가 결과 조회 후 결과 화면 직진
  useEffect(() => {
    if (!isViewMode) return;
    let cancelled = false;

    const goBackSafely = () => {
      if (cancelled) return;
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('Assessment', undefined); // 평가 시작 화면으로 폴백
    };

    (async () => {
      try {
        const history = await assessments.latest();
        if (cancelled) return;

        // 응답이 배열이 아니거나 비어있으면 빈 이력으로 처리
        const items = Array.isArray(history) ? history : [];
        if (items.length === 0) {
          Alert.alert(
            '아직 자가평가 기록이 없어요',
            '먼저 자가평가를 진행해주세요.',
            [{ text: '확인', onPress: () => navigation.replace('Assessment', undefined) }],
          );
          return;
        }

        const latest = items[0];
        if (typeof latest?.phq9_level !== 'number') {
          throw new Error('Invalid assessment data');
        }
        setViewTier(latest.phq9_level);
        setNeedsProfessional(latest.needs_professional_flag === true);
        setShowResult(true);
      } catch {
        if (cancelled) return;
        Alert.alert(
          '결과를 불러오지 못했어요',
          '잠시 후 다시 시도해주세요.',
          [{ text: '확인', onPress: goBackSafely }],
        );
      } finally {
        if (!cancelled) setViewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isViewMode, navigation]);

  // step 자동 진행 타이머 — early return보다 위에서 선언해 Hook 호출 순서를 고정한다.
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  const total = answers.reduce<number>((a, b) => a + (b ?? 0), 0);
  const note = isViewMode && viewTier !== null ? getNoteByTier(viewTier) : getNote(total);

  if (viewLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  const selectAnswer = (score: number) => {
    const next = [...answers];
    next[step] = score;
    setAnswers(next);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      if (step < QUESTIONS.length - 1) setStep(step + 1);
      else setStep(9); // go to cause selection
    }, 250);
  };

  const submitWithCause = async (selectedCause: CauseCode) => {
    setCause(selectedCause);
    setLoading(true);
    try {
      const res = await assessments.submit(answers.map(a => a ?? 0), selectedCause);
      // 자살사고(9번) 양성 신호를 결과 화면 위기 안내 분기에 사용.
      setNeedsProfessional(res?.needs_professional_flag === true);
    } catch {
      // 제출 실패 시에도 9번 응답이 양성이면 안전하게 위기 안내를 노출(로컬 폴백).
      setNeedsProfessional((answers[8] ?? 0) >= 1);
    }
    setLoading(false);
    setShowResult(true);
  };

  // ── Result screen ─────────────────────────────────────────
  if (showResult) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
        <DecorativeBlobs/>
        <TopBar onBack={isViewMode ? () => navigation.goBack() : undefined} transparent={!isViewMode}/>
        <View style={s.resultCenter}>
          <View style={s.resultIcon}><Plant size={56} color={palette.primary} weight="duotone" /></View>
          <Text style={s.resultLabel}>자가평가 결과</Text>
          <Text style={s.resultShort}>{note.short}</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 14 }}>
          {needsProfessional && <CrisisSupportCard />}
          <Card>
            <Text style={s.noteLabel}>BRIDGE'S NOTE</Text>
            <Text style={s.noteBody}>{note.note}</Text>
          </Card>
          {isViewMode ? (
            <PrimaryButton variant="soft" onPress={() => navigation.goBack()}>
              마이페이지로 돌아가기
            </PrimaryButton>
          ) : (
            <PrimaryButton onPress={() => navigation.navigate('InitialRoutine')}>
              루틴 설정하러 가기
            </PrimaryButton>
          )}
        </View>
      </ScrollView>
    );
  }

  // ── Cause selection step ──────────────────────────────────
  if (step === 9) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <TopBar
          onBack={() => setStep(8)}
          trailing={<Text style={s.counter} numberOfLines={1}>마지막 단계</Text>}
        />
        <ScrollView contentContainerStyle={s.causeScroll}>
          <View style={s.qWrap}>
            <Text style={s.qNum}>마지막 질문</Text>
            <Text style={s.qText}>요즘 마음이 무거운 주된 이유가 있다면 무엇인가요?</Text>
          </View>
          <View style={s.causeGrid}>
            {CAUSES.map((c, i) => {
              const isLast = i === CAUSES.length - 1;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => submitWithCause(c.code)}
                  disabled={loading}
                  style={[isLast ? s.causeBtnFull : s.causeBtn, loading && { opacity: 0.5 }]}
                >
                  <View style={isLast ? s.causeIconBoxSmall : s.causeIconBox}>
                    <CauseIcon code={c.code} size={isLast ? 28 : 36} />
                  </View>
                  <Text style={[s.causeLabel, isLast && s.causeLabelFull]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── PHQ-9 question step ───────────────────────────────────
  const progress = step / QUESTIONS.length;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar
        onBack={step > 0 ? () => setStep(step - 1) : () => navigation.goBack()}
        trailing={<Text style={s.counter}>{step + 1}/{QUESTIONS.length}</Text>}
      />
      <View style={s.trackWrap}>
        <View style={[s.trackFill, { width: `${progress * 100}%` as any }]}/>
      </View>
      <View style={s.qWrap}>
        <Text style={s.qNum}>QUESTION {String(step + 1).padStart(2, '0')}</Text>
        <Text style={s.qText}>{QUESTIONS[step]}</Text>
      </View>
      <View style={s.options}>
        {OPTIONS.map(o => (
          <Pressable
            key={o.score}
            onPress={() => selectAnswer(o.score)}
            style={[s.option, answers[step] === o.score && s.optionSelected]}
          >
            <Text style={[s.optionLabel, answers[step] === o.score && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// 자살사고(PHQ-9 9번) 양성 시 결과 화면에 노출하는 위기 연계 안내.
// 규제 가이드 준수: '치료·진단·병원' 등 의료 표현 대신 '전문기관/기관'을 사용한다.
function CrisisSupportCard() {
  const callHotline = (number: string) =>
    Linking.openURL(`tel:${number.replace(/-/g, '')}`).catch(() => {});

  return (
    <View style={s.crisisCard}>
      <View style={s.crisisHeader}>
        <Heart size={20} color={palette.danger} weight="fill" />
        <Text style={s.crisisTitle}>혼자 견디지 않아도 괜찮아요</Text>
      </View>
      <Text style={s.crisisBody}>
        지금 많이 힘든 마음이 느껴져요. 아래 전문기관에서 24시간 도움을 받을 수 있어요.
      </Text>
      {CRISIS_HOTLINES.map(h => (
        <Pressable key={h.number} style={s.crisisHotline} onPress={() => callHotline(h.number)}>
          <Phone size={18} color={palette.danger} weight="duotone" />
          <Text style={s.crisisHotlineLabel}>{h.label}</Text>
          <Text style={s.crisisHotlineNumber}>{h.number}</Text>
        </Pressable>
      ))}
      <Pressable
        style={s.crisisMap}
        onPress={() => { Linking.openURL(HOSPITAL_MAP_QUERY).catch(() => {}); }}
      >
        <Text style={s.crisisMapText}>내 주변 기관 찾아보기 →</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  counter: { fontSize: 13, color: palette.textCaption, fontFamily: fontFamily.en },
  trackWrap: { height: 4, marginHorizontal: 24, backgroundColor: palette.borderSubtle, borderRadius: 2 },
  trackFill: { height: 4, backgroundColor: palette.primary, borderRadius: 2 },
  qWrap: { padding: 32 },
  qNum: { fontSize: 13, color: palette.primary, fontWeight: '700', fontFamily: fontFamily.enBold, letterSpacing: 1.5 },
  qText: { marginTop: 12, fontSize: 22, fontWeight: '700', color: palette.textHeading, lineHeight: 32, letterSpacing: -0.3 },
  options: { paddingHorizontal: 28, gap: 12 },
  option: {
    height: 64, paddingHorizontal: 20, borderRadius: 16,
    backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start',
    shadowColor: palette.primary, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  optionSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  optionLabel: { fontSize: 15, fontWeight: '600', color: palette.textHeading },
  causeScroll: { paddingBottom: 40 },
  causeGrid: { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 },
  causeBtn: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    shadowColor: palette.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  causeIconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: palette.primaryBgSoft,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  causeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textHeading,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  causeBtnFull: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 16,
    shadowColor: palette.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  causeIconBoxSmall: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: palette.primaryBgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  causeLabelFull: {
    textAlign: 'left',
    flex: 1,
  },
  // result
  resultCenter: { zIndex: 2, paddingTop: 24, paddingBottom: 24, alignItems: 'center', paddingHorizontal: 24 },
  resultIcon: { width: 96, height: 96, borderRadius: 9999, backgroundColor: palette.primaryBgSoft, alignItems: 'center', justifyContent: 'center' },
  resultLabel: { marginTop: 24, fontSize: 14, color: palette.textCaption, fontFamily: fontFamily.enBold, letterSpacing: 1.5, fontWeight: '600' },
  resultShort: { marginTop: 8, fontSize: 28, fontWeight: '800', color: palette.textHeading },
  noteLabel: { fontSize: 13, color: palette.primary, fontWeight: '700', fontFamily: fontFamily.enBold, letterSpacing: 1.2 },
  noteBody: { marginTop: 10, fontSize: 14, color: palette.textBody, lineHeight: 22 },
  // crisis support
  crisisCard: { backgroundColor: '#FBE9E9', borderRadius: 18, padding: 18, gap: 12 },
  crisisHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  crisisTitle: { fontSize: 16, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.3 },
  crisisBody: { fontSize: 13, color: palette.textBody, lineHeight: 20 },
  crisisHotline: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  crisisHotlineLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: palette.textHeading },
  crisisHotlineNumber: { fontSize: 15, fontWeight: '800', color: palette.danger, fontFamily: fontFamily.enBold },
  crisisMap: { alignItems: 'center', paddingVertical: 10 },
  crisisMapText: { fontSize: 13, fontWeight: '700', color: palette.danger },
});
