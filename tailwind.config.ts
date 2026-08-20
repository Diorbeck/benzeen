import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tiffany — the ONE accent (benzeen-design doctrine). 500 is the brand value.
        primary: {
          50: "#E6FAF8",
          100: "#C0F2EF",
          200: "#8CE7E2",
          300: "#4FD8D2",
          400: "#1FC5BF", // accent on dark surfaces
          500: "#0ABAB5", // brand accent
          600: "#089E9A", // hover
          700: "#077E7B", // active/pressed
          800: "#065E5C",
          900: "#04403F",
          950: "#032726",
        },
        // Dark petrol
        petrol: {
          500: "#0B3D2E",
          600: "#0a3628",
          700: "#092f22",
          800: "#08281c",
          900: "#062116",
        },
        // Amber accent
        amber: {
          accent: "#F59E0B",
          glow: "#FBBF24",
        },
        // Metallic
        metallic: {
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
        },
        // Deep petrol text on light + самостоятельная тёмная тема: не инверсия
        // светлой, а свой «газовый» слой с холодным подтоном, на котором
        // тиффани-акцент читается, а не выжигает глаз.
        // Тёмная часть бренда — петроль: все оттенки лежат на том же
        // сине-зелёном тоне, что и primary, поэтому текст, тёмные поверхности
        // и акцент читаются как один бренд.
        navy: {
          DEFAULT: "#0E2723", // основной текст на светлой теме (глубокий петроль)
          700: "#1F4A43", // границы / хайрлайны на тёмной
          800: "#123029", // приподнятая тёмная поверхность (hover, popover)
          900: "#0C2420", // тёмная поверхность (карточки, шапка, шиты)
          950: "#071815", // тёмный фон (петроль/газ)
        },
        // Светлая аква — второй акцент бренда: им подсвечиваются цифры,
        // показатели и вторая строка заголовка. Тиффани (primary) остаётся
        // цветом действия, поэтому кнопка и акцент не спорят друг с другом.
        sky: {
          50: "#EFFCFB",
          100: "#D6F6F4",
          200: "#AFEDEA",
          300: "#7BDFDB",
          400: "#43CBC6",
          500: "#17B2AD",
          600: "#0E918D",
          700: "#0B7370",
        },
        // Светлый фон страницы — тёплая бумага, а не холодный голубой: на ней
        // белые карточки читаются как листы на столе, а синий бренда становится
        // заметнее, чем на голубоватом фоне.
        canvas: "#F7F3EA",
        paper: {
          50: "#FCFAF5",
          100: "#F7F3EA",
          200: "#EFE9DC",
          300: "#E4DBC9",
          400: "#CFC3AB",
        },
        // Золото — тёплый акцент для второй строки заголовка, цифр и объёмов.
        // Действие остаётся синим, поэтому золото никогда не идёт на кнопки.
        gold: {
          300: "#EBC584",
          400: "#DFA94F",
          500: "#C98F2C",
          600: "#A87220",
        },
        // Semantic — success only for success, warning only for warnings.
        success: { DEFAULT: "#059669", 500: "#10b981", 600: "#059669" },
        warning: { DEFAULT: "#d97706", 500: "#f59e0b", 600: "#d97706" },
      },
      // ~1180–1240px content container, centered, comfortable gutters.
      container: {
        center: true,
        padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
        screens: { "2xl": "1240px" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: [
          "var(--font-display)",
          "var(--font-inter)",
          "system-ui",
          "sans-serif",
        ],
        editorial: ["var(--font-editorial)", "Georgia", "serif"],
        mono: ["ui-monospace", "monospace"],
      },
      // Type scale (Uber-restraint): плотно, без display-полотен.
      fontSize: {
        display: [
          "2.5rem",
          { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "700" },
        ], // 40px max — hero desktop
        title: [
          "2rem",
          { lineHeight: "1.15", letterSpacing: "-0.01em", fontWeight: "700" },
        ], // 32px — страницы
        heading: [
          "1.5rem",
          { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "600" },
        ], // 24px — секции
        subheading: ["1.0625rem", { lineHeight: "1.4", fontWeight: "600" }], // 17px
        body: ["0.9375rem", { lineHeight: "1.5", fontWeight: "400" }], // 15px
        caption: ["0.8125rem", { lineHeight: "1.4", fontWeight: "500" }], // 13px
        button: ["0.9375rem", { lineHeight: "1.2", fontWeight: "600" }],
      },
      animation: {
        "flow-slow": "flow 20s linear infinite",
        "flow-medium": "flow 12s linear infinite",
        "glow-pulse": "glow 3s ease-in-out infinite",
      },
      keyframes: {
        flow: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-subtle":
          "linear-gradient(135deg, rgba(10, 186, 181, 0.03) 0%, rgba(245, 158, 11, 0.02) 100%)",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 4px 16px -4px rgba(0, 0, 0, 0.05)",
        "soft-lg":
          "0 4px 20px -4px rgba(0, 0, 0, 0.06), 0 8px 32px -8px rgba(0, 0, 0, 0.06)",
        "glow-sm": "0 0 20px -5px rgba(10, 186, 181, 0.3)",
        "glow-md": "0 0 40px -10px rgba(10, 186, 181, 0.4)",
        "glow-amber": "0 0 30px -5px rgba(245, 158, 11, 0.3)",
        card: "0 1px 3px rgba(0, 0, 0, 0.04)",
        "card-hover":
          "0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 8px 24px -4px rgba(0, 0, 0, 0.04)",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      // Uber-restraint: прямоугольники. 8 контролы, 12 карточки, 16 шиты.
      borderRadius: {
        control: "0.5rem", // 8px — inputs, chips, buttons
        card: "0.875rem", // 14px — cards, panels
        sheet: "1rem", // 16px — bottom sheets only
      },
      transitionDuration: { DEFAULT: "200ms" },
      zIndex: {
        header: "50",
        dropdown: "60",
        sheet: "70",
        modal: "80",
        toast: "90",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
