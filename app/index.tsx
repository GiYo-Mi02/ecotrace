// app/index.tsx — Entry point, checks onboarding state then redirects
// AUDIT FIX: Replaced monolithic navigation with proper Expo Router redirect

import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { getHasSeenOnboarding } from '@/services/storage';

export default function Index() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    getHasSeenOnboarding().then(setHasSeenOnboarding);
  }, []);

  // Loading state
  if (hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // Route based on onboarding state
  if (!hasSeenOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/scanner" />;
}
