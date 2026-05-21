// components/ui/MDBBadge.tsx — MongoDB Design System Badge
//
// Variants:
//   green       — Bright green for new product highlights
//   green-soft  — Pale-mint pill for success/free indicators
//   purple      — Purple course category tag
//   orange      — Orange course category tag
//   pink        — Pink course category tag variant
//   blue        — Blue course category tag variant
//   popular     — "Most Popular" dark teal pill with green text
//   status      — Customizable status indicator
//
// Category tags use {rounded.sm} (6px).
// Status/popular badges use {rounded.full} pill.

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────

type BadgeVariant =
  | 'green'
  | 'green-soft'
  | 'purple'
  | 'orange'
  | 'pink'
  | 'blue'
  | 'popular'
  | 'status';

interface MDBBadgeProps {
  /** Visual variant */
  variant?: BadgeVariant;
  /** Badge label text */
  label: string;
  /** Optional icon rendered before label */
  icon?: React.ReactNode;
  /** Additional style overrides */
  style?: ViewStyle;
}

// ─── Variant Configs ──────────────────────────────────────────────

interface BadgeConfig {
  container: ViewStyle;
  text: TextStyle;
}

const VARIANT_CONFIGS: Record<BadgeVariant, BadgeConfig> = {
  green: {
    container: {
      backgroundColor: '#00ED64',
      borderRadius: 6, // rounded.sm
      paddingVertical: 2,
      paddingHorizontal: 8,
    },
    text: {
      color: '#001E2B', // on-primary
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
  },
  'green-soft': {
    container: {
      backgroundColor: '#E3FCF7', // brand-green-soft
      borderRadius: 9999, // rounded.full
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    text: {
      color: '#00684A', // brand-green-dark
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
  },
  purple: {
    container: {
      backgroundColor: '#5C6BC0', // accent-purple
      borderRadius: 6, // rounded.sm — category tags use rounded.sm
      paddingVertical: 2,
      paddingHorizontal: 8,
    },
    text: {
      color: '#FFFFFF', // on-dark
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
  },
  orange: {
    container: {
      backgroundColor: '#F97316', // accent-orange
      borderRadius: 6,
      paddingVertical: 2,
      paddingHorizontal: 8,
    },
    text: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
  },
  pink: {
    container: {
      backgroundColor: '#EC407A', // accent-pink
      borderRadius: 6,
      paddingVertical: 2,
      paddingHorizontal: 8,
    },
    text: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
  },
  blue: {
    container: {
      backgroundColor: '#42A5F5', // accent-blue
      borderRadius: 6,
      paddingVertical: 2,
      paddingHorizontal: 8,
    },
    text: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
  },
  popular: {
    container: {
      backgroundColor: '#001E2B', // brand-teal-deep
      borderRadius: 9999, // rounded.full
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    text: {
      color: '#00ED64', // brand-green
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
  },
  status: {
    container: {
      backgroundColor: '#E3FCF7',
      borderRadius: 9999,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    text: {
      color: '#00684A',
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
  },
};

// ─── Component ────────────────────────────────────────────────────

export default function MDBBadge({
  variant = 'green',
  label,
  icon,
  style,
}: MDBBadgeProps) {
  const config = VARIANT_CONFIGS[variant];

  return (
    <View style={[styles.base, config.container, style]}>
      {icon}
      <Text style={config.text}>{label}</Text>
    </View>
  );
}

// ─── Base Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
});
