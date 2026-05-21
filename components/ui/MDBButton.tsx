// components/ui/MDBButton.tsx — MongoDB Design System Button
//
// Variants:
//   primary        — Bright MongoDB green pill CTA (default)
//   secondary      — Outlined pill for secondary actions
//   on-dark        — Bright green pill on dark hero bands
//   secondary-dark — Outlined pill on dark backgrounds
//   ghost          — Quieter rectangular ghost button
//   link           — Inline green text link
//
// All buttons use {rounded.full} pill shape except ghost ({rounded.md}).
// No hover states — default + pressed only (React Native).

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  Platform,
  type ViewStyle,
  type TextStyle,
  type PressableProps,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'on-dark'
  | 'secondary-dark'
  | 'ghost'
  | 'link';

type ButtonSize = 'sm' | 'md' | 'lg';

interface MDBButtonProps extends Omit<PressableProps, 'style'> {
  /** Visual variant matching MongoDB DS */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Button label text */
  label: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Optional icon element rendered before the label */
  leftIcon?: React.ReactNode;
  /** Optional icon element rendered after the label */
  rightIcon?: React.ReactNode;
  /** Additional container style overrides */
  style?: ViewStyle;
}

// ─── Design Tokens ────────────────────────────────────────────────

const COLORS = {
  'brand-green': '#00ED64',
  'brand-green-dark': '#00684A',
  'primary-pressed': '#00A35C',
  'on-primary': '#001E2B',
  ink: '#001E2B',
  'on-dark': '#FFFFFF',
  'hairline-strong': '#C1C7C6',
  hairline: '#E8EDEB',
  'hairline-dark': 'rgba(255,255,255,0.2)',
  muted: '#C1C7C6',
  steel: '#889397',
} as const;

// ─── Variant Configs ──────────────────────────────────────────────

interface VariantStyle {
  container: ViewStyle;
  containerPressed: ViewStyle;
  containerDisabled: ViewStyle;
  text: TextStyle;
  textPressed: TextStyle;
  textDisabled: TextStyle;
}

const VARIANT_STYLES: Record<ButtonVariant, VariantStyle> = {
  primary: {
    container: {
      backgroundColor: COLORS['brand-green'],
      borderRadius: 9999,
    },
    containerPressed: {
      backgroundColor: COLORS['primary-pressed'],
    },
    containerDisabled: {
      backgroundColor: COLORS.hairline,
    },
    text: {
      color: COLORS['on-primary'],
    },
    textPressed: {
      color: COLORS['on-primary'],
    },
    textDisabled: {
      color: COLORS.muted,
    },
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: COLORS['hairline-strong'],
    },
    containerPressed: {
      backgroundColor: 'rgba(0,30,43,0.04)',
    },
    containerDisabled: {
      borderColor: COLORS.hairline,
    },
    text: {
      color: COLORS.ink,
    },
    textPressed: {
      color: COLORS.ink,
    },
    textDisabled: {
      color: COLORS.muted,
    },
  },
  'on-dark': {
    container: {
      backgroundColor: COLORS['brand-green'],
      borderRadius: 9999,
    },
    containerPressed: {
      backgroundColor: COLORS['primary-pressed'],
    },
    containerDisabled: {
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    text: {
      color: COLORS['on-primary'],
    },
    textPressed: {
      color: COLORS['on-primary'],
    },
    textDisabled: {
      color: 'rgba(255,255,255,0.3)',
    },
  },
  'secondary-dark': {
    container: {
      backgroundColor: 'transparent',
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: COLORS['hairline-dark'],
    },
    containerPressed: {
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    containerDisabled: {
      borderColor: 'rgba(255,255,255,0.1)',
    },
    text: {
      color: COLORS['on-dark'],
    },
    textPressed: {
      color: COLORS['on-dark'],
    },
    textDisabled: {
      color: 'rgba(255,255,255,0.3)',
    },
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderRadius: 8,
    },
    containerPressed: {
      backgroundColor: 'rgba(0,30,43,0.04)',
    },
    containerDisabled: {},
    text: {
      color: COLORS.ink,
    },
    textPressed: {
      color: COLORS.ink,
    },
    textDisabled: {
      color: COLORS.muted,
    },
  },
  link: {
    container: {
      backgroundColor: 'transparent',
      borderRadius: 0,
    },
    containerPressed: {},
    containerDisabled: {},
    text: {
      color: COLORS['brand-green-dark'],
    },
    textPressed: {
      color: COLORS['brand-green'],
    },
    textDisabled: {
      color: COLORS.muted,
    },
  },
};

const SIZE_PADDING: Record<ButtonSize, ViewStyle> = {
  sm: { paddingVertical: 6, paddingHorizontal: 16 },
  md: { paddingVertical: 10, paddingHorizontal: 22 },
  lg: { paddingVertical: 14, paddingHorizontal: 28 },
};

const SIZE_FONT: Record<ButtonSize, number> = {
  sm: 12,
  md: 14,
  lg: 16,
};

// ─── Component ────────────────────────────────────────────────────

export default function MDBButton({
  variant = 'primary',
  size = 'md',
  label,
  disabled = false,
  leftIcon,
  rightIcon,
  style: styleProp,
  ...pressableProps
}: MDBButtonProps) {
  const vs = VARIANT_STYLES[variant];
  const isLink = variant === 'link';

  return (
    <Pressable
      disabled={disabled}
      {...pressableProps}
      style={({ pressed }) => [
        styles.base,
        !isLink && SIZE_PADDING[size],
        isLink && styles.linkPadding,
        vs.container,
        pressed && vs.containerPressed,
        disabled && vs.containerDisabled,
        styleProp,
      ]}
    >
      {({ pressed }) => (
        <>
          {leftIcon}
          <Text
            style={[
              styles.label,
              { fontSize: SIZE_FONT[size] },
              isLink && styles.linkLabel,
              vs.text,
              pressed && vs.textPressed,
              disabled && vs.textDisabled,
            ]}
          >
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

// ─── Base Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // Minimum touch target per MongoDB DS (40–44px effective height)
    minHeight: 40,
  },
  label: {
    fontWeight: '600',
    // typography.button-md
    lineHeight: 18,
    letterSpacing: 0,
  },
  linkPadding: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 0,
  },
  linkLabel: {
    fontWeight: '500',
    fontSize: 14,
  },
});
