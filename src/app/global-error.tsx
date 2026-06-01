'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Captures React rendering errors in the App Router and reports them to Sentry.
// Must be a Client Component and render its own <html>/<body>.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: '#0a1f44',
          color: '#fff',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Что-то пошло не так</h1>
          <p style={{ opacity: 0.8, lineHeight: 1.5, margin: '0 0 20px' }}>
            Произошла ошибка. Мы уже уведомлены. Попробуйте обновить страницу.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              cursor: 'pointer',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 600,
              padding: '12px 20px',
              borderRadius: 10,
              fontSize: 15,
            }}
          >
            Обновить
          </button>
        </div>
      </body>
    </html>
  );
}
