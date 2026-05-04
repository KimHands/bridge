// Root entry — fonts + query client + auth hydration + Navigation.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import Navigation from '@/navigation/Navigation';
import { useAuth } from '@/store/auth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  const hydrate = useAuth(s => s.hydrate);

  const [fontsLoaded] = useFonts({
    'PretendardVariable': require('./assets/fonts/PretendardVariable.ttf'),
    'Pretendard-Bold':    require('./assets/fonts/Pretendard-Bold.otf'),
    'Manrope-Regular':    require('./assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Bold':       require('./assets/fonts/Manrope-Bold.ttf'),
    'PlusJakartaSans-Bold': require('./assets/fonts/PlusJakartaSans-Bold.ttf'),
  });

  useEffect(() => { hydrate(); }, [hydrate]);

  if (!fontsLoaded) return <View style={{ flex: 1 }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark"/>
          <Navigation/>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
