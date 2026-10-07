// React Navigation root — Stack with Auth/Main groups, Bottom Tabs nested in Main.
// Each screen lives in src/screens/ and follows 1:1 with the prototype.
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNotificationDeepLink } from '@/hooks/useNotificationDeepLink';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/store/auth';
import { palette } from '@/theme/tokens';

// Auth flow
import SplashScreen        from '@/screens/auth/SplashScreen';
import OnboardingScreen    from '@/screens/auth/OnboardingScreen';
import LoginScreen         from '@/screens/auth/LoginScreen';
import SignupScreen        from '@/screens/auth/SignupScreen';
import AssessmentScreen    from '@/screens/auth/AssessmentScreen';
import InitialRoutineScreen from '@/screens/auth/InitialRoutineScreen';
import UpgradeScreen       from '@/screens/auth/UpgradeScreen';

// Main tabs
import HomeScreen          from '@/screens/main/HomeScreen';
import RoutineScreen       from '@/screens/main/RoutineScreen';
import DiaryListScreen     from '@/screens/main/DiaryListScreen';
import ReportScreen        from '@/screens/main/ReportScreen';
import MyPageScreen        from '@/screens/main/MyPageScreen';

// Detail stack
import DiaryMoodScreen     from '@/screens/diary/DiaryMoodScreen';
import DiaryKeywordScreen  from '@/screens/diary/DiaryKeywordScreen';
import DiaryQuestionScreen from '@/screens/diary/DiaryQuestionScreen';
import DiaryMemoScreen     from '@/screens/diary/DiaryMemoScreen';
import DiaryDetailScreen   from '@/screens/diary/DiaryDetailScreen';
import RoutineDetailScreen from '@/screens/routine/RoutineDetailScreen';
import RoutineAddScreen    from '@/screens/routine/RoutineAddScreen';
import ProfileEditScreen   from '@/screens/my/ProfileEditScreen';
import NotificationSettingsScreen from '@/screens/my/NotificationSettingsScreen';
import AchievementHistoryScreen from '@/screens/my/AchievementHistoryScreen';
import LegalScreen         from '@/screens/legal/LegalScreen';
import type { LegalKind }  from '@/screens/legal/LegalScreen';
import ChatScreen          from '@/screens/chat/ChatScreen';
import SupportConnectScreen from '@/screens/support/SupportConnectScreen';

import TabBarIcon          from '@/components/TabBarIcon';

