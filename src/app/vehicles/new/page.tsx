import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { VehicleForm } from '@/components/vehicles/VehicleForm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeftIcon, DocumentArrowDownIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { getUserSubscription } from '@/lib/subscription.server';
import { isPro, FREE_VEHICLE_LIMIT } from '@/lib/subscription';

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
    redirect('/dashboard');
  }

  // Get subscription and check vehicle limit
  const subscription = await getUserSubscription();
  const isProUser = isPro(subscription);

  // Get owned collection IDs to count vehicles
  const ownedCollectionIds = (allCollections || [])
    .filter((c: { is_owner: boolean }) => c.is_owner)
    .map((c: { id: string }) => c.id);

  let vehicleCount = 0;
  if (ownedCollectionIds.length > 0) {
    const { count } = await supabase
      .from('motorcycles')
      .select('*', { count: 'exact', head: true })
      .in('collection_id', ownedCollectionIds);
    vehicleCount = count || 0;
  }

  const atLimit = !isProUser && vehicleCount >= FREE_VEHICLE_LIMIT;

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
              Free Limit Reached
            </h2>
            <p className="text-muted-foreground mb-6">
              You&apos;ve reached the free limit of {FREE_VEHICLE_LIMIT} vehicles.
              Upgrade to Pro for unlimited vehicles.
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
