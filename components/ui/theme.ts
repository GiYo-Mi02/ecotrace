// components/ui/theme.ts — MongoDB Design System Tokens (JS constants)
// Use these when you need direct access to token values in StyleSheet objects
// or when passing colors to third-party components (icons, charts, etc.)

export const colors = {
  // Brand & Accent
  brandGreen: '#00ED64',
  brandGreenDark: '#00684A',
  brandGreenMid: '#71F6BA',
  brandGreenSoft: '#E3FCF7',
  brandTealDeep: '#001E2B',
  brandTeal: '#023430',
  brandTealMid: '#0C4A41',
  onPrimary: '#001E2B',
  primaryPressed: '#00A35C',

  // Category Accent
  accentPurple: '#5C6BC0',
  accentOrange: '#F97316',
  accentPink: '#EC407A',
  accentBlue: '#42A5F5',

  // Surface
  canvas: '#FFFFFF',
  canvasDark: '#001E2B',
  surface: '#F9FBFA',
  surfaceSoft: '#F3F5F4',
  surfaceFeature: '#E3FCF7',

  // Hairline
  hairline: '#E8EDEB',
  hairlineSoft: '#F1F5F4',
  hairlineStrong: '#C1C7C6',
  hairlineDark: 'rgba(255,255,255,0.2)',

  // Text
  ink: '#001E2B',
  charcoal: '#1C3D4A',
  slate: '#5C6C75',
  steel: '#889397',
  stone: '#B8C4C2',
  muted: '#C1C7C6',
  onDark: '#FFFFFF',
  onDarkMuted: 'rgba(255,255,255,0.7)',

  // Semantic
  warningBg: '#FEF9C3',
  warningText: '#92400E',
} as const;

export const spacing = {
  xxs: 4, xs: 8, sm: 12, md: 16,
  lg: 24, xl: 32, xxl: 48,
  section: 64, sectionLg: 96, hero: 120,
} as const;

export const radii = {
  xs: 4, sm: 6, md: 8, lg: 12,
  xl: 16, xxl: 24, full: 9999,
} as const;

export const typography = {
  heroDisplay: { fontSize: 72, lineHeight: 79, letterSpacing: -1.5, fontWeight: '500' as const },
  displayLg: { fontSize: 56, lineHeight: 64, letterSpacing: -1, fontWeight: '500' as const },
  heading1: { fontSize: 48, lineHeight: 58, letterSpacing: -0.5, fontWeight: '500' as const },
  heading2: { fontSize: 36, lineHeight: 45, letterSpacing: -0.5, fontWeight: '500' as const },
  heading3: { fontSize: 28, lineHeight: 36, letterSpacing: 0, fontWeight: '500' as const },
  heading4: { fontSize: 22, lineHeight: 30, letterSpacing: 0, fontWeight: '500' as const },
  heading5: { fontSize: 18, lineHeight: 25, letterSpacing: 0, fontWeight: '600' as const },
  subtitle: { fontSize: 18, lineHeight: 27, letterSpacing: 0, fontWeight: '400' as const },
  bodyMd: { fontSize: 16, lineHeight: 25, letterSpacing: 0, fontWeight: '400' as const },
  bodySm: { fontSize: 14, lineHeight: 21, letterSpacing: 0, fontWeight: '400' as const },
  bodySmMedium: { fontSize: 14, lineHeight: 21, letterSpacing: 0, fontWeight: '500' as const },
  captionBold: { fontSize: 13, lineHeight: 18, letterSpacing: 0, fontWeight: '600' as const },
  microUppercase: { fontSize: 11, lineHeight: 15, letterSpacing: 1, fontWeight: '600' as const },
  buttonMd: { fontSize: 14, lineHeight: 18, letterSpacing: 0, fontWeight: '600' as const },
  codeMd: { fontSize: 14, lineHeight: 22, letterSpacing: 0, fontWeight: '400' as const },
} as const;

export const elevation = {
  0: {},
  1: { shadowColor: '#001E2B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  2: { shadowColor: '#001E2B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
  3: { shadowColor: '#001E2B', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24 },
  4: { shadowColor: '#001E2B', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.16, shadowRadius: 48 },
} as const;
