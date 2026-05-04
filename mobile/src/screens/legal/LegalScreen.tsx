import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily } from '@/theme/tokens';
import { TopBar } from '@/components/BackHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export type LegalKind = 'tos' | 'privacy' | 'marketing';

interface LegalSection {
  heading: string;
  body: string;
}

interface LegalDoc {
  title: string;
  subtitle: string;
  sections: LegalSection[];
}

// 본문은 docs/Bridge_개인정보처리방침.md를 기반으로 모바일 화면용으로 발췌·요약.
// 전문 본문은 회사 웹사이트 또는 별도 PDF 링크로 안내 권장(향후).
const LEGAL_META: Record<LegalKind, LegalDoc> = {
  tos: {
    title: '이용약관',
    subtitle: '시행일: 2026년 4월 13일 · 버전 v1.0',
    sections: [
      { heading: '제1조 (목적)', body: '본 약관은 Bridge(이하 "회사")가 제공하는 디지털 정서 웰니스 서비스의 이용 조건과 절차를 정함을 목적으로 합니다.' },
      { heading: '제2조 (서비스의 정의)', body: 'Bridge는 청년(19~34세)의 정서적 안녕을 돕는 감정 기록·루틴 형성·자기 이해 도구를 제공합니다. Bridge는 의료기기에 해당하지 않으며, 진단·치료 서비스를 제공하지 않습니다.' },
      { heading: '제3조 (회원 가입 및 계정 관리)', body: '만 14세 이상의 사용자만 가입할 수 있으며, 본인의 정확한 정보로 가입해야 합니다. 계정 정보(비밀번호 등)의 관리 책임은 회원에게 있습니다.' },
      { heading: '제4조 (서비스의 제공 및 변경)', body: '회사는 안정적인 서비스 제공을 위하여 일부 기능을 변경하거나 종료할 수 있으며, 중요한 변경사항은 사전에 공지합니다.' },
      { heading: '제5조 (회원의 의무)', body: '회원은 타인의 정보를 도용하거나 서비스 운영을 방해하는 행위, 본 서비스를 의료적 자가진단 도구로 오용하는 행위를 하여서는 안 됩니다.' },
      { heading: '제6조 (서비스 이용 제한)', body: '회원이 본 약관을 위반한 경우 회사는 사전 통지 후 서비스 이용을 제한할 수 있습니다.' },
      { heading: '제7조 (면책 조항)', body: 'Bridge는 의료적 진단·치료 서비스가 아니며, 사용자의 정신건강 관련 의사결정을 대체하지 않습니다. 전문적 도움이 필요한 경우 전문가의 진료를 받으시기 바랍니다.' },
    ],
  },
  privacy: {
    title: '개인정보 처리방침',
    subtitle: '시행일: 2026년 4월 13일 · 버전 v1.0',
    sections: [
      { heading: '1. 처리 목적', body: '회사는 회원 가입·서비스 제공·정신건강 자가평가 기반 초기 루틴 설정·서비스 개선·푸시 알림 발송·고객 문의 처리 목적으로 개인정보를 처리합니다.' },
      { heading: '2. 수집 항목', body: '· 회원 가입: 이메일, 닉네임, 비밀번호(암호화 저장)\n· 서비스 이용: 기분 점수, 감정·상황 키워드, 루틴 완료 기록\n· 별도 동의 항목: PHQ-9 자가평가 결과(민감정보), 일기 자유 메모(AES-256-GCM 암호화), 푸시 알림 토큰' },
      { heading: '3. 민감정보 처리', body: '정신건강 관련 민감정보는 별도 명시적 동의 후에만 수집되며, 회원 탈퇴 후 7일 이내 영구 파기됩니다. Bridge는 진단·치료 서비스를 제공하지 않습니다.' },
      { heading: '4. 보유 기간', body: '회원 정보는 탈퇴 시까지, 감정·일기·평가 데이터는 탈퇴 후 7일 이내 파기, 서비스 이용 로그 6개월, 고객 문의 내역 3년 보관 후 파기됩니다.' },
      { heading: '5. 안전성 확보 조치', body: 'HTTPS(TLS 1.3) 전송 암호화, bcrypt(cost 12) 비밀번호 단방향 암호화, AES-256-GCM 민감정보 암호화, 이메일 SHA-256 해시 저장으로 식별 정보 분리, JWT 기반 접근 통제 및 Redis 블랙리스트.' },
      { heading: '6. 정보주체의 권리', body: '회원은 언제든지 본인의 개인정보 열람·정정·삭제·처리 정지·동의 철회를 요구할 수 있습니다. 마이페이지 또는 privacy@bridge.app으로 요청 가능합니다.' },
      { heading: '7. 14세 미만 아동', body: 'Bridge는 만 14세 미만 아동을 서비스 대상으로 하지 않으며, 14세 미만 회원 가입을 허용하지 않습니다.' },
      { heading: '8. 개인정보 보호책임자', body: '연락처: privacy@bridge.app — 개인정보 관련 모든 문의는 이 메일로 가능하며, 접수일로부터 10일 이내 처리합니다.' },
    ],
  },
  marketing: {
    title: '마케팅 정보 수신 동의',
    subtitle: '선택 항목 · 언제든 철회 가능',
    sections: [
      { heading: '수신 목적', body: '회사는 동의한 회원에게 신규 기능 안내, 이벤트, 콘텐츠 추천 등 마케팅 정보를 발송할 수 있습니다.' },
      { heading: '발송 채널', body: '· 앱 푸시 알림 (FCM / APNs)\n· 이메일' },
      { heading: '수신 거부 안내', body: '본 동의는 선택 사항이며, 동의하지 않으셔도 회원 가입 및 핵심 서비스 이용에는 제한이 없습니다.' },
      { heading: '동의 철회', body: '마이페이지 → 알림 설정 → 마케팅 알림 토글, 또는 privacy@bridge.app 연락으로 언제든 철회 가능합니다. 철회 후에도 서비스 운영상 필수 안내(보안, 약관 변경 등)는 계속 발송됩니다.' },
    ],
  },
};

export default function LegalScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Legal'>>();
  const meta = LEGAL_META[route.params.kind];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top']}>
      <TopBar onBack={() => navigation.goBack()} title={meta.title} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.subtitle}>{meta.subtitle}</Text>
        {meta.sections.map((sec, i) => (
          <View key={i} style={s.section}>
            <Text style={s.heading}>{sec.heading}</Text>
            <Text style={s.body}>{sec.body}</Text>
          </View>
        ))}
        <Text style={s.footer}>본 안내는 모바일 화면용 요약본입니다. 전문은 회사 웹사이트 또는 docs/Bridge_개인정보처리방침.md를 참고해 주세요.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 40 },
  subtitle: { fontSize: 12, color: palette.textCaption, fontFamily: fontFamily.enBold, fontWeight: '600', marginBottom: 16 },
  section: { marginTop: 18 },
  heading: { fontSize: 14, fontWeight: '700', color: palette.textHeading, marginBottom: 8, letterSpacing: -0.2 },
  body: { fontSize: 13, color: palette.textBody, lineHeight: 22 },
  footer: { marginTop: 32, fontSize: 11, color: palette.textMuted, lineHeight: 18, textAlign: 'center' },
});
