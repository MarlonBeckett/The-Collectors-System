'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Vehicle {
  id: string;
  name: string;
}

interface Purchase {
  id: string;
  product_name: string;
  brand: string | null;
  product_type: string | null;
  price: number | null;
  quantity: number | null;
  purchase_date: string;
  vehicle_id: string | null;
  source_url: string | null;
  notes: string | null;
}

interface PurchaseFormProps {
  purchase?: Purchase;
  vehicles: Vehicle[];
  mode: 'create' | 'edit';
}

const categories = [
  { value: 'oil', label: 'Oil' },
  { value: 'battery', label: 'Battery' },
  { value: 'filter', label: 'Filter' },
  { value: 'tires', label: 'Tires' },
  { value: 'parts', label: 'Parts' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' },
];

export function PurchaseForm({ purchase, vehicles, mode }: PurchaseFormProps) {
  const router = useRouter();

  const [productName, setProductName] = useState(purchase?.product_name || '');
  const [brand, setBrand] = useState(purchase?.brand || '');
  const [productType, setProductType] = useState(purchase?.product_type || 'other');
  const [price, setPrice] = useState(purchase?.price?.toString() || '');
  const [quantity, setQuantity] = useState(purchase?.quantity?.toString() || '1');
  const [purchaseDate, setPurchaseDate] = useState(
    purchase?.purchase_date
      ? new Date(purchase.purchase_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [vehicleId, setVehicleId] = useState(purchase?.vehicle_id || '');
  const [sourceUrl, setSourceUrl] = useState(purchase?.source_url || '');
  const [notes, setNotes] = useState(purchase?.notes || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!productName.trim()) {
      setError('Product name is required');
      return;
    }

    setLoading(true);

    try {
      const priceNum = price ? parseFloat(price.replace(/,/g, '')) : null;
      const quantityNum = quantity ? parseInt(quantity) : 1;

      const purchaseData = {
        product_name: productName.trim(),
        brand: brand.trim() || null,
        product_type: productType || 'other',
        price: priceNum,
        quantity: quantityNum,
        purchase_date: purchaseDate,
        vehicle_id: vehicleId || null,
        source_url: sourceUrl.trim() || null,
        notes: notes.trim() || null,
      };

      const method = mode === 'create' ? 'POST' : 'PATCH';
      const body = mode === 'edit' && purchase
        ? { ...purchaseData, id: purchase.id }
        : purchaseData;

      const response = await fetch('/api/purchases', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save purchase');
      }

      router.push('/purchases');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!purchase) return;

    setLoading(true);
    try {
      const response = await fetch('/api/purchases', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: purchase.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete purchase');
      }

      router.push('/purchases');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3">
          {error}
        </div>
      )}

      {/* Product Name */}
      <div>
        <label htmlFor="productName" className="block text-sm font-medium mb-2">
          Product Name <span className="text-destructive">*</span>
        </label>
        <input
          id="productName"
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          required
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g., Rotella T6 5W-40"
        />
      </div>

      {/* Brand and Category - same row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Brand */}
        <div>
          <label htmlFor="brand" className="block text-sm font-medium mb-2">
            Brand
          </label>
          <input
            id="brand"
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g., Shell"
          />
        </div>

        {/* Product Type */}
        <div>
          <label htmlFor="productType" className="block text-sm font-medium mb-2">
            Type
          </label>
          <select
            id="productType"
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Price and Quantity - same row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Price */}
        <div>
          <label htmlFor="price" className="block text-sm font-medium mb-2">
            Price
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input
              id="price"
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full pl-8 pr-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium mb-2">
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Purchase Date */}
      <div>
        <label htmlFor="purchaseDate" className="block text-sm font-medium mb-2">
          Purchase Date
        </label>
        <input
          id="purchaseDate"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Vehicle */}
      <div>
        <label htmlFor="vehicle" className="block text-sm font-medium mb-2">
          Vehicle
        </label>
        <select
          id="vehicle"
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">No vehicle selected</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.name}
            </option>
          ))}
        </select>
      </div>

      {/* Source URL */}
      <div>
        <label htmlFor="sourceUrl" className="block text-sm font-medium mb-2">
          Source URL
        </label>
        <input
          id="sourceUrl"
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="https://..."
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-2">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="Additional notes..."
        />
      </div>

      {/* Submit Button */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !productName.trim()}
          className="flex-1 min-h-[44px] py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? 'Saving...' : mode === 'create' ? 'Add Purchase' : 'Save Changes'}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="min-h-[44px] py-3 px-6 border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Delete Button (edit mode only) */}
      {mode === 'edit' && purchase && (
        <div className="pt-6 border-t border-border">
          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="text-destructive hover:underline text-sm"
            >
              Delete this purchase
            </button>
          ) : (
            <div className="bg-destructive/10 border border-destructive p-4">
              <p className="text-destructive font-medium mb-3">
                Are you sure you want to delete &ldquo;{purchase.product_name}&rdquo;? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDelete(false)}
                  className="px-4 py-2 border border-border hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
