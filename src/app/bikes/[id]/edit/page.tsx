import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { BikeForm } from '@/components/bikes/BikeForm';
import { Motorcycle } from '@/types/database';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';

interface EditBikePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBikePage({ params }: EditBikePageProps) {
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

  const bike = data as Motorcycle;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href={`/bikes/${id}`}
            className="p-2 hover:bg-muted transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Edit Motorcycle</h1>
        </div>

        <BikeForm bike={bike} mode="edit" />
      </div>
    </AppShell>
  );
}
