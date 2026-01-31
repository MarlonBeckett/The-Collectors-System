import { SupabaseClient } from '@supabase/supabase-js';
import { Collection, CollectionMember } from '@/types/database';

export interface CollectionWithRole extends Collection {
  role: 'owner' | 'editor' | 'viewer';
  member_count: number;
}

/**
 * Get the user's current collection (first one they own or are a member of)
 */
export async function getUserCollection(
  supabase: SupabaseClient
): Promise<Collection | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // First try to get a collection the user owns
  const { data: ownedCollection } = await supabase
    .from('collections')
    .select('*')
    .eq('owner_id', user.id)
    .limit(1)
    .single();

  if (ownedCollection) return ownedCollection;

  // Otherwise, get a collection they're a member of
  const { data: membership } = await supabase
    .from('collection_members')
    .select('collection_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (membership) {
    const { data: collection } = await supabase
      .from('collections')
      .select('*')
      .eq('id', membership.collection_id)
      .single();

    return collection;
  }

  return null;
}

/**
 * Get all collections a user is part of
 */
export async function getUserCollections(
  supabase: SupabaseClient
): Promise<CollectionWithRole[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get owned collections
  const { data: ownedCollections } = await supabase
    .from('collections')
    .select('*')
    .eq('owner_id', user.id);

  // Get member collections
  const { data: memberships } = await supabase
    .from('collection_members')
    .select('collection_id, role')
    .eq('user_id', user.id);

  const memberCollectionIds = (memberships || [])
    .filter((m) => !ownedCollections?.some((c) => c.id === m.collection_id))
    .map((m) => m.collection_id);

  let memberCollections: Collection[] = [];
  if (memberCollectionIds.length > 0) {
    const { data } = await supabase
      .from('collections')
      .select('*')
      .in('id', memberCollectionIds);
    memberCollections = data || [];
  }

  // Get member counts for all collections
  const allCollectionIds = [
    ...(ownedCollections || []).map((c) => c.id),
    ...memberCollectionIds,
  ];

  const memberCountMap: Record<string, number> = {};
  for (const collectionId of allCollectionIds) {
    const { count } = await supabase
      .from('collection_members')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId);
    memberCountMap[collectionId] = count || 0;
  }

  // Combine with roles
  const owned: CollectionWithRole[] = (ownedCollections || []).map((c) => ({
    ...c,
    role: 'owner' as const,
    member_count: memberCountMap[c.id] || 0,
  }));

  const member: CollectionWithRole[] = memberCollections.map((c) => {
    const membership = memberships?.find((m) => m.collection_id === c.id);
    return {
      ...c,
      role: (membership?.role || 'editor') as 'owner' | 'editor' | 'viewer',
      member_count: memberCountMap[c.id] || 0,
    };
  });

  return [...owned, ...member];
}

/**
 * Get collection members
 */
export async function getCollectionMembers(
  supabase: SupabaseClient,
  collectionId: string
): Promise<(CollectionMember & { email?: string })[]> {
  const { data: members } = await supabase
    .from('collection_members')
    .select('*')
    .eq('collection_id', collectionId);

  if (!members) return [];

  // Get user emails from profiles
  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', userIds);

  return members.map((m) => ({
    ...m,
    email: profiles?.find((p) => p.id === m.user_id)?.email || undefined,
  }));
}

/**
 * Join a collection using an invite code
 */
export async function joinCollectionByInvite(
  supabase: SupabaseClient,
  inviteCode: string
): Promise<{ success: boolean; error?: string; collection?: Collection; role?: string }> {
  const { data, error } = await supabase.rpc('join_collection_by_invite', {
    p_invite_code: inviteCode.trim().toUpperCase(),
  });

  if (error) {
    return { success: false, error: 'Failed to join collection' };
  }

  const result = data as {
    success: boolean;
    error?: string;
    collection_id?: string;
    collection_name?: string;
    role?: string;
  };

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    collection: {
      id: result.collection_id!,
      name: result.collection_name!,
      owner_id: '',
      created_at: '',
    },
    role: result.role,
  };
}

/**
 * Leave a collection
 */
export async function leaveCollection(
  supabase: SupabaseClient,
  collectionId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Check if user is the owner
  const { data: collection } = await supabase
    .from('collections')
    .select('owner_id')
    .eq('id', collectionId)
    .single();

  if (collection?.owner_id === user.id) {
    return { success: false, error: 'Owners cannot leave their collection. Transfer ownership or delete the collection.' };
  }

  // Remove membership
  const { error } = await supabase
    .from('collection_members')
    .delete()
    .eq('collection_id', collectionId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: 'Failed to leave collection' };
  }

  return { success: true };
}


/**
 * Remove a member from a collection (owner only)
 */
export async function removeMember(
  supabase: SupabaseClient,
  collectionId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Verify ownership
  const { data: collection } = await supabase
    .from('collections')
    .select('owner_id')
    .eq('id', collectionId)
    .single();

  if (collection?.owner_id !== user.id) {
    return { success: false, error: 'Only owners can remove members' };
  }

  if (memberId === user.id) {
    return { success: false, error: 'Cannot remove yourself' };
  }

  const { error } = await supabase
    .from('collection_members')
    .delete()
    .eq('collection_id', collectionId)
    .eq('user_id', memberId);

  if (error) {
    return { success: false, error: 'Failed to remove member' };
  }

  return { success: true };
}
