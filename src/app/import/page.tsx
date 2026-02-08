import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ImportPageContent } from './ImportPageContent';
import { getUserSubscription } from '@/lib/subscription.server';
import { isPro, FREE_VEHICLE_LIMIT } from '@/lib/subscription';

interface UserCollection {
  id: string;
  name: string;
  is_owner: boolean;
  role: string;
}

export default async function ImportPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get user's collections using the RPC function
  const { data: collectionsData } = await supabase.rpc('get_user_collections');
  const allCollections = (collectionsData || []) as { id: string; name: string; is_owner: boolean; role: string }[];

  // Only allow importing to collections where user has edit access
  const editableCollections = allCollections.filter(c => c.is_owner || c.role === 'editor');

  // If user has no editable collections, redirect
  if (editableCollections.length === 0) {
    redirect('/dashboard');
  }

  const collections = editableCollections.map(c => ({
    id: c.id,
    name: c.name,
    is_owner: c.is_owner,
  }));

  // Get subscription info for vehicle limits
  const subscription = await getUserSubscription();
  const isProUser = isPro(subscription);

  // Get owned collection IDs to count vehicles
  const ownedCollectionIds = allCollections
    .filter(c => c.is_owner)
    .map(c => c.id);

  let vehicleCount = 0;
  if (ownedCollectionIds.length > 0) {
    const { count } = await supabase
      .from('motorcycles')
      .select('*', { count: 'exact', head: true })
      .in('collection_id', ownedCollectionIds);
    vehicleCount = count || 0;
  }

  const subscriptionInfo = {
    isPro: isProUser,
    vehicleCount,
    vehicleLimit: FREE_VEHICLE_LIMIT,
  };

  return (
    <AppShell>
      <ImportPageContent collections={collections} subscriptionInfo={subscriptionInfo} />
    </AppShell>
  );
}
