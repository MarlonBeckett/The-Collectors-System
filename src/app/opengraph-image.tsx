import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'The Collectors System — Vehicle Collection Manager';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#1a1a1a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: '#ffffff',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            The Collectors System
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#a3a3a3',
              textAlign: 'center',
              maxWidth: '800px',
              lineHeight: 1.4,
            }}
          >
            Track and manage your vehicle collection — photos, service history,
            documents, and more.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
