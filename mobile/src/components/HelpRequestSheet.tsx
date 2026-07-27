// HelpRequestSheet — "지금 도움이 필요해요" 2단계 시트.
// 1단계: [가벼운 대처 루틴] vs [지금 많이 힘들어요] 사용자 자기선택.
// 앱은 위기 여부를 판단하지 않는다 — 두 번째 버튼은 사용자 스스로의 선택으로만 SupportConnect로 이동한다.
// 1번 버튼 결과는 POST /routines/request 응답 state(assigned/cooldown/no_routine)에 따라 분기 표시.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, radius, shadow, typography } from '@/theme/tokens';
import { PrimaryButton } from '@/components/atoms';
import { routines, getApiError } from '@/lib/api';
import type { RoutineRequestResponse } from '@/types/routine';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Step = 'choose' | 'result' | 'error';

const TOO_FREQUENT_MESSAGE = '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.';
const GENERIC_ERROR_MESSAGE = '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.';

export default function HelpRequestSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('choose');
  const [result, setResult] = useState<RoutineRequestResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 시트를 열 때마다 이전 결과를 지우고 1단계부터 다시 시작한다.
  useEffect(() => {
    if (visible) {
      setStep('choose');
      setResult(null);
      setErrorMsg(null);
      setLoading(false);
    }
  }, [visible]);

  const handleRequestRoutine = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await routines.request();
      setResult(res);
      setStep('result');
    } catch (err) {
      const apiErr = getApiError(err);
      setErrorMsg(apiErr.status === 429 ? TOO_FREQUENT_MESSAGE : (apiErr.message || GENERIC_ERROR_MESSAGE));
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const goToSupportConnect = () => {
    onClose();
    navigation.navigate('SupportConnect');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
        <View style={s.grabber} />

        {step === 'choose' && (
          <>
            <Text style={s.title}>지금 도움이 필요해요</Text>
            <Text style={s.subtitle}>지금 이 순간, 어떤 게 더 도움이 될까요?</Text>

            <Pressable
              style={({ pressed }) => [s.optionCard, pressed && s.optionCardPressed]}
              onPress={handleRequestRoutine}
              disabled={loading}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.optionTitle}>가벼운 대처 루틴 받기</Text>
                <Text style={s.optionDesc}>짧은 루틴 하나를 바로 받아볼게요</Text>
              </View>
              {loading && <ActivityIndicator color={palette.primary} />}
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.optionCard, s.optionCardAlt, pressed && s.optionCardPressed]}
              onPress={goToSupportConnect}
              disabled={loading}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.optionTitle}>지금 많이 힘들어요</Text>
                <Text style={s.optionDesc}>전문가와 이야기할 수 있는 곳으로 안내해드려요</Text>
              </View>
            </Pressable>

            <Pressable style={s.closeLink} onPress={onClose} hitSlop={8}>
              <Text style={s.closeLinkText}>닫기</Text>
            </Pressable>
          </>
        )}

        {step === 'result' && result && (
          <ResultCard result={result} onClose={onClose} onConnect={goToSupportConnect} />
        )}

        {step === 'error' && (
          <>
            <Text style={s.title}>요청을 처리하지 못했어요</Text>
            <Text style={s.resultBody}>{errorMsg}</Text>
            <PrimaryButton onPress={onClose} style={{ marginTop: 20 }}>확인</PrimaryButton>
          </>
        )}
      </View>
    </Modal>
  );
}

function ResultCard({
  result,
  onClose,
  onConnect,
}: {
  result: RoutineRequestResponse;
  onClose: () => void;
  onConnect: () => void;
}) {
  const { state, assigned, offer_connection } = result;

  const heading =
    state === 'assigned' ? '이 루틴 하나부터 시작해볼까요?'
    : state === 'cooldown' ? '방금 대처 루틴을 받으셨어요'
    : '잠시 호흡을 골라볼까요';

  const body =
    state === 'assigned' ? null
    : state === 'cooldown' ? '잠시 후 다시 찾아주세요. 지금은 방금 받은 루틴에 조금만 머물러볼까요?'
    : '들이마시고... 잠깐 멈추고... 천천히 내쉬어보세요. 그것만으로도 충분해요.';

  return (
    <>
      <Text style={s.title}>{heading}</Text>

      {state === 'assigned' && assigned && (
        <View style={s.routineCard}>
          <Text style={s.routineTitle}>{assigned.title}</Text>
          <Text style={s.routineDesc}>{assigned.description}</Text>
        </View>
      )}

      {body && <Text style={s.resultBody}>{body}</Text>}

      {offer_connection && (
        <View style={s.connectHint}>
          <Text style={s.connectHintText}>필요하다면 사람과 이야기 나눠보는 것도 좋아요.</Text>
          <Pressable style={s.connectBtn} onPress={onConnect}>
            <Text style={s.connectBtnText}>사람과 이야기하기</Text>
          </Pressable>
        </View>
      )}

      <PrimaryButton onPress={onClose} style={{ marginTop: 20 }}>확인</PrimaryButton>
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26,27,33,0.45)' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 24,
    paddingTop: 12,
    ...shadow.cardLg,
  },
  grabber: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: palette.borderStrong,
    marginBottom: 16,
  },
  title: { ...typography.h3, color: palette.textHeading },
  subtitle: { ...typography.body, color: palette.textCaption, marginTop: 4, marginBottom: 20 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: palette.borderSubtle,
    backgroundColor: palette.primaryBgWash,
    padding: 16,
    marginBottom: 12,
  },
  optionCardAlt: { backgroundColor: palette.bgAlt },
  optionCardPressed: { opacity: 0.85 },
  optionTitle: { ...typography.bodyBold, color: palette.textHeading },
  optionDesc: { ...typography.caption, color: palette.textCaption, marginTop: 4 },
  closeLink: { alignSelf: 'center', marginTop: 4, marginBottom: 4, padding: 8 },
  closeLinkText: { ...typography.body, color: palette.textMuted },
  routineCard: {
    marginTop: 16,
    borderRadius: radius.lg,
    backgroundColor: palette.primaryBgWash,
    padding: 16,
  },
  routineTitle: { ...typography.bodyBold, color: palette.textHeading },
  routineDesc: { ...typography.body, color: palette.textBody, marginTop: 6 },
  resultBody: { ...typography.body, color: palette.textBody, marginTop: 16, lineHeight: 22 },
  connectHint: {
    marginTop: 16,
    borderRadius: radius.lg,
    backgroundColor: palette.bgAlt,
    padding: 14,
  },
  connectHintText: { ...typography.caption, color: palette.textCaption, marginBottom: 10 },
  connectBtn: {
    height: 44, borderRadius: radius.pill,
    borderWidth: 1, borderColor: palette.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  connectBtnText: { ...typography.bodyBold, color: palette.primary },
});
