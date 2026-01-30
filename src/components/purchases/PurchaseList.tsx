'use client';

import { VehiclePurchase, Motorcycle } from '@/types/database';
import { PencilIcon, TrashIcon, LinkIcon } from '@heroicons/react/24/outline';

interface PurchaseListProps {
  purchases: (VehiclePurchase & { vehicle?: Motorcycle })[];
  onEdit: (purchase: VehiclePurchase) => void;
  onDelete: (id: string) => void;
}

const typeColors: Record<string, string> = {
  oil: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  filter: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  battery: 'bg-green-500/10 text-green-600 border-green-500/20',
  tire: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  brake: 'bg-red-500/10 text-red-600 border-red-500/20',
  chain: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  spark_plug: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  coolant: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  accessory: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  other: 'bg-muted text-muted-foreground border-border',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatPrice(price: number | null): string {
  if (price === null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

export function PurchaseList({ purchases, onEdit, onDelete }: PurchaseListProps) {
  return (
    <div className="space-y-3">
      {purchases.map(purchase => (
        <div
          key={purchase.id}
          className="bg-card border border-border p-4 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium">{purchase.product_name}</h3>
                {purchase.product_type && (
                  <span className={`px-2 py-0.5 text-xs border ${typeColors[purchase.product_type] || typeColors.other}`}>
                    {purchase.product_type.replace('_', ' ')}
                  </span>
                )}
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                {purchase.brand && <span>{purchase.brand}</span>}
                {purchase.brand && purchase.model_number && <span> &middot; </span>}
                {purchase.model_number && <span>{purchase.model_number}</span>}
              </div>

              <div className="mt-2 flex items-center gap-4 text-sm">
                {purchase.vehicle && (
                  <span className="text-foreground">
                    {purchase.vehicle.name}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {formatDate(purchase.purchase_date)}
                </span>
                {purchase.price && (
                  <span className="font-medium text-foreground">
                    {formatPrice(purchase.price)}
                  </span>
                )}
                {purchase.quantity > 1 && (
                  <span className="text-muted-foreground">
                    Qty: {purchase.quantity}
                  </span>
                )}
              </div>

              {purchase.notes && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {purchase.notes}
                </p>
              )}

              {purchase.source_url && (
                <a
                  href={purchase.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <LinkIcon className="w-3 h-3" />
                  View source
                </a>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit(purchase)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                title="Edit"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(purchase.id)}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                title="Delete"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
