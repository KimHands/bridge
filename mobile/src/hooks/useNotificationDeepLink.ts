// 푸시 알림 payload.type → React Navigation 화면 이동.
import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NotificationPayload } from '@/types/notification';
import type { RootStackParamList } from '@/navigation/Navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function useNotificationDeepLink() {
  const navigation = useNavigation<Nav>();

  return useCallback(
    (payload: NotificationPayload) => {
      switch (payload.type) {
        case 'routine_reminder':
        case 'trigger':
          navigation.navigate('Main');
          break;
        case 'diary_nudge':
          navigation.navigate('DiaryMood');
          break;
        case 'weekly_mission':
          navigation.navigate('Main');
          break;
        case 'assessment_reminder':
          navigation.navigate('Assessment', undefined);
          break;
      }
    },
    [navigation]
  );
}
