// components/HealthBanner.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AlertTriangle, ShieldAlert, CheckCircle, Info } from 'lucide-react-native';
import type { HealthAnalysis } from '@/types/product';

interface Props {
  health: HealthAnalysis;
}

type BannerVariant = 'red' | 'yellow' | 'green' | 'hidden';

function getBannerVariant(health: HealthAnalysis): BannerVariant {
  if (health.flaggedIngredients.length > 0) return 'red';
  if (health.nutritionalWarning) return 'yellow';
  if (health.matchedDiets && health.matchedDiets.length > 0) return 'green';
  return 'hidden';
}

const VARIANT_STYLES = {
  red: { bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.35)', color: '#f43f5e', Icon: ShieldAlert },
  yellow: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', color: '#f59e0b', Icon: AlertTriangle },
  green: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', color: '#10b981', Icon: CheckCircle },
  hidden: { bg: 'transparent', border: 'transparent', color: '#fff', Icon: Info },
};

export default function HealthBanner({ health }: Props) {
  const variant = getBannerVariant(health);
  if (variant === 'hidden') return null;

  const { bg, border, color, Icon } = VARIANT_STYLES[variant];
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = (health.reasons && health.reasons.length > 0) || !!health.guidance;

  let title = '';
  let subtitle = '';

  if (variant === 'red') {
    title = `Contains ${health.flaggedIngredients.join(', ')}`;
    subtitle = 'ALLERGEN ALERT';
  } else if (variant === 'yellow') {
    title = health.nutritionalWarning ?? '';
    subtitle = 'NUTRITIONAL WARNING';
  } else if (variant === 'green' && health.matchedDiets) {
    const list = health.matchedDiets.join(', ');
    title = `Matches your ${list} preference`;
    subtitle = 'DIET MATCH';
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(350).duration(400)}
      style={[styles.banner, { backgroundColor: bg, borderColor: border }]}
    >
      <Icon size={18} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.subtitle, { color }]}>{subtitle}</Text>
        <Text style={styles.title}>{title}</Text>
        {health.reasons && health.reasons.length > 0 && (
          <View style={styles.chipRow}>
            {health.reasons.map((reason) => (
              <View key={reason} style={[styles.chip, { borderColor: border }]}>
                <Text style={[styles.chipText, { color }]}>{reason}</Text>
              </View>
            ))}
          </View>
        )}
        {hasDetails && (
          <Pressable onPress={() => setIsExpanded((prev) => !prev)} style={styles.detailsToggle}>
            <Text style={[styles.detailsToggleText, { color }]}>{isExpanded ? 'HIDE DETAILS' : 'WHY THIS FLAG?'}</Text>
          </Pressable>
        )}
        {isExpanded && (
          <View style={styles.detailsBox}>
            {health.reasons && health.reasons.length > 0 && (
              <Text style={styles.detailsText}>{`- ${health.reasons.join('\n- ')}`}</Text>
            )}
            {health.guidance && (
              <Text style={styles.detailsText}>{`- ${health.guidance}`}</Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  subtitle: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 10,
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 0.5,
  },
  detailsToggle: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  detailsToggleText: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: 'SpaceMono-Regular',
  },
  detailsBox: {
    marginTop: 8,
  },
  detailsText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 16,
  },
});
