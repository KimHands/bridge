import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily } from '@/theme/tokens';
import { TopBar } from '@/components/BackHeader';
import { useAuth } from '@/store/auth';
import { me } from '@/lib/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileEditScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await me.update({ nickname });
      useAuth.setState(s => ({ user: s.user ? { ...s.user, nickname: updated.nickname ?? nickname } : null }));
      navigation.goBack();
    } catch {
      setSaving(false);
    }
  };

  const initial = (nickname[0] ?? 'B').toUpperCase();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar
        onBack={() => navigation.goBack()}
        title="프로필 편집"
        trailing={
          <Pressable onPress={save} disabled={saving}>
            <Text style={[s.saveBtn, saving && { opacity: 0.5 }]}>저장</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.avatarSection}>
          <LinearGradient colors={[palette.primary, palette.primarySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </LinearGradient>
          <Pressable style={s.changePhoto}>
            <Text style={s.changePhotoText}>사진 변경</Text>
          </Pressable>
        </View>

        <View style={s.fields}>
          <View>
            <Text style={s.label}>닉네임</Text>
            <TextInput
              value={nickname} onChangeText={setNickname}
              placeholder="닉네임을 입력하세요"
              placeholderTextColor={palette.textMuted}
              style={s.input}
            />
          </View>
          <View>
            <Text style={s.label}>이메일</Text>
            <View style={s.readonlyInput}>
              <Text style={s.readonlyText}>{user?.email ?? ''}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 24 },
  saveBtn: { fontSize: 14, fontWeight: '700', color: palette.primary },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatar: { width: 96, height: 96, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '800', fontFamily: fontFamily.display },
  changePhoto: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 9999, backgroundColor: palette.primaryBgSoft },
  changePhotoText: { fontSize: 12, fontWeight: '700', color: palette.primary },
  fields: { gap: 14 },
  label: { fontSize: 13, fontWeight: '600', color: palette.textBody, marginBottom: 6 },
  input: {
    height: 48, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border,
    fontSize: 14, color: palette.textHeading,
  },
  readonlyInput: {
    height: 48, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: palette.bgAlt, justifyContent: 'center',
  },
  readonlyText: { fontSize: 14, color: palette.textCaption },
});
