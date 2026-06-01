import type { Metadata, Viewport } from 'next';
import Script from 'next/script';

// The Telegram Mini App lives outside the i18n routing (the bot opens it
// directly at /tg). UI text is hardcoded Russian — it's a focused driver tool,
// not the public marketing site.

export const metadata: Metadata = {
  title: 'Benzeen — заказ топлива',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A1F44',
};

export default function TgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Official Telegram Mini App SDK — exposes window.Telegram.WebApp. */}
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      {children}
    </>
  );
}
