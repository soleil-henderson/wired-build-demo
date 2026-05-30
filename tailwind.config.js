/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: 'var(--apple-bg)',
          bg2: 'var(--apple-bg2)',
          surface: 'var(--apple-surface)',
          border: 'var(--apple-border)',
          'border-strong': 'var(--apple-border-strong)',
          ink: 'var(--apple-ink)',
          secondary: 'var(--apple-secondary)',
          tertiary: 'var(--apple-tertiary)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          dark: 'var(--accent-dark)',
          light: 'var(--accent-light)',
        },
        signal: {
          green: 'var(--signal-green)',
          red: 'var(--signal-red)',
          blue: 'var(--signal-blue)',
          amber: 'var(--signal-amber)',
          purple: 'var(--signal-purple)',
        },
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
        display: ['SpaceGrotesk_700Bold', 'Inter', 'system-ui', 'sans-serif'],
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
