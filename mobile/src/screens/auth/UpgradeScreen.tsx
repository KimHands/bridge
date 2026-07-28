// 계정 만들기(기록 지키기) — 익명 계정을 이메일·비밀번호 계정으로 승격.
// 같은 user_id를 그대로 사용하므로 지금까지의 일기·루틴·자가평가 기록은 그대로 보존된다.
import React, { useState } from 'react';
import {
  View, Text, Pressable, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily } from '@/theme/tokens';
import { PrimaryButton, Card } from '@/components/atoms';
import { TopBar } from '@/components/BackHeader';
import { useAuth } from '@/store/auth';
import { auth, getApiError } from '@/lib/api';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Step = 'form' | 'verify' | 'done';

export default function UpgradeScreen() {
  const navigation = useNavigation<Nav>();
  const markUpgraded = useAuth((s) => s.markUpgraded);

  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const safeBack = () => { if (navigation.canGoBack()) navigation.goBack(); };

  const submitUpgrade = async () => {
    setError(null);
    if (!email.includes('@')) return setError('올바른 이메일을 입력해주세요');
    if (pw.length < 8) return setError('비밀번호는 8자 이상이어야 합니다');
    if (pw !== pw2) return setError('비밀번호가 일치하지 않습니다');
    setLoading(true);
    try {
      await auth.upgrade(email, pw);
      setStep('verify');
    } catch (e) {
      setError(getApiError(e).message);
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async () => {
    setError(null);
    if (!code.trim()) return setError('인증 코드를 입력해주세요');
    setLoading(true);
    try {
      await auth.verifyEmail(code.trim());
      await markUpgraded();
      setStep('done');
    } catch (e) {
      setError(getApiError(e).message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResendMsg(null);
    setResending(true);
    try {
      await auth.resendVerification();
      setResendMsg('인증 코드를 다시 보냈어요.');
    } catch (e) {
      setResendMsg(getApiError(e).message);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar onBack={navigation.canGoBack() ? safeBack : undefined} title="계정 만들기"/>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {step === 'form' && (
          <>
            <Text style={s.title}>기록을 지켜요</Text>
            <Text style={s.sub}>이메일과 비밀번호를 등록하면{'\n'}지금까지 쌓아온 기록을 안전하게 이어갈 수 있어요.</Text>

            <View style={s.fields}>
              <Field label="이메일" placeholder="example@bridge.com" value={email} onChangeText={setEmail} keyboardType="email-address"/>
              <Field label="비밀번호" placeholder="8자 이상 입력해주세요" value={pw} onChangeText={setPw} secureTextEntry/>
              <Field label="비밀번호 확인" placeholder="다시 한번 입력해주세요" value={pw2} onChangeText={setPw2} secureTextEntry/>
            </View>

            {error && <Text style={s.error}>{error}</Text>}

            <View style={{ marginTop: 24 }}>
              <PrimaryButton onPress={submitUpgrade} disabled={loading}>
                {loading ? '처리 중...' : '계정 만들기'}
              </PrimaryButton>
            </View>
          </>
        )}

        {step === 'verify' && (
          <>
            <Text style={s.title}>이메일을 확인해주세요</Text>
            <Text style={s.sub}>{email}로 보낸{'\n'}인증 코드를 입력해주세요.</Text>

            <View style={s.fields}>
              <Field label="인증 코드" placeholder="코드 입력" value={code} onChangeText={setCode} keyboardType="number-pad"/>
            </View>

            {error && <Text style={s.error}>{error}</Text>}
            {resendMsg && <Text style={s.hint}>{resendMsg}</Text>}

            <View style={{ marginTop: 24 }}>
              <PrimaryButton onPress={submitVerify} disabled={loading}>
                {loading ? '확인 중...' : '인증하기'}
              </PrimaryButton>
            </View>
            <Pressable onPress={resend} disabled={resending} style={s.resendBtn}>
              {resending
                ? <ActivityIndicator size="small" color={palette.primary}/>
                : <Text style={s.resendText}>인증 코드 다시 보내기</Text>}
            </Pressable>
          </>
        )}

        {step === 'done' && (
          <Card style={{ marginTop: 40, alignItems: 'center', paddingVertical: 32 }}>
            <Text style={s.doneTitle}>계정이 만들어졌어요</Text>
            <Text style={s.doneSub}>이제 이 이메일로 언제든 다시 로그인할 수 있어요.{'\n'}지금까지의 기록은 그대로 남아있어요.</Text>
            <View style={{ marginTop: 24, alignSelf: 'stretch' }}>
              <PrimaryButton onPress={safeBack}>마이페이지로 돌아가기</PrimaryButton>
            </View>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, placeholder, value, onChangeText, secureTextEntry, keyboardType }: {
  label: string; placeholder: string; value: string; onChangeText: (v: string) => void;
  secureTextEntry?: boolean; keyboardType?: 'default' | 'email-address' | 'number-pad';
}) {
  return (
    <View>
      <Text style={s.inputLabel}>{label}</Text>
      <TextInput
        placeholder={placeholder} placeholderTextColor={palette.textMuted}
        value={value} onChangeText={onChangeText}
        secureTextEntry={secureTextEntry} keyboardType={keyboardType}
        autoCapitalize="none"
        style={s.input}
      />
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5 },
  sub: { marginTop: 8, fontSize: 14, color: palette.textCaption, lineHeight: 22 },
  fields: { marginTop: 24, gap: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: palette.textBody, marginBottom: 6 },
  input: {
    height: 48, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    fontSize: 14, color: palette.textHeading,
  },
  error: { marginTop: 12, fontSize: 12, color: palette.danger },
  hint: { marginTop: 12, fontSize: 12, color: palette.textCaption },
  resendBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: 13, fontWeight: '600', color: palette.primary },
  doneTitle: { fontSize: 18, fontWeight: '800', color: palette.textHeading },
  doneSub: { marginTop: 10, fontSize: 13, color: palette.textCaption, lineHeight: 20, textAlign: 'center' },
});
