// components/ui/MDBCard.tsx — MongoDB Design System Card
//
// Variants:
//   base             — Standard content card (default)
//   feature          — Feature card with larger padding
//   feature-dark     — Dark teal feature card on hero band
//   course           — Course tile with colored category tag
//   pricing          — Standard pricing tier card
//   pricing-featured — Featured pricing tier (mint bg + green border)
//   code-mockup      — Terminal-aesthetic code card
//
// All cards use {rounded.lg} (12px) corners.
// Elevation levels 0–4 are supported.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────

type CardVariant =
  | 'base'
  | 'feature'
  | 'feature-dark'
  | 'course'
  | 'pricing'
  | 'pricing-featured'
  | 'code-mockup';

type ElevationLevel = 0 | 1 | 2 | 3 | 4;

interface MDBCardProps {
  /** Visual variant matching MongoDB DS */
  variant?: CardVariant;
  /** Elevation / shadow depth (0 = flat, 4 = modal) */
  elevation?: ElevationLevel;
  /** Card content */
  children: React.ReactNode;
  /** Additional style overrides */
  style?: ViewStyle;
}

// ─── Design Tokens ────────────────────────────────────────────────

const COLORS = {
  canvas: '#FFFFFF',
  'canvas-dark': '#001E2B',
  'brand-teal-deep': '#001E2B',
  'surface-feature': '#E3FCF7',
  'brand-green': '#00ED64',
  hairline: '#E8EDEB',
  'on-dark': '#FFFFFF',
} as const;

// ─── Variant Configs ──────────────────────────────────────────────

const VARIANT_STYLES: Record<CardVariant, ViewStyle> = {
  base: {
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    padding: 32, // spacing.xl
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  feature: {
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    padding: 48, // spacing.xxl
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  'feature-dark': {
    backgroundColor: COLORS['brand-teal-deep'],
    borderRadius: 12,
    padding: 48, // spacing.xxl
    borderWidth: 0,
  },
  course: {
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    padding: 32, // spacing.xl
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  pricing: {
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    padding: 48, // spacing.xxl
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  'pricing-featured': {
    backgroundColor: COLORS['surface-feature'],
    borderRadius: 12,
    padding: 48, // spacing.xxl
    borderWidth: 2,
    borderColor: COLORS['brand-green'],
  },
  'code-mockup': {
    backgroundColor: COLORS['canvas-dark'],
    borderRadius: 12,
    padding: 24, // spacing.lg
    borderWidth: 0,
  },
};

// ─── Elevation / Shadow ───────────────────────────────────────────

interface ShadowConfig {
  ios: ViewStyle;
  android: { elevation: number };
}

const ELEVATION: Record<ElevationLevel, ShadowConfig> = {
  0: {
    ios: {},
    android: { elevation: 0 },
  },
  1: {
    ios: {
      shadowColor: '#001E2B',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
  },
  2: {
    ios: {
      shadowColor: '#001E2B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: { elevation: 3 },
  },
  3: {
    ios: {
      shadowColor: '#001E2B',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
    },
    android: { elevation: 6 },
  },
  4: {
    ios: {
      shadowColor: '#001E2B',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.16,
      shadowRadius: 48,
    },
    android: { elevation: 12 },
  },
};

// ─── Component ────────────────────────────────────────────────────

export default function MDBCard({
  variant = 'base',
  elevation = 0,
  children,
  style,
}: MDBCardProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const shadowStyle =
    Platform.OS === 'ios' ? ELEVATION[elevation].ios : ELEVATION[elevation].android;

  return (
    <View style={[variantStyle, shadowStyle, style]}>
      {children}
    </View>
  );
}

// ─── Convenience Sub-Components ───────────────────────────────────

/** Styled card title using heading-5 (18px/600) */
export function CardTitle({
  children,
  dark = false,
  style,
}: {
  children: string;
  dark?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Text
      style={[
        styles.cardTitle,
        dark && styles.cardTitleDark,
        style as any,
      ]}
    >
      {children}
    </Text>
  );
}

/** Styled card body text using body-sm (14px/400) */
export function CardBody({
  children,
  dark = false,
  style,
}: {
  children: string;
  dark?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Text
      style={[
        styles.cardBody,
        dark && styles.cardBodyDark,
        style as any,
      ]}
    >
      {children}
    </Text>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 25, // 18 * 1.40
    color: '#001E2B', // ink
  },
  cardTitleDark: {
    color: '#FFFFFF', // on-dark
  },
  cardBody: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21, // 14 * 1.50
    color: '#5C6C75', // slate
  },
  cardBodyDark: {
    color: 'rgba(255,255,255,0.7)', // on-dark-muted
  },
});
