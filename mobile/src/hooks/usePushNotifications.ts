// mobile/src/hooks/usePushNotifications.ts
// 로그인 직후 권한 요청 + 토큰 백엔드 등록 + 알림 응답 리스너 통합.
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/store/auth';
import {
  ensureAndroidChannel,
  getExpoPushToken,
  getPermissionStatus,
  getPlatform,
  requestPermission,
} from '@/lib/notifications';
import { notifications } from '@/lib/api';
import type { NotificationPayload, NotificationType } from '@/types/notification';

const VALID_NOTIFICATION_TYPES: NotificationType[] = [
  'routine_reminder',
  'diary_nudge',
  'trigger',
  'weekly_mission',
  'assessment_reminder',
];

// 푸시 payload는 외부에서 들어오므로 타입 단언 대신 런타임 검증.
function parseNotificationPayload(data: unknown): NotificationPayload | null {
  if (!data || typeof data !== 'object') return null;
  const type = (data as { type?: unknown }).type;
  if (typeof type !== 'string' || !VALID_NOTIFICATION_TYPES.includes(type as NotificationType)) {
    return null;
  }
  const routineId = (data as { routine_id?: unknown }).routine_id;
  return {
    type: type as NotificationType,
    routine_id: typeof routineId === 'string' ? routineId : undefined,
  };
}

export function usePushNotifications(
  onNotificationResponse?: (payload: NotificationPayload) => void
) {
  // auth store: user: User | null — Boolean(s.user) === true when logged in
  const isAuthed = useAuth(s => Boolean(s.user));

  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // 로그아웃 시 재등록 가드 해제. NotificationBridge는 auth 전환에도 언마운트되지
    // 않아 lastTokenRef가 유지되는데, 초기화하지 않으면 재로그인 때 동일 토큰이
    // "이미 등록됨"으로 걸러져 재등록이 누락된다(로그아웃 시 서버는 토큰을 비활성화함).
    if (!isAuthed) {
      lastTokenRef.current = null;
      return;
    }
    let cancelled = false;

    (async () => {
      await ensureAndroidChannel();

      let status = await getPermissionStatus();
      if (status === 'undetermined') {
        status = await requestPermission();
      }
      if (status !== 'granted' || cancelled) return;

      const token = await getExpoPushToken();
      if (!token || cancelled || token === lastTokenRef.current) return;

      try {
        await notifications.registerToken({
          expo_token: token,
          platform: getPlatform(),
        });
        lastTokenRef.current = token;
      } catch (e) {
        console.warn('[usePushNotifications] register failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  useEffect(() => {
    if (!onNotificationResponse) return;

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const payload = parseNotificationPayload(response.notification.request.content.data);
      if (payload) onNotificationResponse(payload);
    });

    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const payload = parseNotificationPayload(response.notification.request.content.data);
      if (payload) onNotificationResponse(payload);
    });

    return () => responseSub.remove();
  }, [onNotificationResponse]);
}
