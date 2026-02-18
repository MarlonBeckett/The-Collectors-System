import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { Motorcycle } from '@/types/database';
import { ShareShell } from '@/components/share/ShareShell';
import { ShareVehicleList } from '@/components/share/ShareVehicleList';

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Look up share link
  const { data: shareLink } = await supabase
    .from('collection_share_links')
    .select('id, collection_id, is_active')
    .eq('token', token)
    .single();

  if (!shareLink) {
    return notFound();
  }

  if (!shareLink.is_active) {
    return (
      <ShareShell collectionName="Shared Collection">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Link Disabled</h2>
            <p className="text-muted-foreground">This share link has been disabled by the collection owner.</p>
          </div>
        </div>
      </ShareShell>
    );
  }

  // Update last_accessed_at
  await supabase
    .from('collection_share_links')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', shareLink.id);

  // Fetch collection name
  const { data: collection } = await supabase
    .from('collections')
    .select('name')
    .eq('id', shareLink.collection_id)
    .single();

  if (!collection) {
    return notFound();
  }

  // Fetch vehicles
  const { data: vehiclesData } = await supabase
    .from('motorcycles')
    .select('*')
    .eq('collection_id', shareLink.collection_id)
    .neq('status', 'sold')
    .neq('status', 'traded')
    .order('created_at', { ascending: false });

  const vehicles = (vehiclesData || []) as Motorcycle[];

  // Fetch showcase photos and generate signed URLs
  const vehicleIds = vehicles.map(v => v.id);
  const showcaseUrls: Record<string, string> = {};

  if (vehicleIds.length > 0) {
    const { data: showcasePhotos } = await supabase
      .from('photos')
      .select('motorcycle_id, storage_path')
      .eq('is_showcase', true)
      .in('motorcycle_id', vehicleIds);

    if (showcasePhotos && showcasePhotos.length > 0) {
      const paths = showcasePhotos.map(p => p.storage_path);
      const { data: urlData } = await supabase.storage
        .from('motorcycle-photos')
        .createSignedUrls(paths, 3600);

      if (urlData) {
        urlData.forEach((item, i) => {
          if (item.signedUrl) {
            showcaseUrls[showcasePhotos[i].motorcycle_id] = item.signedUrl;
          }
        });
      }
    }
  }

  return (
    <ShareShell collectionName={collection.name}>
      <ShareVehicleList
        vehicles={vehicles}
        token={token}
        showcaseUrls={showcaseUrls}
      />
    </ShareShell>
  );
}
