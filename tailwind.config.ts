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
        // Cobalt — the ONE accent (benzeen-design doctrine). 600 is the brand value.
        primary: {
          50: '#F0F4FF',
          100: '#DEE7FF',
          200: '#C3D3FF',
          300: '#9DB5FF',
          400: '#6B8AFF', // accent on dark surfaces
          500: '#4A6EFF',
          600: '#2E5BFF', // brand accent
          700: '#2450E6', // hover
          800: '#1D41C4', // active/pressed
          900: '#1A379E',
          950: '#13224F',
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
        // Near-black text on light + самостоятельная тёмная тема: не инверсия
        // светлой, а свой «чернильный» слой с холодным подтоном, на котором
        // кобальтовый акцент читается, а не выжигает глаз.
        // Тёмная часть бренда — синяя, а не чёрная: владелец просил вернуть
        // синий как основной цвет и убрать чёрный. Все оттенки лежат на том же
        // синем тоне, что и primary, поэтому текст, тёмные поверхности и акцент
        // читаются как один бренд.
        navy: {
          DEFAULT: '#16224A', // основной текст на светлой теме (глубокий синий)
          700: '#27386B', // границы / хайрлайны на тёмной
          800: '#1B2850', // приподнятая тёмная поверхность (hover, popover)
          900: '#141F41', // тёмная поверхность (карточки, шапка, шиты)
          950: '#0C1430', // тёмный фон (синие чернила)
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
        display: ['var(--font-display)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
      // Type scale (Uber-restraint): плотно, без display-полотен.
      fontSize: {
        'display': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.01em', fontWeight: '700' }], // 40px max — hero desktop
        'title': ['2rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '700' }], // 32px — страницы
        'heading': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '600' }], // 24px — секции
        'subheading': ['1.0625rem', { lineHeight: '1.4', fontWeight: '600' }], // 17px
        'body': ['0.9375rem', { lineHeight: '1.5', fontWeight: '400' }], // 15px
        'caption': ['0.8125rem', { lineHeight: '1.4', fontWeight: '500' }], // 13px
        'button': ['0.9375rem', { lineHeight: '1.2', fontWeight: '600' }],
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
      // Uber-restraint: прямоугольники. 8 контролы, 12 карточки, 16 шиты.
      borderRadius: {
        control: '0.5rem', // 8px — inputs, chips, buttons
        card: '0.75rem', // 12px — cards, panels
        sheet: '1rem', // 16px — bottom sheets only
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
