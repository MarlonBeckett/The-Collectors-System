import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Motorcycle } from '@/types/database';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { getUserSubscription } from '@/lib/subscription.server';
import { isPro, FREE_VEHICLE_LIMIT } from '@/lib/subscription';


interface UserCollection {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string | null;
  owner_display_name: string | null;
  is_owner: boolean;
  role: string;
  created_at: string;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's collections using the RPC function
  let collections: UserCollection[] = [];
  if (user) {
    const { data: collectionsData } = await supabase.rpc('get_user_collections');
    collections = (collectionsData || []) as UserCollection[];
  }

  // Fetch all vehicles (RLS will filter based on collection access)
  const { data, error } = await supabase
    .from('motorcycles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching motorcycles:', error);
  }

  const vehicles = (data || []) as Motorcycle[];

  // Fetch showcase photos for the carousel and generate signed URLs server-side
  const { data: showcasePhotos } = await supabase
    .from('photos')
    .select('motorcycle_id, storage_path')
    .eq('is_showcase', true);

  const vehiclePhotoMap: Record<string, string> = {};
  if (showcasePhotos && showcasePhotos.length > 0) {
    const paths = showcasePhotos.map(p => p.storage_path);
    const { data: urlData } = await supabase.storage
      .from('motorcycle-photos')
      .createSignedUrls(paths, 3600);
    if (urlData) {
      urlData.forEach((item, i) => {
        if (item.signedUrl) {
          vehiclePhotoMap[showcasePhotos[i].motorcycle_id] = item.signedUrl;
        }
      });
    }
  }

  // Get subscription info for upgrade banner
  const subscription = await getUserSubscription();
  const isProUser = isPro(subscription);

  // Get owned collection IDs for vehicle count
  const ownedCollectionIds = collections
    .filter(c => c.is_owner)
    .map(c => c.id);

  // Count vehicles in owned collections only
  const ownedVehicleCount = vehicles.filter(v =>
    v.collection_id && ownedCollectionIds.includes(v.collection_id)
  ).length;

  const subscriptionInfo = {
    isPro: isProUser,
    vehicleCount: ownedVehicleCount,
    vehicleLimit: FREE_VEHICLE_LIMIT,
  };

  return (
    <AppShell>
      <DashboardContent
        collections={collections}
        vehicles={vehicles}
        vehiclePhotoMap={vehiclePhotoMap}
        subscriptionInfo={subscriptionInfo}
      />
    </AppShell>
  );
}
