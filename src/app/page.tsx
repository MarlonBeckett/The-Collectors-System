import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { Motorcycle } from '@/types/database';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export const dynamic = 'force-dynamic';

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

  return (
    <AppShell>
      <DashboardContent
        collections={collections}
        vehicles={vehicles}
      />
    </AppShell>
  );
}
