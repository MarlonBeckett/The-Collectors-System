import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { redirect } from 'next/navigation';
import { SettingsContent } from './SettingsContent';

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
  member_count: number;
}

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get user's collections using the RPC function
  const { data: collectionsData } = await supabase.rpc('get_user_collections');
  const collections = (collectionsData || []) as UserCollection[];

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account and collections</p>
        </div>

        <SettingsContent
          user={user}
          profile={profile}
          collections={collections}
        />
      </div>
    </AppShell>
  );
}
