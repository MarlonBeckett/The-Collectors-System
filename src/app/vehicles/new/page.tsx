import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { VehicleForm } from '@/components/vehicles/VehicleForm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeftIcon, DocumentArrowDownIcon, PhotoIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';

export default async function NewVehiclePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get editable collections (owner or editor role only)
  const { data: allCollections } = await supabase.rpc('get_user_collections');

  const editableCollections = (allCollections || [])
    .filter((c: { is_owner: boolean; role: string }) => c.is_owner || c.role === 'editor')
    .map((c: { id: string; name: string; is_owner: boolean }) => ({
      id: c.id,
      name: c.name,
      is_owner: c.is_owner,
    }));

  if (editableCollections.length === 0) {
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
          <h1 className="text-2xl font-bold text-foreground">Add Vehicle</h1>
        </div>

        <VehicleForm mode="create" collections={editableCollections} />

        {/* Bulk Import Section */}
        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Bulk Import</h2>
          <div className="grid gap-3">
            <Link
              href="/import"
              className="flex items-center gap-3 p-4 bg-card border border-border hover:border-primary transition-colors"
            >
              <DocumentArrowDownIcon className="w-6 h-6 text-muted-foreground" />
              <div>
                <p className="font-medium">Import from CSV</p>
                <p className="text-sm text-muted-foreground">Import multiple vehicles from a spreadsheet</p>
              </div>
            </Link>
            <Link
              href="/import/photos"
              className="flex items-center gap-3 p-4 bg-card border border-border hover:border-primary transition-colors"
            >
              <PhotoIcon className="w-6 h-6 text-muted-foreground" />
              <div>
                <p className="font-medium">Import Photos from Folder</p>
                <p className="text-sm text-muted-foreground">Bulk upload photos organized by vehicle</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
