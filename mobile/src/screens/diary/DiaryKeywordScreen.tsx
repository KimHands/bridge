import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette } from '@/theme/tokens';
import { TopBar } from '@/components/BackHeader';
import StepProgress from '@/components/StepProgress';
import BottomCTA from '@/components/BottomCTA';
import { useDiaryDraft } from '@/store/diaryDraft';
import { useEmotionKeywords } from '@/hooks/useDiaryQueries';
import { MOOD_TO_SCORE, type MoodKey } from '@/lib/api';
import { Lightbulb } from 'phosphor-react-native';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// 백엔드 KEYWORD_META의 8개 emotion_keyword (네트워크 실패 시 fallback)
const FALLBACK_KEYWORDS = ['우울한', '무기력한', '불안한', '초조한', '짜증나는', '외로운', '뿌듯한', '평온한'];

const MAX_KEYWORDS = 2;

export default function DiaryKeywordScreen() {
  const navigation = useNavigation<Nav>();
  const { mood, keywords, toggleKeyword } = useDiaryDraft();
  const { data } = useEmotionKeywords();

  // 도메인 정의: 항상 8개 emotion_keyword 표시
  const list: string[] = (data?.keywords ?? []).map(k => k.name);
  const allKeywords = list.length > 0 ? list : FALLBACK_KEYWORDS;

  // mood_score 기반 추천 keyword 2개 (highlights)
  const moodScore = mood ? MOOD_TO_SCORE[mood as MoodKey] : 3;
  const highlighted = data?.highlights_by_mood[String(moodScore)] ?? [];

  const handleToggle = (k: string) => {
    // 백엔드 검증: 최대 2개. 초과 시 추가 안 됨
    if (!keywords.includes(k) && keywords.length >= MAX_KEYWORDS) return;
    toggleKeyword(k);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar
        onBack={() => navigation.goBack()}
        title="키워드"
        trailing={<Text style={s.step}>2/4</Text>}
      />
      <StepProgress step={2} total={4}/>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.heading}>오늘과 가장 가까운{'\n'}키워드를 골라주세요</Text>
        <Text style={s.sub}>최대 {MAX_KEYWORDS}개까지 선택할 수 있어요. ({keywords.length}개 선택됨)</Text>

        <View style={s.chips}>
          {allKeywords.map(k => {
            const sel = keywords.includes(k);
            const isHighlight = highlighted.includes(k);
            const disabled = !sel && keywords.length >= MAX_KEYWORDS;
            return (
              <Pressable key={k} onPress={() => handleToggle(k)}
                         disabled={disabled}
                         style={[s.chip, sel && s.chipActive, !sel && isHighlight && s.chipHighlight, disabled && s.chipDisabled]}>
                <Text style={[s.chipText, sel && s.chipActiveText, !sel && isHighlight && s.chipHighlightText]}>#{k}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.tip}>
          <Lightbulb size={20} color={palette.primary} weight="duotone" />
          <Text style={s.tipText}>지금 기분에 어울리는 키워드를 추천해드려요. 자유롭게 골라보세요.</Text>
        </View>
        <View style={{ height: 100 }}/>
      </ScrollView>

      <BottomCTA>
        <Pressable
          onPress={() => navigation.navigate('DiaryQuestion')}
          disabled={keywords.length === 0}
          style={[s.btn, keywords.length === 0 && s.btnDisabled]}
        >
          <Text style={[s.btnText, keywords.length === 0 && s.btnTextDisabled]}>다음</Text>
        </Pressable>
      </BottomCTA>
    </View>
  );
}

const s = StyleSheet.create({
  step: { fontSize: 12, color: palette.textCaption },
  scroll: { padding: 24 },
  heading: { fontSize: 26, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5, lineHeight: 36 },
  sub: { marginTop: 10, fontSize: 14, color: palette.textCaption, lineHeight: 22 },
  chips: { marginTop: 28, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9999, backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border },
  chipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  // 하이라이트 = 추천 (선택 X). 배경 흰색 유지, border만 보라색으로 시각 위계 분리.
  chipHighlight: { backgroundColor: '#fff', borderColor: palette.primary },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 14, fontWeight: '600', color: palette.textBody },
  chipActiveText: { color: '#fff' },
  chipHighlightText: { color: palette.primary, fontWeight: '600' },
  tip: { marginTop: 24, padding: 14, backgroundColor: palette.primaryBgWash, borderRadius: 14, flexDirection: 'row', gap: 10 },
  tipText: { flex: 1, fontSize: 12, color: palette.textBody, lineHeight: 18 },
  btn: { height: 56, borderRadius: 24, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { backgroundColor: palette.borderStrong },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  btnTextDisabled: { color: palette.textMuted },
});
