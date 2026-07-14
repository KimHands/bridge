// 푸시 알림 payload.type → React Navigation 화면 이동.
import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NotificationPayload } from '@/types/notification';
import type { RootStackParamList } from '@/navigation/Navigation';
import { useAuth } from '@/store/auth';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function useNotificationDeepLink() {
  const navigation = useNavigation<Nav>();
  const user = useAuth(s => s.user);

  return useCallback(
    (payload: NotificationPayload) => {
      // 대상 라우트는 현재 마운트된 navigator 그룹(auth/assessment/main)에만 존재한다.
      // 활성 그룹에 없는 라우트로 navigate하면 "action not handled"로 무반응이므로,
      // auth 상태에 맞는 경우에만 이동한다(로그아웃/자가평가 대기 시 앱은 이미 알맞은 화면을 띄움 — M9).
      if (!user) return; // 로그아웃 — 앱이 로그인 화면 표시
      const inMain = !user.requires_assessment;

      switch (payload.type) {
        case 'routine_reminder':
        case 'trigger':
        case 'weekly_mission':
          if (inMain) navigation.navigate('Main');
          break;
        case 'diary_nudge':
          if (inMain) navigation.navigate('DiaryMood');
          break;
        case 'assessment_reminder':
          // 'Assessment'는 assessment/main 그룹 모두에 존재하므로 로그인 상태면 안전.
          navigation.navigate('Assessment', undefined);
          break;
      }
    },
    [navigation, user]
  );
}
