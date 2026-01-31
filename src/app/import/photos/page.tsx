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
  const { data: collections } = await supabase.rpc('get_user_collections');
  const canEdit = (collections || []).some(
    (c: { is_owner: boolean; role: string }) => c.is_owner || c.role === 'editor'
  );

  if (!canEdit) {
    redirect('/');
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/"
            className="p-2 hover:bg-muted transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bulk Photo Import</h1>
            <p className="text-muted-foreground">Import photos from organized folders</p>
          </div>
        </div>

        <BulkPhotoImport />
      </div>
    </AppShell>
  );
}
