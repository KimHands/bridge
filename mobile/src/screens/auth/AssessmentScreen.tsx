import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily } from '@/theme/tokens';
import { PrimaryButton, Card } from '@/components/atoms';
import { TopBar, DecorativeBlobs } from '@/components/BackHeader';
import { assessments } from '@/lib/api';
import type { CauseCode, AssessmentTier } from '@/types/assessment';

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

const CAUSES: { code: CauseCode; label: string; emoji: string }[] = [
  { code: 'sleep',        label: '수면 문제',     emoji: '😴' },
  { code: 'academic',     label: '학업·업무',     emoji: '📚' },
  { code: 'future',       label: '미래·진로',     emoji: '🔮' },
  { code: 'financial',    label: '경제적 걱정',   emoji: '💸' },
  { code: 'relationship', label: '대인관계',      emoji: '👥' },
  { code: 'physical',     label: '신체 건강',     emoji: '💪' },
  { code: 'unknown',      label: '잘 모르겠음',  emoji: '🤔' },
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

  // viewMode: 최신 자가평가 결과 조회 후 결과 화면 직진
  useEffect(() => {
    if (!isViewMode) return;
    let cancelled = false;
    (async () => {
      try {
        const history = await assessments.latest();
        if (cancelled) return;
        if (history.length === 0) {
          navigation.replace('Assessment');
          return;
        }
        setViewTier(history[0].phq9_level);
        setShowResult(true);
      } catch {
        if (!cancelled) navigation.goBack();
      } finally {
        if (!cancelled) setViewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isViewMode, navigation]);

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
    setTimeout(() => {
      if (step < QUESTIONS.length - 1) setStep(step + 1);
      else setStep(9); // go to cause selection
    }, 250);
  };

  const submitWithCause = async (selectedCause: CauseCode) => {
    setCause(selectedCause);
    setLoading(true);
    try {
      await assessments.submit(answers.map(a => a ?? 0), selectedCause);
    } catch { /* ignore */ }
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
          <View style={s.resultIcon}><Text style={{ fontSize: 42 }}>🌱</Text></View>
          <Text style={s.resultLabel}>자가평가 결과</Text>
          <Text style={s.resultShort}>{note.short}</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 14 }}>
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
          trailing={<Text style={s.counter}>마지막 단계</Text>}
        />
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
                <View style={isLast ? s.causeIconBoxSmall : s.causeIconBox} />
                <Text style={[s.causeLabel, isLast && s.causeLabelFull]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
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
  causeGrid: { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  causeBtn: {
    width: '48%',
    aspectRatio: 1,
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
});
