export type NotificationType =
  | 'routine_reminder'
  | 'diary_nudge'
  | 'trigger'
  | 'weekly_mission'
  | 'assessment_reminder';

export interface NotificationPayload {
  type: NotificationType;
  routine_id?: string;
}

export interface PushTokenRegisterRequest {
  expo_token: string;
  platform: 'ios' | 'android';
  device_name?: string;
}

export interface NotificationSettings {
  push_enabled: boolean;
  routine_reminder_time: string; // "HH:MM:SS"
}

export interface NotificationSettingsUpdateRequest {
  push_enabled?: boolean;
  routine_reminder_time?: string;
}
