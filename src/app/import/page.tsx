import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ImportPageContent } from './ImportPageContent';
import { canAddVehiclesToCollection } from '@/lib/subscription.server';
import { FREE_VEHICLE_LIMIT } from '@/lib/subscription';

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

  // Check vehicle capacity for each editable collection based on collection owner's subscription
  // Use the first collection that has capacity (or fall back to the first collection's owner info)
  // We check the default collection (first one) for the subscription info passed to ImportPageContent
  const defaultCollection = collections[0];
  const capacity = await canAddVehiclesToCollection(defaultCollection.id);

  const subscriptionInfo = {
    isPro: capacity.ownerIsPro,
    vehicleCount: capacity.currentCount,
    vehicleLimit: FREE_VEHICLE_LIMIT,
  };

  return (
    <AppShell>
      <ImportPageContent collections={collections} subscriptionInfo={subscriptionInfo} />
    </AppShell>
  );
}
