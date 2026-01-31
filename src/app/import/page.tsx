import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ImportPageContent } from './ImportPageContent';

export const dynamic = 'force-dynamic';

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
    redirect('/');
  }

  const collections = editableCollections.map(c => ({
    id: c.id,
    name: c.name,
    is_owner: c.is_owner,
  }));

  return (
    <AppShell>
      <ImportPageContent collections={collections} />
    </AppShell>
  );
}
