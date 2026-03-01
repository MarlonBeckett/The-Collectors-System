import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ExpensesContent } from '@/components/expenses/ExpensesContent';

interface UserCollection {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string | null;
  owner_display_name: string | null;
  is_owner: boolean;
  role: string;
  created_at: string;
}

export default async function ExpensesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: collectionsData } = await supabase.rpc('get_user_collections');
  const collections = (collectionsData || []) as UserCollection[];

  // Parallel fetch: vehicles, service records with cost, documents with cost, standalone expenses
  const [vehiclesResult, serviceRecordsResult, documentsResult, expensesResult] = await Promise.all([
    supabase
      .from('motorcycles')
      .select('id, make, model, sub_model, nickname, year, vehicle_type, purchase_price, purchase_date, collection_id, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('service_records')
      .select('id, motorcycle_id, service_date, title, category, cost')
      .not('cost', 'is', null),
    supabase
      .from('vehicle_documents')
      .select('id, motorcycle_id, title, document_type, cost, created_at')
      .not('cost', 'is', null),
    supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false }),
  ]);

  return (
    <AppShell>
      <ExpensesContent
        collections={collections}
        vehicles={vehiclesResult.data || []}
        serviceRecords={serviceRecordsResult.data || []}
        documents={documentsResult.data || []}
        standaloneExpenses={expensesResult.data || []}
      />
    </AppShell>
  );
}
