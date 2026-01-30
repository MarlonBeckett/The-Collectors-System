import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, PlusIcon, PencilIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';

interface Purchase {
  id: string;
  product_name: string;
  brand: string | null;
  product_type: string | null;
  price: number | null;
  purchase_date: string;
  notes: string | null;
  created_at: string;
  motorcycles: {
    id: string;
    name: string;
  } | null;
}

export default async function PurchasesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: purchases } = await supabase
    .from('vehicle_purchases')
    .select('*, motorcycles:vehicle_id(id, name)')
    .eq('user_id', user.id)
    .order('purchase_date', { ascending: false }) as { data: Purchase[] | null };

  // Group purchases by month
  const groupedPurchases: Record<string, Purchase[]> = {};
  let totalSpent = 0;

  if (purchases) {
    for (const purchase of purchases) {
      const date = new Date(purchase.purchase_date);
      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

      if (!groupedPurchases[monthKey]) {
        groupedPurchases[monthKey] = [];
      }
      groupedPurchases[monthKey].push(purchase);

      if (purchase.price) {
        totalSpent += purchase.price;
      }
    }
  }

  const formatPrice = (price: number | null) => {
    if (!price) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-muted transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Purchase History</h1>
              <p className="text-muted-foreground text-sm">
                {purchases?.length || 0} purchases
                {totalSpent > 0 && ` · ${formatPrice(totalSpent)} total`}
              </p>
            </div>
          </div>
          <Link
            href="/purchases/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Add Purchase</span>
          </Link>
        </div>

        {!purchases || purchases.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="mb-2">No purchases logged yet.</p>
            <p className="text-sm">
              Click <Link href="/purchases/new" className="text-primary hover:underline">Add Purchase</Link> above or use the <Link href="/chat" className="text-primary hover:underline">chat</Link> to log purchases.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedPurchases).map(([month, monthPurchases]) => {
              const monthTotal = monthPurchases.reduce((sum, p) => sum + (p.price || 0), 0);

              return (
                <div key={month}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      {month}
                    </h2>
                    {monthTotal > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {formatPrice(monthTotal)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {monthPurchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="flex items-start justify-between gap-4 p-4 bg-card border border-border group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {purchase.product_name}
                            </span>
                            {purchase.brand && (
                              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5">
                                {purchase.brand}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>{formatDate(purchase.purchase_date)}</span>
                            {purchase.motorcycles && (
                              <>
                                <span>·</span>
                                <Link
                                  href={`/vehicles/${purchase.motorcycles.id}`}
                                  className="hover:text-primary transition-colors"
                                >
                                  {purchase.motorcycles.name}
                                </Link>
                              </>
                            )}
                            {purchase.product_type && (
                              <>
                                <span>·</span>
                                <span className="capitalize">{purchase.product_type.replace('-', ' ')}</span>
                              </>
                            )}
                          </div>

                          {purchase.notes && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {purchase.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {purchase.price && (
                            <span className="font-semibold text-primary">
                              {formatPrice(purchase.price)}
                            </span>
                          )}
                          <Link
                            href={`/purchases/${purchase.id}/edit`}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            aria-label="Edit purchase"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
