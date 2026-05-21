// app/_layout.tsx — ROOT LAYOUT
// MongoDB Design System reskin via NativeWind v4

import "../global.css";

import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ScanProvider } from '@/stores/ScanContext';
import { initializeMLModel } from '@/services/mlPrediction';

// MongoDB DS Typography — Google Fonts equivalents
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  DMSerifDisplay_400Regular,
} from '@expo-google-fonts/dm-serif-display';
import {
  SourceCodePro_400Regular,
  SourceCodePro_500Medium,
  SourceCodePro_600SemiBold,
  SourceCodePro_700Bold,
} from '@expo-google-fonts/source-code-pro';

// Prevent splash screen from auto-hiding until fonts loaded
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    // Body font (Euclid Circular A equivalent)
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    // Header font (MongoDB Value Serif equivalent)
    'DMSerifDisplay-Regular': DMSerifDisplay_400Regular,
    // Code font
    'SourceCodePro-Regular': SourceCodePro_400Regular,
    'SourceCodePro-Medium': SourceCodePro_500Medium,
    'SourceCodePro-SemiBold': SourceCodePro_600SemiBold,
    'SourceCodePro-Bold': SourceCodePro_700Bold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  // Initialize TensorFlow.js ML model in background on app start
  useEffect(() => {
    initializeMLModel().catch((err) =>
      console.warn('[ECOTRACE] ML init error (heuristic fallback active):', err)
    );
  }, []);

  if (!loaded) return null;

  return (
    <ErrorBoundary>
      <ScanProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#001E2B' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen name="parsing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="impact" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="audit" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="productNotFound" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="photoUpload" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="methodology" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        <StatusBar style="light" />
      </ScanProvider>
    </ErrorBoundary>
  );
}
