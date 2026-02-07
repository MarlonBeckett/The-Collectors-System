import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { BulkPhotoImport } from '@/components/import/BulkPhotoImport';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';

export default async function BulkPhotoImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user has any collection they can edit
  const { data: collectionsData } = await supabase.rpc('get_user_collections');
  const editableCollections = (collectionsData || []).filter(
    (c: { is_owner: boolean; role: string }) => c.is_owner || c.role === 'editor'
  );

  if (editableCollections.length === 0) {
    redirect('/dashboard');
  }

  // Format collections for the component
  const collections = editableCollections.map((c: { id: string; name: string; is_owner: boolean }) => ({
    id: c.id,
    name: c.name,
    is_owner: c.is_owner,
  }));

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/dashboard"
            className="p-2 hover:bg-muted transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bulk Photo Import</h1>
            <p className="text-muted-foreground">Import photos from organized folders</p>
          </div>
        </div>

        <BulkPhotoImport collections={collections} />
      </div>
    </AppShell>
  );
}
