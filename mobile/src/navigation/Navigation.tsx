// React Navigation root — Stack with Auth/Main groups, Bottom Tabs nested in Main.
// Each screen lives in src/screens/ and follows 1:1 with the prototype.
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/store/auth';
import { palette } from '@/theme/tokens';

// Auth flow
import SplashScreen        from '@/screens/auth/SplashScreen';
import OnboardingScreen    from '@/screens/auth/OnboardingScreen';
import LoginScreen         from '@/screens/auth/LoginScreen';
import SignupScreen        from '@/screens/auth/SignupScreen';
import AssessmentScreen    from '@/screens/auth/AssessmentScreen';
import InitialRoutineScreen from '@/screens/auth/InitialRoutineScreen';

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
import LegalScreen         from '@/screens/legal/LegalScreen';
import type { LegalKind }  from '@/screens/legal/LegalScreen';

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
  Legal: { kind: LegalKind };
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

  // Stack.Navigator key — auth 단계가 바뀌면 navigator 자체를 remount.
  // 같은 navigator 안에서 Stack.Group을 조건부로 swap하면 v6에서 현재 라우트가
  // 새 그룹에 없을 때 전환이 누락되는 케이스가 있어, key 기반 remount로 해결한다.
  const navKey = !user ? 'auth' : user.requires_assessment ? 'assessment' : 'main';

  return (
    <NavigationContainer>
      <Stack.Navigator key={navKey} screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
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
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabs}/>
            <Stack.Screen name="DiaryMood"     component={DiaryMoodScreen}/>
            <Stack.Screen name="DiaryKeyword"  component={DiaryKeywordScreen}/>
            <Stack.Screen name="DiaryQuestion" component={DiaryQuestionScreen}/>
            <Stack.Screen name="DiaryMemo"     component={DiaryMemoScreen}/>
            <Stack.Screen name="DiaryDetail"   component={DiaryDetailScreen}/>
            <Stack.Screen name="RoutineDetail" component={RoutineDetailScreen}/>
            <Stack.Screen name="RoutineAdd"    component={RoutineAddScreen}/>
            <Stack.Screen name="ProfileEdit"   component={ProfileEditScreen}/>
            <Stack.Screen name="Legal"         component={LegalScreen}/>
            {/* re-running assessment from MyPage */}
            <Stack.Screen name="Assessment"      component={AssessmentScreen}/>
            <Stack.Screen name="InitialRoutine"  component={InitialRoutineScreen}/>
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
