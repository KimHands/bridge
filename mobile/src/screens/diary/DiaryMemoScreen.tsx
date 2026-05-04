import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, moodMeta } from '@/theme/tokens';
import { Card, Pill } from '@/components/atoms';
import { TopBar } from '@/components/BackHeader';
import StepProgress from '@/components/StepProgress';
import BottomCTA from '@/components/BottomCTA';
import { useDiaryDraft } from '@/store/diaryDraft';
import { MOOD_TO_SCORE, getApiError } from '@/lib/api';
import { diary as diaryApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import type { MoodKey } from '@/lib/api';
import type { MoodScore } from '@/types/diary';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DiaryMemoScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const { mood, keywords, detailAnswer, memo, title, set, reset } = useDiaryDraft();
  const [saving, setSaving] = React.useState(false);
  const moodInfo = mood ? moodMeta[mood] : null;

  const save = async () => {
    setSaving(true);
    try {
      const moodKey = (mood ?? 'normal') as MoodKey;
      const rawScore = MOOD_TO_SCORE[moodKey] ?? 3;
      // MOOD_TO_SCORE는 1~5 범위를 보장하므로 MoodScore로 narrowing
      const mood_score = rawScore as MoodScore;
      // 도메인 정의: emotion_keywords는 mood와 독립. 사용자가 DiaryKeyword에서 선택한 값 그대로 사용.
      const emotion_keywords = keywords;
      // 도메인 정의: detailAnswer는 첫 번째 emotion_keyword에 대한 situation answer로 매핑
      const trimmedAnswer = detailAnswer.trim();
      const situation_keywords = trimmedAnswer && emotion_keywords.length > 0
        ? [{ emotion_keyword: emotion_keywords[0], answer: trimmedAnswer }]
        : undefined;
      // memo: 사용자가 추가로 작성한 메모만 (detailAnswer는 situation_keywords로 분리됨)
      const memoText = memo.trim() || undefined;

      const result = await diaryApi.create({
        mood_score,
        emotion_keywords,
        situation_keywords,
        memo: memoText,
      });

      qc.invalidateQueries({ queryKey: ['diary'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      reset();

      navigation.replace('DiaryDetail', { entryId: String(result.diary_id) });
    } catch (e) {
      const apiErr = getApiError(e);

      // 백엔드 정책: 하루 1개 일기 (uq_diary_user_date UNIQUE)
      if (apiErr.code === 'DIARY_ALREADY_EXISTS_TODAY') {
        Alert.alert(
          '오늘 일기는 이미 작성하셨어요',
          '기존 일기를 확인하시겠어요?',
          [
            { text: '취소', style: 'cancel' },
            {
              text: '확인',
              onPress: async () => {
                try {
                  const status = await diaryApi.todayStatus();
                  if (status.diary_id && navigation.isFocused()) {
                    reset();
                    navigation.replace('DiaryDetail', { entryId: status.diary_id });
                  }
                } catch (err) {
                  if (navigation.isFocused()) {
                    Alert.alert('오류', getApiError(err).message);
                  }
                }
              },
            },
          ],
        );
        return;
      }

      // 그 외 에러: 안내만 띄우고 화면 유지 (사용자가 다시 시도 가능)
      Alert.alert('저장 실패', apiErr.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar
        onBack={() => navigation.goBack()}
        title="자유 메모"
        trailing={<Text style={s.step}>4/4</Text>}
      />
      <StepProgress step={4} total={4}/>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.heading}>오늘을 한 마디로 남긴다면?</Text>
        <Text style={s.sub}>나중에 일기를 찾을 때 도움이 돼요.</Text>

        <TextInput
          placeholder="제목 (선택)"
          placeholderTextColor={palette.textMuted}
          value={title}
          onChangeText={v => set({ title: v })}
          style={s.titleInput}
        />
        <TextInput
          placeholder="자유롭게 메모를 남겨보세요 (선택, 최대 200자)"
          placeholderTextColor={palette.textMuted}
          value={memo}
          onChangeText={v => set({ memo: v })}
          multiline maxLength={200}
          style={s.textarea}
          textAlignVertical="top"
        />

        {/* Summary */}
        <Card style={{ marginTop: 20, backgroundColor: palette.bgAlt, shadowOpacity: 0, elevation: 0 }}>
          <Text style={s.summaryLabel}>오늘의 기록 요약</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {moodInfo && <Pill color={moodInfo.color} bg={moodInfo.color + '1A'}>{moodInfo.label}</Pill>}
            <Text style={{ fontSize: 11, color: palette.textCaption }}>· 키워드 {keywords.length}개</Text>
          </View>
          {keywords.length > 0 && (
            <View style={s.kw}>
              {keywords.map((k, i) => (
                <Text key={i} style={s.kwTag}>#{k}</Text>
              ))}
            </View>
          )}
          {detailAnswer.trim().length > 0 && (
            <Text style={s.detailAnswer} numberOfLines={3}>{detailAnswer}</Text>
          )}
        </Card>
        <View style={{ height: 100 }}/>
      </ScrollView>

      <BottomCTA>
        <Pressable onPress={save} disabled={saving} style={[s.btn, saving && s.btnDisabled]}>
          <Text style={s.btnText}>{saving ? '저장 중...' : '저장하기'}</Text>
        </Pressable>
      </BottomCTA>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  step: { fontSize: 12, color: palette.textCaption },
  scroll: { padding: 24 },
  heading: { fontSize: 22, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5 },
  sub: { marginTop: 8, fontSize: 13, color: palette.textCaption },
  titleInput: {
    marginTop: 20, height: 52, paddingHorizontal: 18,
    backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border,
    borderRadius: 14, fontSize: 15, color: palette.textHeading,
  },
  textarea: {
    marginTop: 12, padding: 14, minHeight: 120,
    backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border,
    borderRadius: 14, fontSize: 14, color: palette.textHeading, lineHeight: 24,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: palette.textCaption, marginBottom: 10 },
  kw: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kwTag: { fontSize: 11, color: palette.primary, fontWeight: '600' },
  detailAnswer: { marginTop: 12, fontSize: 12, color: palette.textBody, lineHeight: 18 },
  btn: { height: 56, borderRadius: 24, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { backgroundColor: palette.borderStrong },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
