import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily, radius, spacing } from '@/theme/tokens';
import { PrimaryButton } from '@/components/atoms';
import { TopBar, DecorativeBlobs } from '@/components/BackHeader';
import { useAuth } from '@/store/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAuth((s) => s.login);
  const currentUser = useAuth((s) => s.user);

  const submit = async () => {
    setError(null);
    if (!email.includes('@')) { setError('올바른 이메일을 입력해주세요'); return; }
    if (pw.length < 8) { setError('비밀번호는 8자 이상이어야 합니다'); return; }
    setLoading(true);
    try {
      // Navigation.tsx의 navKey 계산과 동일한 로직으로 로그인 전 navKey를 미리 구해둔다.
      const prevNavKey = !currentUser ? 'auth' : currentUser.requires_assessment ? 'assessment' : 'main';
      const loggedInUser = await login(email, pw);
      const nextNavKey = loggedInUser.requires_assessment ? 'assessment' : 'main';
      // navKey가 바뀌는 경우(auth→main 등)는 Navigation.tsx가 Stack.Navigator를 remount해 자동 전환된다.
      // navKey가 그대로인 경우(예: 익명 main 사용자가 requires_assessment=false 기존 계정으로 로그인)엔
      // remount가 없으므로 여기서 명시적으로 이동해야 화면 전환이 이뤄진다.
      if (prevNavKey === nextNavKey && navigation.isFocused()) {
        navigation.reset({
          index: 0,
          routes: [{ name: nextNavKey === 'assessment' ? 'Assessment' : 'Main' }],
        });
      }
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DecorativeBlobs/>
      <TopBar onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} transparent/>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.iconBox}>
          <Svg width={32} height={32} viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M16 4l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>
          </Svg>
        </View>
        <Text style={s.title}>다시 만나서 반가워요</Text>
        <Text style={s.sub}>당신의 마음을 잇는 가장 편안한 다리, 브릿지 입니다.</Text>

        <View style={s.fields}>
          <Field label="이메일" placeholder="이메일을 입력하세요"
                 value={email} onChangeText={setEmail} keyboardType="email-address"
                 icon={<Svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={palette.textMuted} strokeWidth={1.5}><Rect x={2} y={3} width={12} height={10} rx={1.5}/><Path d="M2 4l6 5 6-5"/></Svg>}/>
          <Field label="비밀번호" placeholder="비밀번호를 입력하세요"
                 value={pw} onChangeText={setPw} secureTextEntry={!showPw}
                 icon={<Svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={palette.textMuted} strokeWidth={1.5}><Rect x={3} y={7} width={10} height={7} rx={1.5}/><Path d="M5 7V5a3 3 0 0 1 6 0v2"/></Svg>}
                 rightSlot={
                   <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                     <Svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke={palette.textMuted} strokeWidth={1.5}><Path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><Circle cx={9} cy={9} r={2}/></Svg>
                   </Pressable>
                 }/>
        </View>

        {error && <Text style={s.error}>{error}</Text>}

        <View style={{ marginTop: 28 }}>
          <PrimaryButton onPress={submit} disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </PrimaryButton>
        </View>

        <Pressable style={s.forgotWrap}>
          <Text style={{ color: palette.textBody, fontSize: 14 }}>비밀번호 찾기</Text>
        </Pressable>

        <View style={s.divRow}>
          <View style={s.divLine}/>
          <Text style={{ fontSize: 12, color: palette.textMuted, fontFamily: fontFamily.en }}>또는</Text>
          <View style={s.divLine}/>
        </View>

        <View style={{ marginTop: 28, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: palette.textBody }}>계정이 없으신가요?</Text>
          <Pressable onPress={() => navigation.replace('Signup')} style={s.signupBtn}>
            <Text style={{ color: palette.primary, fontSize: 14, fontWeight: '600' }}>회원가입</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, placeholder, value, onChangeText, secureTextEntry, keyboardType, icon, rightSlot }: any) {
  return (
    <View style={{ gap: 8 }}>
      {label && <Text style={{ fontSize: 13, fontWeight: '600', color: palette.primary, fontFamily: fontFamily.enBold }}>{label}</Text>}
      <View style={s.fieldRow}>
        {icon}
        <TextInput
          placeholder={placeholder} placeholderTextColor={palette.textMuted}
          value={value} onChangeText={onChangeText}
          secureTextEntry={secureTextEntry} keyboardType={keyboardType}
          autoCapitalize="none"
          style={s.input}
        />
        {rightSlot}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8, zIndex: 2 },
  iconBox: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: palette.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  title: { marginTop: 24, fontSize: 28, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5 },
  sub: { marginTop: 12, fontSize: 14, color: palette.textCaption, lineHeight: 22 },
  fields: { marginTop: 32, gap: 16 },
  fieldRow: {
    height: 52, backgroundColor: palette.primaryBgWash, borderRadius: radius.md,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
  },
  input: { flex: 1, fontSize: 14, color: palette.textHeading },
  error: { marginTop: 12, fontSize: 12, color: palette.danger },
  forgotWrap: { marginTop: 20, alignItems: 'center' },
  divRow: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divLine: { flex: 1, height: 1, backgroundColor: palette.divider },
  signupBtn: {
    marginTop: 10, paddingHorizontal: 28, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: palette.primary,
  },
});
