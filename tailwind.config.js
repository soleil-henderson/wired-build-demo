/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Wired Build palette — dark, muted, with a high-vis accent
        ink: {
          950: '#08090B',
          900: '#0E1014',
          800: '#15181E',
          700: '#1D2129',
          600: '#262B36',
          500: '#3A4150',
          400: '#5A6373',
          300: '#8A93A3',
          200: '#B7BDC8',
          100: '#E2E5EC',
        },
        accent: {
          DEFAULT: '#F5A524',
          dark: '#C7841A',
          light: '#FFC15A',
        },
        signal: {
          green: '#22C55E',
          red: '#EF4444',
          blue: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['SpaceGrotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
