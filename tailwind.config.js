/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        neural: {
          bg: '#0f172a',
          card: '#1e293b',
          border: 'rgba(255,255,255,0.1)',
        },
        emerald: {
          DEFAULT: '#10b981',
          dim: 'rgba(16,185,129,0.1)',
          border: 'rgba(16,185,129,0.3)',
        },
        rose: {
          DEFAULT: '#f43f5e',
          dim: 'rgba(244,63,94,0.1)',
          border: 'rgba(244,63,94,0.3)',
        },
        blue: {
          DEFAULT: '#3b82f6',
          dim: 'rgba(59,130,246,0.1)',
        },
        amber: {
          DEFAULT: '#f59e0b',
          dim: 'rgba(245,158,11,0.1)',
        },
      },
      fontFamily: {
        mono: ['SpaceMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
