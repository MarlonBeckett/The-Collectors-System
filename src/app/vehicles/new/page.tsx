import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { VehicleForm } from '@/components/vehicles/VehicleForm';
import { VehicleZipImport } from '@/components/import/VehicleZipImport';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { canAddVehiclesToCollection, CollectionCapacity } from '@/lib/subscription.server';
import { FREE_VEHICLE_LIMIT } from '@/lib/subscription';

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
    redirect('/dashboard');
  }

  // Check vehicle capacity for each editable collection based on collection owner's subscription
  const capacityMap: Record<string, CollectionCapacity> = {};
  for (const c of editableCollections) {
    capacityMap[c.id] = await canAddVehiclesToCollection(c.id);
  }

  const atLimit = editableCollections.every((c: { id: string }) => !capacityMap[c.id].canAdd);

  if (atLimit) {
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
            <h1 className="text-2xl font-bold text-foreground">Add Vehicle</h1>
          </div>

          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Vehicle Limit Reached
            </h2>
            <p className="text-muted-foreground mb-6">
              All your editable collections have reached the free limit of {FREE_VEHICLE_LIMIT} vehicles.
              Collection owners need to upgrade to Pro for unlimited vehicles.
            </p>
            <Link
              href="/settings#subscription"
              className="inline-block bg-primary text-primary-foreground px-6 py-3 font-medium hover:opacity-90 transition-opacity"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

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
          <h1 className="text-2xl font-bold text-foreground">Add Vehicle</h1>
        </div>

        <VehicleForm mode="create" collections={editableCollections} collectionCapacity={capacityMap} />

        {/* ZIP Import Section */}
        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Already have a TCS export?</h2>
          <VehicleZipImport collections={editableCollections} collectionCapacity={capacityMap} />
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Need to import multiple vehicles?{' '}
          <Link href="/settings#data" className="text-primary underline hover:opacity-80">
            Go to Data Management in settings
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
