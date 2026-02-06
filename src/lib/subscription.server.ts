import { createClient } from '@/lib/supabase/server';
import type { Subscription } from './subscription';

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
