/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4 content paths
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // ─── COLORS ─────────────────────────────────────────────────────
      // MongoDB Design System — full token coverage
      colors: {
        // Brand & Accent
        "brand-green": "#00ED64",
        "brand-green-dark": "#00684A",
        "brand-green-mid": "#71F6BA",
        "brand-green-soft": "#E3FCF7",
        "brand-teal-deep": "#001E2B",
        "brand-teal": "#023430",
        "brand-teal-mid": "#0C4A41",
        "on-primary": "#001E2B",
        "primary-pressed": "#00A35C",

        // Category Accent (Course Tags)
        "accent-purple": "#5C6BC0",
        "accent-orange": "#F97316",
        "accent-pink": "#EC407A",
        "accent-blue": "#42A5F5",

        // Surface
        canvas: "#FFFFFF",
        "canvas-dark": "#001E2B",
        surface: "#F9FBFA",
        "surface-soft": "#F3F5F4",
        "surface-feature": "#E3FCF7",

        // Hairline (borders/dividers)
        hairline: "#E8EDEB",
        "hairline-soft": "#F1F5F4",
        "hairline-strong": "#C1C7C6",
        "hairline-dark": "rgba(255,255,255,0.2)",

        // Text
        ink: "#001E2B",
        charcoal: "#1C3D4A",
        slate: "#5C6C75",
        steel: "#889397",
        stone: "#B8C4C2",
        muted: "#C1C7C6",
        "on-dark": "#FFFFFF",
        "on-dark-muted": "rgba(255,255,255,0.7)",

        // Semantic
        "semantic-warning-bg": "#FEF9C3",
        "semantic-warning-text": "#92400E",
      },

      // ─── TYPOGRAPHY ─────────────────────────────────────────────────
      // MongoDB Design System font mapping
      // Body: Inter (≈ Euclid Circular A)
      // Headers: DM Serif Display (≈ MongoDB Value Serif)
      // Code: Source Code Pro
      fontFamily: {
        sans: ["Inter-Regular"],
        "sans-medium": ["Inter-Medium"],
        "sans-semibold": ["Inter-SemiBold"],
        "sans-bold": ["Inter-Bold"],
        serif: ["DMSerifDisplay-Regular"],
        mono: ["SourceCodePro-Regular"],
        "mono-medium": ["SourceCodePro-Medium"],
        "mono-semibold": ["SourceCodePro-SemiBold"],
        "mono-bold": ["SourceCodePro-Bold"],
      },

      // Font size + line-height pairs matching MongoDB DS hierarchy
      // Format: [fontSize, { lineHeight, letterSpacing, fontWeight }]
      fontSize: {
        "hero-display": [
          "72px",
          { lineHeight: "1.10", letterSpacing: "-1.5px" },
        ],
        "display-lg": [
          "56px",
          { lineHeight: "1.15", letterSpacing: "-1px" },
        ],
        "heading-1": [
          "48px",
          { lineHeight: "1.20", letterSpacing: "-0.5px" },
        ],
        "heading-2": [
          "36px",
          { lineHeight: "1.25", letterSpacing: "-0.5px" },
        ],
        "heading-3": ["28px", { lineHeight: "1.30", letterSpacing: "0px" }],
        "heading-4": ["22px", { lineHeight: "1.35", letterSpacing: "0px" }],
        "heading-5": ["18px", { lineHeight: "1.40", letterSpacing: "0px" }],
        subtitle: ["18px", { lineHeight: "1.50", letterSpacing: "0px" }],
        "body-md": ["16px", { lineHeight: "1.55", letterSpacing: "0px" }],
        "body-sm": ["14px", { lineHeight: "1.50", letterSpacing: "0px" }],
        "body-sm-medium": [
          "14px",
          { lineHeight: "1.50", letterSpacing: "0px" },
        ],
        "caption-bold": [
          "13px",
          { lineHeight: "1.40", letterSpacing: "0px" },
        ],
        "micro-uppercase": [
          "11px",
          { lineHeight: "1.40", letterSpacing: "1px" },
        ],
        "button-md": ["14px", { lineHeight: "1.30", letterSpacing: "0px" }],
        "code-md": ["14px", { lineHeight: "1.55", letterSpacing: "0px" }],
      },

      // ─── SPACING ────────────────────────────────────────────────────
      // 4px base unit system
      spacing: {
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
        "3xl": "64px",
        section: "64px",
        "section-lg": "96px",
        hero: "120px",
      },

      // ─── BORDER RADIUS ──────────────────────────────────────────────
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
        full: "9999px",
      },

      // ─── ELEVATION / SHADOWS ────────────────────────────────────────
      // iOS shadow mapping — Android uses `elevation` prop directly
      boxShadow: {
        "elevation-0": "none",
        "elevation-1": "0px 1px 2px rgba(0, 30, 43, 0.04)",
        "elevation-2": "0px 4px 12px rgba(0, 30, 43, 0.08)",
        "elevation-3": "0px 12px 24px -4px rgba(0, 30, 43, 0.12)",
        "elevation-4": "0px 16px 48px -8px rgba(0, 30, 43, 0.16)",
      },
    },
  },
  plugins: [],
};
