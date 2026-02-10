// components/DemoBanner.tsx — Visible "Demo Mode" indicator
// Audit fix: "No 'demo mode' indicator — users have no way to know this is mock data"

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

interface DemoBannerProps {
  message?: string;
}

export default function DemoBanner({ message }: DemoBannerProps) {
  return (
    <View style={styles.banner}>
      <AlertTriangle size={13} color="#f59e0b" />
      <Text style={styles.text}>
        {message || 'BETA — SCORES ARE ESTIMATES BASED ON OPEN DATA'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,158,11,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: '#f59e0b',
    letterSpacing: 0.8,
    flex: 1,
  },
});
