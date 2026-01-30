import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { PurchaseForm } from '@/components/purchases/PurchaseForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPurchasePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch the purchase
  const { data: purchase } = await supabase
    .from('vehicle_purchases')
    .select('*')
    .eq('id', id)
    .single();

  if (!purchase) {
    notFound();
  }

  // Verify ownership
  if (purchase.user_id !== user.id) {
    redirect('/purchases');
  }

  // Get user's vehicles for the dropdown
  const { data: vehicles } = await supabase
    .from('motorcycles')
    .select('id, name')
    .order('name');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/purchases"
            className="p-2 hover:bg-muted transition-colors"
            aria-label="Back to purchases"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Edit Purchase</h1>
        </div>

        <PurchaseForm
          purchase={purchase}
          vehicles={vehicles || []}
          mode="edit"
        />
      </div>
    </div>
  );
}
