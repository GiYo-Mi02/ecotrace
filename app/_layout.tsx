// app/_layout.tsx — ROOT LAYOUT
// AUDIT FIX: Proper Expo Router layout with ErrorBoundary + ScanProvider
// Replaces the monolithic single-file navigation

import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ScanProvider } from '@/stores/ScanContext';

// Prevent splash screen from auto-hiding until fonts loaded
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    'SpaceMono-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ErrorBoundary>
      <ScanProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0f172a' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen name="parsing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="impact" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="audit" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="methodology" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        <StatusBar style="light" />
      </ScanProvider>
    </ErrorBoundary>
  );
}
