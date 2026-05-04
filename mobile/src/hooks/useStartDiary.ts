import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { diary } from '@/lib/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * 일기 작성 진입점 공통 훅.
 * 백엔드 정책(하루 1개 일기, uq_diary_user_date)을 진입 시점에 사전 체크해
 * 사용자가 4단계까지 작성한 뒤 저장 단계에서야 차단되는 UX 비효율을 방지한다.
 *
 * - 오늘 일기 있음: Alert 안내 + 확인 시 기존 일기 DiaryDetail로 이동
 * - 오늘 일기 없음: DiaryMood 화면으로 진입
 * - todayStatus 호출 실패: 작성 화면으로 진입 (저장 시점 catch가 fallback)
 */
export function useStartDiary() {
  const navigation = useNavigation<Nav>();

  return useCallback(async () => {
    try {
      const status = await diary.todayStatus();
      if (status.has_diary_today && status.diary_id) {
        const existingId = status.diary_id;
        Alert.alert(
          '오늘 일기는 이미 작성하셨어요',
          '기존 일기를 확인하시겠어요?',
          [
            { text: '취소', style: 'cancel' },
            {
              text: '확인',
              onPress: () => navigation.navigate('DiaryDetail', { entryId: existingId }),
            },
          ],
        );
        return;
      }
      navigation.navigate('DiaryMood');
    } catch {
      navigation.navigate('DiaryMood');
    }
  }, [navigation]);
}
