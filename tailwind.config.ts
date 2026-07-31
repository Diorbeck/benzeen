import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Deep Blue primary
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#0A1F44',
        },
        // Dark petrol
        petrol: {
          500: '#0B3D2E',
          600: '#0a3628',
          700: '#092f22',
          800: '#08281c',
          900: '#062116',
        },
        // Amber accent
        amber: {
          accent: '#F59E0B',
          glow: '#FBBF24',
        },
        // Metallic
        metallic: {
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
        },
        // Deep navy — B2C text/contrast on light surfaces.
        navy: {
          DEFAULT: '#0A1F44',
          700: '#13294f',
          800: '#0d1f3c',
          900: '#0A1F44',
          950: '#06132b',
        },
        // Semantic — success only for success, warning only for warnings.
        success: { DEFAULT: '#059669', 500: '#10b981', 600: '#059669' },
        warning: { DEFAULT: '#d97706', 500: '#f59e0b', 600: '#d97706' },
      },
      // ~1180–1240px content container, centered, comfortable gutters.
      container: {
        center: true,
        padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
        screens: { '2xl': '1240px' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
      fontSize: {
        'display': ['2.25rem', { lineHeight: '1.2', fontWeight: '700' }],
        'heading': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }],
        'button': ['0.875rem', { lineHeight: '1.2', fontWeight: '600' }],
      },
      animation: {
        'flow-slow': 'flow 20s linear infinite',
        'flow-medium': 'flow 12s linear infinite',
        'glow-pulse': 'glow 3s ease-in-out infinite',
      },
      keyframes: {
        flow: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-subtle':
          'linear-gradient(135deg, rgba(37, 99, 235, 0.03) 0%, rgba(245, 158, 11, 0.02) 100%)',
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 4px 16px -4px rgba(0, 0, 0, 0.05)',
        'soft-lg': '0 4px 20px -4px rgba(0, 0, 0, 0.06), 0 8px 32px -8px rgba(0, 0, 0, 0.06)',
        'glow-sm': '0 0 20px -5px rgba(37, 99, 235, 0.3)',
        'glow-md': '0 0 40px -10px rgba(37, 99, 235, 0.4)',
        'glow-amber': '0 0 30px -5px rgba(245, 158, 11, 0.3)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 8px 24px -4px rgba(0, 0, 0, 0.04)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      // Radius scale kept in the 12–16px range (sheets a touch larger).
      borderRadius: {
        control: '0.75rem', // 12px — inputs, chips
        card: '1rem', // 16px — cards, panels
        sheet: '1.25rem', // 20px — bottom sheets only
      },
      transitionDuration: { DEFAULT: '200ms' },
      zIndex: {
        header: '50',
        dropdown: '60',
        sheet: '70',
        modal: '80',
        toast: '90',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
