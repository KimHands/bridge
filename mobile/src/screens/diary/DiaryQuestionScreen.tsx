import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily } from '@/theme/tokens';
import { Screen, Card } from '@/components/atoms';
import { TopBar } from '@/components/BackHeader';
import StepProgress from '@/components/StepProgress';
import BottomCTA from '@/components/BottomCTA';
import { useDiaryDraft } from '@/store/diaryDraft';
import { useEmotionKeywords } from '@/hooks/useDiaryQueries';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FALLBACK_QUESTION = '오늘 어떤 일이 있었나요? 자유롭게 적어보세요.';

export default function DiaryQuestionScreen() {
  const navigation = useNavigation<Nav>();
  const { keywords, detailAnswer, set } = useDiaryDraft();
  const { data } = useEmotionKeywords();

  // 도메인 정의: 사용자가 선택한 첫 번째 emotion_keyword의 question/answers 사용
  const firstKeyword = keywords[0];
  const meta = data?.keywords.find(k => k.name === firstKeyword);
  const question = meta?.question ?? FALLBACK_QUESTION;
  const answerHints: string[] = meta?.answers ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar
        onBack={() => navigation.goBack()}
        title="자세히 들여다보기"
        trailing={<Text style={s.step}>3/4</Text>}
      />
      <StepProgress step={3} total={4}/>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Card style={{ backgroundColor: palette.primary, borderRadius: 20 }}>
          <Text style={s.qLabel}>BRIDGE'S QUESTION</Text>
          <Text style={s.qText}>{question}</Text>
        </Card>

        {answerHints.length > 0 && (
          <View style={s.hintsBlock}>
            <Text style={s.hintsLabel}>예시 답변 (탭하여 선택)</Text>
            <View style={s.hintsRow}>
              {answerHints.map(hint => {
                const selected = detailAnswer === hint;
                return (
                  <Pressable
                    key={hint}
                    onPress={() => set({ detailAnswer: hint })}
                    style={[s.hintChip, selected && s.hintChipActive]}
                  >
                    <Text style={[s.hintText, selected && s.hintTextActive]}>{hint}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <TextInput
          placeholder="자유롭게 적어보세요. 짧아도, 길어도 괜찮아요."
          placeholderTextColor={palette.textMuted}
          value={detailAnswer}
          onChangeText={v => set({ detailAnswer: v })}
          multiline
          maxLength={500}
          style={s.textarea}
          textAlignVertical="top"
        />
        <Text style={s.counter}>{detailAnswer.length} / 500</Text>
        <View style={{ height: 100 }}/>
      </ScrollView>

      <BottomCTA>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => navigation.navigate('DiaryMemo')} style={[s.btn, s.btnSoft]}>
            <Text style={[s.btnText, { color: palette.primary }]}>건너뛰기</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('DiaryMemo')} style={[s.btn, { flex: 2, backgroundColor: palette.primary }]}>
            <Text style={s.btnText}>다음</Text>
          </Pressable>
        </View>
      </BottomCTA>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  step: { fontSize: 12, color: palette.textCaption },
  scroll: { padding: 24 },
  qLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)', fontFamily: fontFamily.enBold },
  qText: { marginTop: 10, fontSize: 17, fontWeight: '700', color: '#fff', lineHeight: 26 },
  textarea: {
    marginTop: 16, padding: 16, minHeight: 160,
    backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border,
    borderRadius: 16, fontSize: 14, color: palette.textHeading, lineHeight: 24,
    shadowColor: palette.primary, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  counter: { marginTop: 6, textAlign: 'right', fontSize: 11, color: palette.textMuted, fontFamily: fontFamily.en },
  hintsBlock: { marginTop: 18 },
  hintsLabel: { fontSize: 12, fontWeight: '600', color: palette.textCaption, marginBottom: 8 },
  hintsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hintChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border },
  hintChipActive: { backgroundColor: palette.primaryBgSoft, borderColor: palette.primary },
  hintText: { fontSize: 13, color: palette.textBody, lineHeight: 18 },
  hintTextActive: { color: palette.primary, fontWeight: '700' },
  btn: { flex: 1, height: 56, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  btnSoft: { backgroundColor: palette.primaryBgSoft },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
