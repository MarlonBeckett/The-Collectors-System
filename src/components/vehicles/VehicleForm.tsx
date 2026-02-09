'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Motorcycle, MotorcycleStatus, VehicleType } from '@/types/database';
import { parseFlexibleDate, formatDateForDB } from '@/lib/dateUtils';
import { PhotoUploader } from '@/components/photos/PhotoUploader';
import { CreatePhotoUploader, StagedPhoto } from '@/components/photos/CreatePhotoUploader';

interface EditableCollection {
  id: string;
  name: string;
  is_owner: boolean;
}

interface VehicleFormProps {
  vehicle?: Motorcycle;
  mode: 'create' | 'edit';
  collectionId?: string;
  collections?: EditableCollection[];
}

const vehicleTypes: { value: VehicleType; label: string }[] = [
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'car', label: 'Car' },
  { value: 'boat', label: 'Boat' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'other', label: 'Other' },
];

export function VehicleForm({ vehicle, mode, collectionId, collections }: VehicleFormProps) {
  const router = useRouter();
  const supabase = createClient();

  // For create mode: use first collection from the list if available
  const defaultCollectionId = collectionId || (collections && collections.length > 0 ? collections[0].id : null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(defaultCollectionId);

  const [vehicleType, setVehicleType] = useState<VehicleType>(vehicle?.vehicle_type || 'motorcycle');
  const [make, setMake] = useState(vehicle?.make || '');
  const [model, setModel] = useState(vehicle?.model || '');
  const [name, setName] = useState(vehicle?.name || '');
  const [nickname, setNickname] = useState(vehicle?.nickname || '');
  const [year, setYear] = useState(vehicle?.year?.toString() || '');
  const [vin, setVin] = useState(vehicle?.vin || '');
  const [plateNumber, setPlateNumber] = useState(vehicle?.plate_number || '');
  const [mileage, setMileage] = useState('');
  const [mileageDate, setMileageDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(vehicle?.notes || '');
  const [tabExpiration, setTabExpiration] = useState(
    vehicle?.tab_expiration
      ? new Date(vehicle.tab_expiration).toISOString().split('T')[0]
      : ''
  );
  const [status, setStatus] = useState<MotorcycleStatus>(vehicle?.status || 'active');
  const [maintenanceNotes, setMaintenanceNotes] = useState(vehicle?.maintenance_notes || '');
  const [purchasePrice, setPurchasePrice] = useState(vehicle?.purchase_price?.toString() || '');
  const [purchaseDate, setPurchaseDate] = useState(
    vehicle?.purchase_date
      ? new Date(vehicle.purchase_date).toISOString().split('T')[0]
      : ''
  );

  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoUploadStatus, setPhotoUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const parsedDate = parseFlexibleDate(tabExpiration);
      const mileageNum = mileage ? parseInt(mileage.replace(/,/g, '')) : null;
      const purchasePriceNum = purchasePrice ? parseFloat(purchasePrice.replace(/,/g, '')) : null;

      const vehicleData = {
        make: make || null,
        model: model || null,
        name,
        nickname: nickname || null,
        year: year ? parseInt(year) : null,
        vin: vin || null,
        plate_number: plateNumber || null,
        mileage: mileageNum ? `${mileageNum.toLocaleString()}` : null,
        notes: notes || null,
        tab_expiration: formatDateForDB(parsedDate),
        status,
        vehicle_type: vehicleType,
        maintenance_notes: status === 'maintenance' ? maintenanceNotes || null : null,
        purchase_price: purchasePriceNum,
        purchase_date: purchaseDate || null,
      };

      if (mode === 'create') {
        const { data, error } = await supabase
          .from('motorcycles')
          .insert({
            ...vehicleData,
            collection_id: selectedCollectionId,
          })
          .select()
          .single();

        if (error) throw error;

        // Add mileage history entry if mileage was provided
        if (mileageNum) {
          await supabase.from('mileage_history').insert({
            motorcycle_id: data.id,
            mileage: mileageNum,
            recorded_date: mileageDate,
          });
        }

        // Upload staged photos
        if (stagedPhotos.length > 0) {
          for (let i = 0; i < stagedPhotos.length; i++) {
            const staged = stagedPhotos[i];
            setPhotoUploadStatus(`Uploading photos (${i + 1}/${stagedPhotos.length})...`);

            const fileExt = staged.file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const storagePath = `${data.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('motorcycle-photos')
              .upload(storagePath, staged.file, {
                cacheControl: '3600',
                upsert: false,
              });

            if (uploadError) {
              console.error('Photo upload failed:', uploadError.message);
              continue;
            }

            await supabase.from('photos').insert({
              motorcycle_id: data.id,
              storage_path: storagePath,
              display_order: i,
              is_showcase: staged.isShowcase,
            });
          }
          setPhotoUploadStatus(null);
        }

        router.push(`/vehicles/${data.id}`);
      } else if (vehicle) {
        const { error } = await supabase
          .from('motorcycles')
          .update(vehicleData)
          .eq('id', vehicle.id);

        if (error) throw error;

        // Add mileage history entry if mileage was provided (new entry)
        if (mileageNum) {
          await supabase.from('mileage_history').insert({
            motorcycle_id: vehicle.id,
            mileage: mileageNum,
            recorded_date: mileageDate,
          });
        }

        router.push(`/vehicles/${vehicle.id}`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!vehicle) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('motorcycles')
        .delete()
        .eq('id', vehicle.id);

      if (error) throw error;
      router.push('/dashboard');
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

      {/* Collection Selector (create mode only) */}
      {mode === 'create' && collections && collections.length > 0 && (
        <div>
          <label htmlFor="collection" className="block text-sm font-medium mb-2">
            Add to Collection
          </label>
          {collections.length === 1 ? (
            <div className="px-4 py-3 bg-muted border border-input text-foreground">
              {collections[0].name}{collections[0].is_owner ? ' (Owner)' : ''}
            </div>
          ) : (
            <select
              id="collection"
              value={selectedCollectionId || ''}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}{collection.is_owner ? ' (Owner)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Vehicle Type Selector */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Vehicle Type
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {vehicleTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setVehicleType(type.value)}
              className={`min-h-[44px] py-3 px-2 text-sm font-medium transition-colors ${
                vehicleType === type.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Make, Model, Year - on same row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Make */}
        <div>
          <label htmlFor="make" className="block text-sm font-medium mb-2">
            Make
          </label>
          <input
            id="make"
            type="text"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g., BMW"
          />
        </div>

        {/* Model */}
        <div>
          <label htmlFor="model" className="block text-sm font-medium mb-2">
            Model
          </label>
          <input
            id="model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g., R1250GS"
          />
        </div>

        {/* Year */}
        <div>
          <label htmlFor="year" className="block text-sm font-medium mb-2">
            Year
          </label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="1900"
            max="2099"
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="2023"
          />
        </div>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Name <span className="text-destructive">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g., KTM Super Duke 990"
        />
      </div>

      {/* Nickname */}
      <div>
        <label htmlFor="nickname" className="block text-sm font-medium mb-2">
          Nickname
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g., Bumblebee"
        />
      </div>

      {/* VIN */}
      <div>
        <label htmlFor="vin" className="block text-sm font-medium mb-2">
          VIN
        </label>
        <input
          id="vin"
          type="text"
          value={vin}
          onChange={(e) => setVin(e.target.value.toUpperCase())}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring font-mono"
          placeholder="Vehicle Identification Number"
        />
      </div>

      {/* Plate Number */}
      <div>
        <label htmlFor="plateNumber" className="block text-sm font-medium mb-2">
          Plate Number
        </label>
        <input
          id="plateNumber"
          type="text"
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring font-mono"
          placeholder="License plate"
        />
      </div>

      {/* Tab Expiration */}
      <div>
        <label htmlFor="tabExpiration" className="block text-sm font-medium mb-2">
          Tab Expiration
        </label>
        <input
          id="tabExpiration"
          type="date"
          value={tabExpiration}
          onChange={(e) => setTabExpiration(e.target.value)}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Mileage */}
      <div>
        <label htmlFor="mileage" className="block text-sm font-medium mb-2">
          {mode === 'edit' ? 'Update Mileage' : 'Mileage'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            id="mileage"
            type="text"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g., 12,500"
          />
          <input
            id="mileageDate"
            type="date"
            value={mileageDate}
            onChange={(e) => setMileageDate(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {mode === 'edit' && (
          <p className="text-xs text-muted-foreground mt-1">
            Leave blank to skip updating mileage. Enter a new value to add to history.
          </p>
        )}
      </div>

      {/* Purchase Price and Date */}
      <div>
        <label htmlFor="purchasePrice" className="block text-sm font-medium mb-2">
          Purchase Price
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input
              id="purchasePrice"
              type="text"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="w-full pl-8 pr-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g., 8,500"
            />
          </div>
          <input
            id="purchaseDate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Purchase date"
          />
        </div>
      </div>

      {/* Status */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium mb-2">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as MotorcycleStatus)}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="active">Active</option>
          <option value="maintenance">Needs Maintenance</option>
          <option value="sold">Sold</option>
          <option value="traded">Traded</option>
        </select>
      </div>

      {/* Maintenance Notes (conditional) */}
      {status === 'maintenance' && (
        <div>
          <label htmlFor="maintenanceNotes" className="block text-sm font-medium mb-2">
            Maintenance Notes
          </label>
          <textarea
            id="maintenanceNotes"
            value={maintenanceNotes}
            onChange={(e) => setMaintenanceNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="What needs attention? (e.g., dead battery, carburetor needs cleaning)"
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-2">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="Additional notes..."
        />
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Photos
        </label>
        {mode === 'create' ? (
          <CreatePhotoUploader onPhotosChange={setStagedPhotos} />
        ) : vehicle ? (
          <PhotoUploader motorcycleId={vehicle.id} />
        ) : null}
      </div>

      {/* Submit Button */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !name}
          className="flex-1 min-h-[44px] py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading
            ? (photoUploadStatus || 'Saving...')
            : mode === 'create'
              ? 'Add Vehicle'
              : 'Save Changes'}
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
      {mode === 'edit' && vehicle && (
        <div className="pt-6 border-t border-border">
          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="text-destructive hover:underline text-sm"
            >
              Delete this vehicle
            </button>
          ) : (
            <div className="bg-destructive/10 border border-destructive p-4">
              <p className="text-destructive font-medium mb-3">
                Are you sure you want to delete &ldquo;{vehicle.name}&rdquo;? This cannot be undone.
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
