import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily, radius } from '@/theme/tokens';
import { PrimaryButton, Card } from '@/components/atoms';
import { TopBar } from '@/components/BackHeader';
import { useAuth } from '@/store/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const [nickname, setNick] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [agree, setAgree] = useState({ tos: false, privacy: false, marketing: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const signup = useAuth((s) => s.signup);
  const currentUser = useAuth((s) => s.user);

  const allChecked = agree.tos && agree.privacy && agree.marketing;
  const toggleAll = () => { const v = !allChecked; setAgree({ tos: v, privacy: v, marketing: v }); };

  const submit = async () => {
    setError(null);
    if (!nickname.trim()) return setError('닉네임은 필수입니다');
    if (!email.includes('@')) return setError('올바른 이메일을 입력해주세요');
    if (pw.length < 8) return setError('비밀번호는 8자 이상이어야 합니다');
    if (pw !== pw2) return setError('비밀번호가 일치하지 않습니다');
    if (!agree.tos || !agree.privacy) return setError('필수 약관에 동의해주세요');
    setLoading(true);
    try {
      // Navigation.tsx의 navKey 계산과 동일한 로직으로 가입 전 navKey를 미리 구해둔다.
      const prevNavKey = !currentUser ? 'auth' : currentUser.requires_assessment ? 'assessment' : 'main';
      const newUser = await signup({ email, password: pw, nickname });
      const nextNavKey = newUser.requires_assessment ? 'assessment' : 'main';
      // navKey가 바뀌는 경우는 Navigation.tsx가 Stack.Navigator를 remount해 자동 전환된다.
      // navKey가 그대로인 경우(예: 익명 assessment 사용자가 새로 가입해도 여전히 requires_assessment=true)엔
      // remount가 없으므로 여기서 명시적으로 이동해야 화면 전환이 이뤄진다.
      if (prevNavKey === nextNavKey && navigation.isFocused()) {
        navigation.reset({
          index: 0,
          routes: [{ name: nextNavKey === 'assessment' ? 'Assessment' : 'Main' }],
        });
      }
    } catch {
      setError('회원가입에 실패했습니다. 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}/>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Bridge 시작하기</Text>
        <Text style={s.sub}>평온한 내일을 위한 첫 걸음을{'\n'}브릿지와 함께 시작해보세요.</Text>

        <View style={s.fields}>
          <SInput label="닉네임" placeholder="어떻게 불러드릴까요?" value={nickname} onChangeText={setNick}/>
          <SInput label="이메일" placeholder="example@bridge.com" value={email} onChangeText={setEmail} keyboardType="email-address"/>
          <SInput label="비밀번호" placeholder="8자 이상 입력해주세요" value={pw} onChangeText={setPw} secureTextEntry/>
          {pw.length > 0 && <PasswordChecklist pw={pw}/>}
          <SInput label="비밀번호 확인" placeholder="다시 한번 입력해주세요" value={pw2} onChangeText={setPw2} secureTextEntry/>
          {pw2.length > 0 && pw !== pw2 && (
            <Text style={s.mismatch}>비밀번호가 일치하지 않아요.</Text>
          )}
        </View>

        <Card style={{ marginTop: 18, backgroundColor: palette.bgAlt, ...noShadow }}>
          <CheckRow checked={allChecked} onPress={toggleAll} label="모두 동의합니다" bold/>
          <View style={s.div}/>
          <CheckRow
            checked={agree.tos}
            onPress={() => setAgree(a => ({ ...a, tos: !a.tos }))}
            onArrowPress={() => navigation.navigate('Legal', { kind: 'tos' })}
            label="이용약관 동의 (필수)" arrow
          />
          <CheckRow
            checked={agree.privacy}
            onPress={() => setAgree(a => ({ ...a, privacy: !a.privacy }))}
            onArrowPress={() => navigation.navigate('Legal', { kind: 'privacy' })}
            label="개인정보 처리방침 동의 (필수)" arrow
          />
          <CheckRow
            checked={agree.marketing}
            onPress={() => setAgree(a => ({ ...a, marketing: !a.marketing }))}
            onArrowPress={() => navigation.navigate('Legal', { kind: 'marketing' })}
            label="마케팅 정보 수신 동의 (선택)" arrow
          />
        </Card>

        {error && <Text style={s.error}>{error}</Text>}

        <View style={{ marginTop: 24 }}>
          <PrimaryButton onPress={submit} disabled={loading}>
            {loading ? '가입 중...' : '회원가입'}
          </PrimaryButton>
        </View>
        <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 13, color: palette.textCaption, lineHeight: 18 }}>이미 계정이 있으신가요?</Text>
          <Pressable onPress={() => navigation.replace('Login')}>
            <Text style={{ fontSize: 13, color: palette.primary, fontWeight: '600', lineHeight: 18 }}>로그인</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SInput({ label, placeholder, value, onChangeText, secureTextEntry, keyboardType }: any) {
  const [show, setShow] = useState(false);
  const isPw = !!secureTextEntry;
  return (
    <View>
      <Text style={s.inputLabel}>{label}</Text>
      <View style={s.inputRow}>
        <TextInput
          placeholder={placeholder} placeholderTextColor={palette.textMuted}
          value={value} onChangeText={onChangeText}
          secureTextEntry={isPw && !show}
          keyboardType={keyboardType} autoCapitalize="none"
          style={s.inputText}
        />
        {isPw && (
          <Pressable onPress={() => setShow(v => !v)} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke={palette.textMuted} strokeWidth={1.5}>
              <Path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/>
              <Path d="M9 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
            </Svg>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// 비밀번호 보안 강도 실시간 안내. 백엔드 정책(8자 이상 필수) + 권장 조건 2개.
function PasswordChecklist({ pw }: { pw: string }) {
  const checks = [
    { ok: pw.length >= 8,                                  label: '8자 이상' },
    { ok: /[a-zA-Z]/.test(pw) && /\d/.test(pw),           label: '영문 + 숫자 포함' },
    { ok: /[^a-zA-Z0-9]/.test(pw),                         label: '특수문자 포함 (권장)' },
  ];
  return (
    <View style={s.pwCheckCard}>
      {checks.map((c, i) => (
        <View key={i} style={s.pwCheckRow}>
          <View style={[s.pwCheckDot, { backgroundColor: c.ok ? palette.success : palette.borderStrong }]}>
            {c.ok && (
              <Svg width={8} height={8} viewBox="0 0 12 12" fill="none">
                <Path d="M2.5 6L5 8.5L9.5 4" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            )}
          </View>
          <Text style={[s.pwCheckLabel, { color: c.ok ? palette.success : palette.textCaption }]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

function CheckRow({ checked, onPress, onArrowPress, label, bold, arrow }: any) {
  return (
    <Pressable onPress={onPress} style={s.checkRow}>
      <View style={[s.checkbox, { backgroundColor: checked ? palette.primary : '#fff', borderColor: checked ? palette.primary : palette.borderStrong }]}>
        {checked && (
          <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <Path d="M2.5 6L5 8.5L9.5 4" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        )}
      </View>
      <Text style={[s.checkLabel, bold && { fontWeight: '700' }]}>{label}</Text>
      {arrow && (
        <Pressable onPress={onArrowPress} hitSlop={8} style={{ paddingLeft: 4 }}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={palette.textMuted} strokeWidth={1.5}>
            <Path d="M5 3l4 4-4 4"/>
          </Svg>
        </Pressable>
      )}
    </Pressable>
  );
}

const noShadow = { shadowOpacity: 0, elevation: 0 };
const s = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 },
  title: { fontSize: 26, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5 },
  sub: { marginTop: 8, fontSize: 14, color: palette.textCaption, lineHeight: 22 },
  fields: { marginTop: 28, gap: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: palette.textBody, marginBottom: 6 },
  inputRow: {
    height: 48, borderRadius: 12, backgroundColor: palette.surface,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  inputText: { flex: 1, fontSize: 14, color: palette.textHeading },
  div: { height: 1, backgroundColor: palette.divider, marginVertical: 12 },
  error: { marginTop: 12, fontSize: 12, color: palette.danger },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: palette.textHeading },
  pwCheckCard: { marginTop: -4, paddingHorizontal: 4, gap: 4 },
  pwCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pwCheckDot: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  pwCheckLabel: { fontSize: 12, fontWeight: '500' },
  mismatch: { marginTop: -8, paddingHorizontal: 4, fontSize: 12, color: palette.danger, fontWeight: '500' },
});
