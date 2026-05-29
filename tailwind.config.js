/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Apple-inspired light palette (wired_build_demo.jsx)
        apple: {
          bg: '#FFFFFF',
          bg2: '#F5F5F7',
          surface: '#FFFFFF',
          border: '#E8E8ED',
          'border-strong': '#D2D2D7',
          ink: '#1D1D1F',
          secondary: '#6E6E73',
          tertiary: '#A1A1A6',
        },
        accent: {
          DEFAULT: '#FF6A2B',
          soft: '#FFF1EA',
          dark: '#E55A1F',
          light: '#FF8F5C',
        },
        signal: {
          green: '#34C759',
          red: '#FF3B30',
          blue: '#0071E3',
          amber: '#FF9F0A',
          purple: '#AF52DE',
        },
        // Legacy dark tokens — kept for auth/detail screens not yet migrated
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        apple: '18px',
        'apple-sm': '14px',
      },
      maxWidth: {
        app: '430px',
        'app-lg': '480px',
        'app-xl': '540px',
      },
      screens: {
        md: '640px',
        lg: '1024px',
        xl: '1280px',
      },
    },
  },
  plugins: [],
};
