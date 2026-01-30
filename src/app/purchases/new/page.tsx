import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { PurchaseForm } from '@/components/purchases/PurchaseForm';

export const dynamic = 'force-dynamic';

export default async function NewPurchasePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
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
          <h1 className="text-2xl font-bold">Add Purchase</h1>
        </div>

        <PurchaseForm
          vehicles={vehicles || []}
          mode="create"
        />
      </div>
    </div>
  );
}
