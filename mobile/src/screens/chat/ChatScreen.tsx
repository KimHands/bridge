import React from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Phone } from 'phosphor-react-native';
import { TopBar } from '@/components/BackHeader';
import { palette, typography } from '@/theme/tokens';
import { useSendMessage } from '@/hooks/useChatQueries';
import type { ChatBubble } from '@/types/chat';
import { CRISIS_HOTLINES, HOSPITAL_MAP_QUERY } from '@/lib/crisis';

const NOTICE =
  'Bridge 챗봇은 정서적 교감을 위한 도구로, 전문적인 상담이나 진단을 제공하지 않아요.';

export default function ChatScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const idRef = React.useRef(0);
  const nextId = React.useCallback(() => `b${idRef.current++}`, []);
  const [bubbles, setBubbles] = React.useState<ChatBubble[]>(() => [
    { id: nextId(), role: 'system', text: NOTICE },
  ]);
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<ScrollView>(null);
  const { mutate, isPending } = useSendMessage();

  const scrollToEnd = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const handleBack = () => {
    // 프로젝트 컨벤션: goBack 전 가드 필수
    if (navigation.canGoBack()) navigation.goBack();
  };

  const send = () => {
    const text = input.trim();
    if (!text || isPending) return;
    setBubbles(prev => [...prev, { id: nextId(), role: 'user', text }]);
    setInput('');
    scrollToEnd();
    mutate(text, {
      onSuccess: (res) => {
        setBubbles(prev => [...prev, {
          id: nextId(), role: 'assistant', text: res.reply,
          isCrisis: res.is_crisis, crisisInfo: res.crisis_info,
        }]);
        scrollToEnd();
      },
      onError: () => {
        setBubbles(prev => [...prev, {
          id: nextId(), role: 'assistant',
          text: '지금 잠시 응답이 어려워요. 잠시 후 다시 시도해주세요.',
        }]);
        scrollToEnd();
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopBar title="마음 대화" onBack={handleBack} />

      <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {bubbles.map(b => (
          <View key={b.id}>
            <Bubble bubble={b} />
            {b.isCrisis && b.crisisInfo?.show_hospital_cta && (
              <View style={s.crisisBanner}>
                <Text style={s.crisisBannerTitle}>지금 바로 도움받을 수 있어요</Text>
                {CRISIS_HOTLINES.map(h => (
                  <Pressable
                    key={h.number}
                    style={s.hotlineRow}
                    onPress={() => { Linking.openURL(`tel:${h.number.replace(/-/g, '')}`).catch(() => {}); }}
                  >
                    <Phone size={18} color={palette.danger} weight="duotone" />
                    <Text style={s.hotlineLabel}>{h.label}</Text>
                    <Text style={s.hotlineNumber}>{h.number}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={s.mapRow}
                  onPress={() => { Linking.openURL(HOSPITAL_MAP_QUERY).catch(() => {}); }}
                >
                  <Text style={s.mapText}>내 주변 기관 찾아보기 →</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
        {isPending && <Text style={s.typing}>입력 중…</Text>}
      </ScrollView>

      <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={s.input}
          placeholder="마음을 편히 적어보세요"
          placeholderTextColor={palette.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[s.sendBtn, (!input.trim() || isPending) && s.sendBtnOff]}
          onPress={send}
          disabled={!input.trim() || isPending}
          accessibilityLabel="전송"
        >
          <Text style={s.sendText}>전송</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ bubble }: { bubble: ChatBubble }) {
  if (bubble.role === 'system') {
    return (
      <View style={s.noticeWrap}>
        <Text style={s.noticeText}>{bubble.text}</Text>
      </View>
    );
  }
  const isUser = bubble.role === 'user';
  return (
    <View style={[s.row, isUser ? s.rowRight : s.rowLeft]}>
      <View style={[
        s.bubble,
        isUser ? s.bubbleUser : s.bubbleBot,
        bubble.isCrisis && s.bubbleCrisis,
      ]}>
        <Text style={[s.bubbleText, isUser && s.bubbleTextUser]}>{bubble.text}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 24 },
  noticeWrap: { backgroundColor: palette.primaryBgWash, borderRadius: 12, padding: 12, marginBottom: 12 },
  noticeText: { ...typography.caption, color: palette.textCaption, textAlign: 'center' },
  row: { marginBottom: 10, flexDirection: 'row' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: palette.primary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderBottomLeftRadius: 4 },
  bubbleCrisis: { borderColor: palette.danger, borderWidth: 1.5, backgroundColor: '#FBE9E9' },
  bubbleText: { ...typography.body, color: palette.textBody },
  bubbleTextUser: { color: palette.textInverse },
  crisisBanner: { backgroundColor: '#FBE9E9', borderRadius: 14, padding: 14, marginBottom: 12, gap: 8 },
  crisisBannerTitle: { ...typography.captionBold, color: palette.danger, marginBottom: 2 },
  hotlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  hotlineLabel: { flex: 1, ...typography.body, fontWeight: '600', color: palette.textHeading },
  hotlineNumber: { ...typography.bodyBold, color: palette.danger },
  mapRow: { alignItems: 'center', paddingVertical: 6 },
  mapText: { ...typography.bodyBold, color: palette.danger },
  typing: { ...typography.caption, color: palette.textMuted, marginLeft: 8, marginBottom: 8 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: palette.borderSubtle, backgroundColor: palette.surface },
  input: { flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: palette.bgAlt, borderRadius: 22, ...typography.body, color: palette.textHeading },
  sendBtn: { height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: palette.borderStrong },
  sendText: { ...typography.bodyBold, color: palette.textInverse },
});
