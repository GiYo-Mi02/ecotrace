// components/DemoBanner.tsx — MongoDB DS promo-banner style
// Dark teal strip with warning icon — matches promo-banner component spec

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { colors } from '@/components/ui/theme';

interface DemoBannerProps {
  message?: string;
}

export default function DemoBanner({ message }: DemoBannerProps) {
  return (
    <View style={styles.banner}>
      <AlertTriangle size={13} color={colors.brandGreen} />
      <Text style={styles.text}>
        {message || 'BETA — SCORES ARE ESTIMATES BASED ON OPEN DATA'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.brandTealDeep,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,237,100,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onDarkMuted,
    letterSpacing: 0.8,
    flex: 1,
  },
});
