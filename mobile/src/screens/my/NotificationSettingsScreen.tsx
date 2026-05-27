// mobile/src/screens/my/NotificationSettingsScreen.tsx
import React, { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TopBar } from '@/components/BackHeader';
import { palette } from '@/theme/tokens';
import { notifications } from '@/lib/api';
import { getPermissionStatus, requestPermission } from '@/lib/notifications';
import type { NotificationSettings } from '@/types/notification';

export default function NotificationSettingsScreen() {
  const navigation = useNavigation();
  const qc = useQueryClient();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    getPermissionStatus().then(setPermission);
  }, []);

  const { data: settings } = useQuery<NotificationSettings>({
    queryKey: ['notifications', 'settings'],
    queryFn: notifications.getSettings,
  });

  const updateMut = useMutation({
    mutationFn: notifications.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'settings'] }),
  });

  const onTogglePush = async (next: boolean) => {
    if (next && permission !== 'granted') {
      const status = await requestPermission();
      setPermission(status);
      if (status !== 'granted') {
        Alert.alert(
          '알림 권한이 필요해요',
          '설정 앱에서 알림을 허용해주세요',
          [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
    }
    updateMut.mutate({ push_enabled: next });
  };

  const onChangeTime = (_e: unknown, selected?: Date) => {
    setShowPicker(false);
    if (!selected) return;
    const hh = String(selected.getHours()).padStart(2, '0');
    const mm = String(selected.getMinutes()).padStart(2, '0');
    updateMut.mutate({ routine_reminder_time: `${hh}:${mm}:00` });
  };

  const reminderTimeDisplay = settings?.routine_reminder_time?.slice(0, 5) ?? '09:00';
  const pickerValue = (() => {
    const [hh, mm] = (settings?.routine_reminder_time ?? '09:00:00').split(':').map(Number);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d;
  })();

  return (
    <View style={styles.container}>
      <TopBar title="알림 설정" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        {permission === 'denied' && (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              알림 권한이 거부된 상태예요. 설정 앱에서 허용으로 변경해주세요.
            </Text>
            <Text style={styles.warnLink} onPress={() => Linking.openSettings()}>
              설정 열기
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.label}>푸시 알림 받기</Text>
          <Switch
            value={settings?.push_enabled ?? false}
            onValueChange={onTogglePush}
            disabled={updateMut.isPending}
          />
        </View>

        <View style={[styles.row, { opacity: settings?.push_enabled ? 1 : 0.4 }]}>
          <Text style={styles.label}>루틴 알림 시각</Text>
          <Text
            style={styles.timeValue}
            onPress={() => settings?.push_enabled && setShowPicker(true)}
          >
            {reminderTimeDisplay}
          </Text>
        </View>

        {showPicker && (
          <DateTimePicker
            value={pickerValue}
            mode="time"
            display="spinner"
            onChange={onChangeTime}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  body: { padding: 16 },
  warnCard: {
    backgroundColor: '#FFEFE9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warnText: { color: '#7A3A2B', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  warnLink: { color: palette.primary, fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSubtle,
  },
  label: { fontSize: 16, color: palette.textBody },
  timeValue: { fontSize: 16, color: palette.primary, fontWeight: '600' },
});
