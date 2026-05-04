import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, moodMeta } from '@/theme/tokens';
import { TopBar } from '@/components/BackHeader';
import StepProgress from '@/components/StepProgress';
import BottomCTA from '@/components/BottomCTA';
import { useDiaryDraft } from '@/store/diaryDraft';
import type { MoodId } from '@/theme/tokens';
import { MoodIcon } from '@/lib/moodIcon';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// 5단계 mood_score 척도 (매우 나쁨 1 ~ 매우 좋음 5)
const MOOD_IDS: MoodId[] = ['verybad', 'bad', 'normal', 'good', 'verygood'];

export default function DiaryMoodScreen() {
  const navigation = useNavigation<Nav>();
  const { mood, set } = useDiaryDraft();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar
        onBack={() => navigation.goBack()}
        title="오늘의 감정"
        trailing={<Text style={s.step}>1/4</Text>}
      />
      <StepProgress step={1} total={4}/>

      <View style={s.content}>
        <Text style={s.heading}>오늘 기분이{'\n'}어떠셨나요?</Text>
        <Text style={s.sub}>가장 가까운 감정 하나를 선택해주세요.</Text>

        <View style={s.grid}>
          {MOOD_IDS.map(id => {
            const meta = moodMeta[id];
            const sel = mood === id;
            return (
              <Pressable
                key={id}
                onPress={() => set({ mood: id })}
                style={[s.moodCard, { backgroundColor: sel ? meta.bg : '#fff', borderColor: sel ? meta.color : 'transparent' }]}
              >
                <MoodIcon id={id} size={48} color={sel ? meta.color : palette.textCaption} />
                <Text style={[s.moodLabel, { color: sel ? meta.color : palette.textHeading }]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <BottomCTA>
        <Pressable
          onPress={() => navigation.navigate('DiaryKeyword')}
          disabled={!mood}
          style={[s.btn, !mood && s.btnDisabled]}
        >
          <Text style={[s.btnText, !mood && s.btnTextDisabled]}>다음</Text>
        </Pressable>
      </BottomCTA>
    </View>
  );
}

const s = StyleSheet.create({
  step: { fontSize: 12, color: palette.textCaption },
  content: { padding: 24 },
  heading: { fontSize: 26, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5, lineHeight: 36 },
  sub: { marginTop: 10, fontSize: 14, color: palette.textCaption, lineHeight: 22 },
  grid: { marginTop: 28, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  moodCard: {
    width: '47%', borderRadius: 18, paddingVertical: 20,
    alignItems: 'center', gap: 8, borderWidth: 2,
    shadowColor: palette.primary, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  moodLabel: { fontSize: 14, fontWeight: '700' },
  btn: {
    height: 56, borderRadius: 24, backgroundColor: palette.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: palette.borderStrong },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  btnTextDisabled: { color: palette.textMuted },
});
