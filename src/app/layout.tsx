import type { Metadata, Viewport } from "next";
import { Golos_Text, Unbounded } from "next/font/google";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

// Основной текст — Golos Text. Кириллица включена: интерфейс идёт на ru/uz.
const inter = Golos_Text({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

// Витринный шрифт для логотипа и крупных цифр — Unbounded. Кириллица включена:
// в отличие от Space Grotesk он её покрывает, поэтому русские витринные надписи
// не падают на основной шрифт.
const displayFont = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["500", "700", "800"],
  display: "swap",
});

// Шрифт заголовков (h1/h2) — Unbounded. Кириллица включена специально: без неё
// русские заголовки падали бы на основной шрифт и выглядели как обычный
// интерфейсный текст.
const editorialFont = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-editorial",
  weight: ["700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Benzeen — Fuel delivery for business",
    template: "%s | Benzeen",
  },
  description:
    "B2B fuel delivery platform for fleets in Tashkent. Cut fuel costs up to 30% with driver requests, per-vehicle limits, next-day delivery and automated reports.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://benzeen.uz",
  ),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Benzeen",
  },
  openGraph: {
    type: "website",
  },
};

export const viewport: Viewport = {
  // PR-C: theme-color обеих тем (Uber-restraint: белый / уголь).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#071815" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${displayFont.variable} ${editorialFont.variable} font-sans antialiased min-h-screen`}
      >
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
