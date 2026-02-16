import { createClient } from '@/lib/supabase/server';
import type { Subscription } from './subscription';
import { FREE_VEHICLE_LIMIT } from './subscription';

/**
 * Fetches the current user's subscription. Server-side only.
 * Returns null if no subscription exists (treated as free tier).
 */
export async function getUserSubscription(): Promise<Subscription | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;

  return data as Subscription;
}

export interface CollectionCapacity {
  canAdd: boolean;
  reason: string | null;
  ownerIsPro: boolean;
  currentCount: number;
  limit: number;
}

/**
 * Checks if a collection can accept new vehicles based on the collection owner's subscription.
 * Counts vehicles across ALL collections owned by the same owner.
 */
export async function canAddVehiclesToCollection(collectionId: string): Promise<CollectionCapacity> {
  const supabase = await createClient();

  // Get collection owner
  const { data: collection } = await supabase
    .from('collections')
    .select('owner_id')
    .eq('id', collectionId)
    .single();

  if (!collection) {
    return { canAdd: false, reason: 'Collection not found', ownerIsPro: false, currentCount: 0, limit: FREE_VEHICLE_LIMIT };
  }

  // Check owner's subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', collection.owner_id)
    .single();

  const ownerIsPro = sub?.status === 'active';

  if (ownerIsPro) {
    return { canAdd: true, reason: null, ownerIsPro: true, currentCount: 0, limit: Infinity };
  }

  // Count vehicles across all collections owned by this owner
  const { data: ownedCollections } = await supabase
    .from('collections')
    .select('id')
    .eq('owner_id', collection.owner_id);

  const ownedIds = (ownedCollections || []).map(c => c.id);

  let currentCount = 0;
  if (ownedIds.length > 0) {
    const { count } = await supabase
      .from('motorcycles')
      .select('*', { count: 'exact', head: true })
      .in('collection_id', ownedIds);
    currentCount = count || 0;
  }

  const canAdd = currentCount < FREE_VEHICLE_LIMIT;
  const reason = canAdd
    ? null
    : `This collection's owner has reached the free limit of ${FREE_VEHICLE_LIMIT} vehicles. They need to upgrade to Pro for unlimited vehicles.`;

  return { canAdd, reason, ownerIsPro, currentCount, limit: FREE_VEHICLE_LIMIT };
}
