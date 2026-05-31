import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
import { palette, fontFamily } from '@/theme/tokens';
import { PrimaryButton, Card } from '@/components/atoms';
import { TopBar } from '@/components/BackHeader';
import BottomCTA from '@/components/BottomCTA';
import { useAuth } from '@/store/auth';
import { useRoutineList } from '@/hooks/useRoutineQueries';
import { RoutineIcon } from '@/lib/routineIcon';
import { Plant } from 'phosphor-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'InitialRoutine'>;

export default function InitialRoutineScreen({ navigation }: Props) {
  const { data, isLoading } = useRoutineList();
  const routines = data?.routines ?? [];

  // 두 가지 진입 경로를 모두 처리:
  // (1) assessment 그룹: requires_assessment=true → false 로 플립하면
  //     Navigation의 navKey가 바뀌며 Stack.Navigator가 remount → Main 으로 전환
  // (2) main 그룹의 InitialRoutine (마이페이지에서 자가평가 재진행 등):
  //     이미 false 라 플립으로는 화면 전환이 일어나지 않으므로 명시적 reset
  const start = () => {
    const u = useAuth.getState().user;
    if (u?.requires_assessment) {
      useAuth.setState({ user: { ...u, requires_assessment: false } });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Main' as never }] });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar onBack={() => navigation.goBack()} title="첫 루틴 설정"/>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>
          {routines.length > 0
            ? `맞춤 루틴 ${routines.length}개가 준비됐어요`
            : '맞춤 루틴이 준비됐어요'}
        </Text>
        <Text style={s.sub}>자가평가 결과를 바탕으로{'\n'}당신에게 딱 맞는 루틴을 골랐어요.</Text>

        {isLoading ? (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={palette.primary}/>
          </View>
        ) : routines.length === 0 ? (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <View style={{ marginBottom: 12 }}><Plant size={48} color={palette.primary} weight="duotone" /></View>
            <Text style={{ fontSize: 14, color: palette.textCaption, textAlign: 'center' }}>
              루틴을 불러오는 중이에요.{'\n'}잠시 후 시작 버튼을 눌러주세요.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 20, gap: 12 }}>
            {routines.map((r) => (
              <Card key={r.user_routine_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={s.iconBox}>
                  <RoutineIcon title={r.title} size={32} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.routineTitle}>{r.title}</Text>
                  <Text style={s.routineDesc}>{r.description}</Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        <View style={s.tip}>
          <Text style={{ fontSize: 22 }}>💡</Text>
          <Text style={s.tipText}>루틴은 언제든지 추가하거나 제거할 수 있어요.{'\n'}부담없이 하나씩 시작해보세요.</Text>
        </View>
        <View style={{ height: 100 }}/>
      </ScrollView>
      <BottomCTA>
        <PrimaryButton onPress={start}>시작하기</PrimaryButton>
      </BottomCTA>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: palette.textHeading, letterSpacing: -0.5, lineHeight: 34 },
  sub: { marginTop: 10, fontSize: 14, color: palette.textCaption, lineHeight: 22 },
  iconBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: palette.primaryBgSoft, alignItems: 'center', justifyContent: 'center',
  },
  routineTitle: { fontSize: 15, fontWeight: '700', color: palette.textHeading },
  routineDesc: { marginTop: 2, fontSize: 12, color: palette.textCaption },
  tip: { marginTop: 24, padding: 16, borderRadius: 14, backgroundColor: palette.mintBgWash, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipText: { flex: 1, fontSize: 12, color: palette.textBody, lineHeight: 20 },
});
