import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { VehicleForm } from '@/components/vehicles/VehicleForm';
import { Motorcycle, CollectionRole } from '@/types/database';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';

async function getUserRoleForCollection(supabase: Awaited<ReturnType<typeof createClient>>, collectionId: string): Promise<CollectionRole | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Check if user is owner
  const { data: collection } = await supabase
    .from('collections')
    .select('owner_id')
    .eq('id', collectionId)
    .single();

  if (collection?.owner_id === user.id) return 'owner';

  // Check membership role
  const { data: membership } = await supabase
    .from('collection_members')
    .select('role')
    .eq('collection_id', collectionId)
    .eq('user_id', user.id)
    .single();

  return (membership?.role as CollectionRole) || null;
}

interface EditVehiclePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditVehiclePage({ params }: EditVehiclePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('motorcycles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return notFound();
  }

  const vehicle = data as Motorcycle;

  // Check if user can edit this vehicle
  if (vehicle.collection_id) {
    const role = await getUserRoleForCollection(supabase, vehicle.collection_id);
    if (role === 'viewer') {
      redirect(`/vehicles/${id}`);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href={`/vehicles/${id}`}
            className="p-2 hover:bg-muted transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Edit Vehicle</h1>
        </div>

        <VehicleForm vehicle={vehicle} mode="edit" />
      </div>
    </AppShell>
  );
}
