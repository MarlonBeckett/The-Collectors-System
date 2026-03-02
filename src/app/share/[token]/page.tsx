import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { Motorcycle, Expense } from '@/types/database';
import { ShareShell } from '@/components/share/ShareShell';
import { ShareVehicleList } from '@/components/share/ShareVehicleList';
import { ShareExpenses } from '@/components/share/ShareExpenses';
import type { Metadata } from 'next';

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: shareLink } = await supabase
    .from('collection_share_links')
    .select('collection_id, is_active')
    .eq('token', token)
    .single();

  if (!shareLink || !shareLink.is_active) {
    return { title: 'Shared Collection' };
  }

  const { data: collection } = await supabase
    .from('collections')
    .select('name')
    .eq('id', shareLink.collection_id)
    .single();

  const title = collection?.name || 'Shared Collection';
  return {
    title,
    openGraph: { title },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Look up share link
  const { data: shareLink } = await supabase
    .from('collection_share_links')
    .select('id, collection_id, is_active, include_expenses, include_purchase_info')
    .eq('token', token)
    .single();

  if (!shareLink) {
    return notFound();
  }

  if (!shareLink.is_active) {
    return (
      <ShareShell collectionName="Shared Collection">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Link Disabled</h2>
            <p className="text-muted-foreground">This share link has been disabled by the collection owner.</p>
          </div>
        </div>
      </ShareShell>
    );
  }

  // Update last_accessed_at
  await supabase
    .from('collection_share_links')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', shareLink.id);

  // Fetch collection name
  const { data: collection } = await supabase
    .from('collections')
    .select('name')
    .eq('id', shareLink.collection_id)
    .single();

  if (!collection) {
    return notFound();
  }

  // Fetch vehicles
  const { data: vehiclesData } = await supabase
    .from('motorcycles')
    .select('*')
    .eq('collection_id', shareLink.collection_id)
    .neq('status', 'sold')
    .neq('status', 'traded')
    .order('created_at', { ascending: false });

  const vehicles = (vehiclesData || []) as Motorcycle[];

  // Fetch showcase photos and generate signed URLs
  const vehicleIds = vehicles.map(v => v.id);
  const showcaseUrls: Record<string, string> = {};

  if (vehicleIds.length > 0) {
    const { data: showcasePhotos } = await supabase
      .from('photos')
      .select('motorcycle_id, storage_path')
      .eq('is_showcase', true)
      .in('motorcycle_id', vehicleIds);

    if (showcasePhotos && showcasePhotos.length > 0) {
      const paths = showcasePhotos.map(p => p.storage_path);
      const { data: urlData } = await supabase.storage
        .from('motorcycle-photos')
        .createSignedUrls(paths, 3600);

      if (urlData) {
        urlData.forEach((item, i) => {
          if (item.signedUrl) {
            showcaseUrls[showcasePhotos[i].motorcycle_id] = item.signedUrl;
          }
        });
      }
    }
  }

  // Fetch expense data if enabled
  let serviceRecords: { id: string; motorcycle_id: string; service_date: string; title: string; category: string; cost: number }[] = [];
  let expenseDocuments: { id: string; motorcycle_id: string; title: string; document_type: string; cost: number; created_at: string }[] = [];
  let standaloneExpenses: Expense[] = [];

  if (shareLink.include_expenses && vehicleIds.length > 0) {
    const [srResult, docResult, expResult] = await Promise.all([
      supabase
        .from('service_records')
        .select('id, motorcycle_id, service_date, title, category, cost')
        .in('motorcycle_id', vehicleIds)
        .not('cost', 'is', null)
        .gt('cost', 0),
      supabase
        .from('vehicle_documents')
        .select('id, motorcycle_id, title, document_type, cost, created_at')
        .in('motorcycle_id', vehicleIds)
        .not('cost', 'is', null)
        .gt('cost', 0),
      supabase
        .from('expenses')
        .select('*')
        .in('motorcycle_id', vehicleIds),
    ]);

    serviceRecords = (srResult.data || []) as typeof serviceRecords;
    expenseDocuments = (docResult.data || []) as typeof expenseDocuments;
    standaloneExpenses = (expResult.data || []) as Expense[];
  }

  return (
    <ShareShell collectionName={collection.name}>
      <ShareVehicleList
        vehicles={vehicles}
        token={token}
        showcaseUrls={showcaseUrls}
      />
      {shareLink.include_expenses && (
        <div className="mt-8 border-t border-border pt-6">
          <ShareExpenses
            vehicles={vehicles.map(v => ({
              id: v.id,
              make: v.make,
              model: v.model,
              sub_model: v.sub_model,
              nickname: v.nickname,
              year: v.year,
              vehicle_type: v.vehicle_type,
              purchase_price: v.purchase_price,
              purchase_date: v.purchase_date,
              created_at: v.created_at,
            }))}
            serviceRecords={serviceRecords}
            documents={expenseDocuments}
            standaloneExpenses={standaloneExpenses}
            includePurchaseInfo={shareLink.include_purchase_info}
          />
        </div>
      )}
    </ShareShell>
  );
}
