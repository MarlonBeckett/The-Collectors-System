import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'edge';

export const alt = 'The Collectors System';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const oxanium = await fetch(
    'https://fonts.googleapis.com/css2?family=Oxanium:wght@600&display=swap'
  ).then(res => res.text())
   .then(css => {
     const match = css.match(/src: url\((.+?)\) format/);
     return match ? fetch(match[1]).then(r => r.arrayBuffer()) : null;
   });

  const supabase = createAdminClient();

  const { data: shareLink } = await supabase
    .from('collection_share_links')
    .select('collection_id, is_active')
    .eq('token', token)
    .single();

  let collectionName = '';
  if (shareLink?.is_active) {
    const { data: collection } = await supabase
      .from('collections')
      .select('name')
      .eq('id', shareLink.collection_id)
      .single();
    collectionName = collection?.name || '';
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: '#2d2d2d',
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
            fontSize: 96,
            fontFamily: 'Oxanium',
            fontWeight: 600,
            color: '#c8c8c8',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          The Collectors System
        </div>
        {collectionName && (
          <div
            style={{
              fontSize: 36,
              fontFamily: 'Oxanium',
              fontWeight: 600,
              color: '#808080',
              textAlign: 'center',
              marginTop: '24px',
            }}
          >
            {collectionName}
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: oxanium
        ? [{ name: 'Oxanium', data: oxanium, style: 'normal' as const, weight: 600 as const }]
        : [],
    }
  );
}
