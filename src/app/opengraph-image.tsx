import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Benzeen — управление топливом для автопарка';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: 'linear-gradient(135deg, #0A1F44 0%, #2563eb 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 36 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 20,
              background: 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 46,
              fontWeight: 700,
            }}
          >
            B
          </div>
          <div style={{ fontSize: 60, fontWeight: 700 }}>Benzeen</div>
        </div>
        <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.15, maxWidth: 940 }}>
          Управление топливом для современного автопарка
        </div>
        <div style={{ fontSize: 30, opacity: 0.85, marginTop: 24, maxWidth: 940 }}>
          Экономия до 30% · доставка к машинам · контроль расхода в реальном времени
        </div>
      </div>
    ),
    { ...size }
  );
}