// ── Param types — single source of truth for route names + payloads ──
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  Assessment: { mode?: 'view' } | undefined;
  InitialRoutine: undefined;
  Main: undefined;
  DiaryMood: undefined;
  DiaryKeyword: undefined;
  DiaryQuestion: undefined;
  DiaryMemo: undefined;
  DiaryDetail: { entryId: string };
  RoutineDetail: { routineId: string };
  RoutineAdd: undefined;
  ProfileEdit: undefined;
  NotificationSettings: undefined;
  AchievementHistory: undefined;
  Legal: { kind: LegalKind };
  Chat: undefined;
  SupportConnect: undefined;
  Upgrade: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Routine: undefined;
  Diary: undefined;
  Report: undefined;
  My: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function NotificationBridge() {
  const handleDeepLink = useNotificationDeepLink();
  usePushNotifications(handleDeepLink);
  return null;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          height: 76, paddingTop: 8, paddingBottom: 12,
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTopColor: palette.borderSubtle,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => <TabBarIcon name={route.name} color={color} focused={focused}/>,
      })}>
      <Tab.Screen name="Home"    component={HomeScreen}      options={{ tabBarLabel: '홈' }}/>
      <Tab.Screen name="Routine" component={RoutineScreen}   options={{ tabBarLabel: '루틴' }}/>
      <Tab.Screen name="Diary"   component={DiaryListScreen} options={{ tabBarLabel: '기록' }}/>
      <Tab.Screen name="Report"  component={ReportScreen}    options={{ tabBarLabel: '리포트' }}/>
      <Tab.Screen name="My"      component={MyPageScreen}    options={{ tabBarLabel: '마이' }}/>
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { user, hydrated } = useAuth();

  if (!hydrated) return null; // splash is shown by App.tsx until hydrated

  // auth 단계가 바뀌면 NavigationContainer째 remount해 내비게이션 상태를 버린다.
  // Stack.Navigator만 remount하면 상태는 컨테이너에 남아, 새 그룹에도 같은 이름의
  // 화면(Assessment·InitialRoutine 등)이 있을 때 옛 스택이 그대로 복원된다
  // (예: 첫 루틴 '시작하기'를 눌러도 main 그룹의 InitialRoutine에 머무는 버그).
  const navKey = !user ? 'auth' : user.requires_assessment ? 'assessment' : 'main';

  return (
    <NavigationContainer key={navKey}>
      <NotificationBridge />
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!user ? (
          <Stack.Group>
            <Stack.Screen name="Splash"     component={SplashScreen}/>
            <Stack.Screen name="Onboarding" component={OnboardingScreen}/>
            <Stack.Screen name="Login"      component={LoginScreen}/>
            <Stack.Screen name="Signup"     component={SignupScreen}/>
            <Stack.Screen name="Legal"      component={LegalScreen}/>
          </Stack.Group>
        ) : user.requires_assessment ? (
          <Stack.Group>
            <Stack.Screen name="Assessment"     component={AssessmentScreen}/>
            <Stack.Screen name="InitialRoutine" component={InitialRoutineScreen}/>
            <Stack.Screen name="Legal"          component={LegalScreen}/>
            {/* 익명 사용자가 기존 계정으로 로그인할 수 있는 진입점(MyPage에서 접근하려면
                requires_assessment=false여야 하지만, 온보딩 등 다른 경로 대비 동일하게 등록) */}
            <Stack.Screen name="Login"           component={LoginScreen}/>
            <Stack.Screen name="Signup"          component={SignupScreen}/>
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabs}/>
            {/* 익명 사용자(user !== null)는 !user 분기의 Login 화면에 닿을 수 없으므로
                여기 등록해 MyPage "이미 계정이 있어요" 진입점에서 이동 가능하게 한다.
                device_secret은 지우지 않고 이동 — 로그인 성공 시 navKey가 바뀌며 자동 remount. */}
            <Stack.Screen name="Login"         component={LoginScreen}/>
            <Stack.Screen name="Signup"        component={SignupScreen}/>
            <Stack.Screen name="DiaryMood"     component={DiaryMoodScreen}/>
            <Stack.Screen name="DiaryKeyword"  component={DiaryKeywordScreen}/>
            <Stack.Screen name="DiaryQuestion" component={DiaryQuestionScreen}/>
            <Stack.Screen name="DiaryMemo"     component={DiaryMemoScreen}/>
            <Stack.Screen name="DiaryDetail"   component={DiaryDetailScreen}/>
            <Stack.Screen name="RoutineDetail" component={RoutineDetailScreen}/>
            <Stack.Screen name="RoutineAdd"    component={RoutineAddScreen}/>
            <Stack.Screen name="ProfileEdit"          component={ProfileEditScreen}/>
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen}/>
            <Stack.Screen name="AchievementHistory"   component={AchievementHistoryScreen}/>
            <Stack.Screen name="Legal"                component={LegalScreen}/>
            <Stack.Screen name="Chat"                 component={ChatScreen}/>
            <Stack.Screen name="SupportConnect"       component={SupportConnectScreen}/>
            <Stack.Screen name="Upgrade"               component={UpgradeScreen}/>
            {/* re-running assessment from MyPage */}
            <Stack.Screen name="Assessment"      component={AssessmentScreen}/>
            <Stack.Screen name="InitialRoutine"  component={InitialRoutineScreen}/>
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
