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
import type { NotificationPayload } from '@/types/notification';

export function usePushNotifications(
  onNotificationResponse?: (payload: NotificationPayload) => void
) {
  // auth store: user: User | null — Boolean(s.user) === true when logged in
  const isAuthed = useAuth(s => Boolean(s.user));

  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthed) return;
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
      const payload = response.notification.request.content.data as unknown as NotificationPayload;
      if (payload?.type) onNotificationResponse(payload);
    });

    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const payload = response.notification.request.content.data as unknown as NotificationPayload;
      if (payload?.type) onNotificationResponse(payload);
    });

    return () => responseSub.remove();
  }, [onNotificationResponse]);
}
