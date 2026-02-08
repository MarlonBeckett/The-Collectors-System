'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ServiceRecord, ServiceCategory, ServiceRecordReceipt } from '@/types/database';
import { formatDate } from '@/lib/dateUtils';
import {
  PlusIcon,
  WrenchScrewdriverIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  DocumentIcon,
  PhotoIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';

interface ServiceRecordWithReceipts extends ServiceRecord {
  receipts?: ServiceRecordReceipt[];
}

interface ServiceRecordsSectionProps {
  motorcycleId: string;
  serviceRecords: ServiceRecordWithReceipts[];
  canEdit?: boolean;
  initialReceiptUrls?: Record<string, string>;
}

const categoryLabels: Record<ServiceCategory, string> = {
  maintenance: 'Maintenance',
  repair: 'Repair',
  upgrade: 'Upgrade',
  inspection: 'Inspection',
};

const categoryColors: Record<ServiceCategory, string> = {
  maintenance: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  repair: 'bg-red-500/20 text-red-700 dark:text-red-400',
  upgrade: 'bg-green-500/20 text-green-700 dark:text-green-400',
  inspection: 'bg-destructive/20 text-destructive',
};

export function ServiceRecordsSection({ motorcycleId, serviceRecords: initialRecords, canEdit = true, initialReceiptUrls = {} }: ServiceRecordsSectionProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [serviceRecords, setServiceRecords] = useState<ServiceRecordWithReceipts[]>(initialRecords);
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>(initialReceiptUrls);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('maintenance');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [cost, setCost] = useState('');
  const [odometer, setOdometer] = useState('');
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');

  // Load receipt URLs only for new receipts not already in initialReceiptUrls
  useEffect(() => {
    const allReceipts = serviceRecords.flatMap(
      r => (r.receipts || []).map(receipt => receipt)
    );
    const missingReceipts = allReceipts.filter(r => !receiptUrls[r.id]);
    if (missingReceipts.length === 0) return;
    const loadReceiptUrls = async () => {
      const paths = missingReceipts.map(r => r.storage_path);
      const { data } = await supabase.storage
        .from('service-receipts')
        .createSignedUrls(paths, 3600);
      if (data) {
        const urls: Record<string, string> = {};
        data.forEach((item, i) => {
          if (item.signedUrl) urls[missingReceipts[i].id] = item.signedUrl;
        });
        setReceiptUrls(prev => ({ ...prev, ...urls }));
      }
    };
    loadReceiptUrls();
  }, [serviceRecords, supabase]);

  const resetForm = () => {
    setTitle('');
    setCategory('maintenance');
    setServiceDate(new Date().toISOString().split('T')[0]);
    setCost('');
    setOdometer('');
    setShopName('');
    setDescription('');
  };

  const populateForm = (record: ServiceRecord) => {
    setTitle(record.title);
    setCategory(record.category as ServiceCategory);
    setServiceDate(record.service_date);
    setCost(record.cost?.toString() || '');
    setOdometer(record.odometer?.toString() || '');
    setShopName(record.shop_name || '');
    setDescription(record.description || '');
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    setLoading(true);
    try {
      const costNum = cost ? parseFloat(cost.replace(/[,$]/g, '')) : null;
      const odometerNum = odometer ? parseInt(odometer.replace(/,/g, '')) : null;

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('service_records')
          .update({
            title: title.trim(),
            category,
            service_date: serviceDate,
            cost: costNum,
            odometer: odometerNum,
            shop_name: shopName.trim() || null,
            description: description.trim() || null,
          })
          .eq('id', editingId);

        if (error) throw error;
        setEditingId(null);
      } else {
        // Create new
        const { error } = await supabase.from('service_records').insert({
          motorcycle_id: motorcycleId,
          title: title.trim(),
          category,
          service_date: serviceDate,
          cost: costNum,
          odometer: odometerNum,
          shop_name: shopName.trim() || null,
          description: description.trim() || null,
        });

        if (error) throw error;
        setIsAdding(false);
      }

      resetForm();
      router.refresh();
    } catch (err) {
      console.error('Failed to save service record:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm('Delete this service record? This cannot be undone.')) return;

    setLoading(true);
    try {
      // Get receipts to delete from storage
      const record = serviceRecords.find(r => r.id === recordId);
      if (record?.receipts) {
        const paths = record.receipts.map(r => r.storage_path);
        if (paths.length > 0) {
          await supabase.storage.from('service-receipts').remove(paths);
        }
      }

      const { error } = await supabase
        .from('service_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;
      router.refresh();
    } catch (err) {
      console.error('Failed to delete service record:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (record: ServiceRecord) => {
    populateForm(record);
    setEditingId(record.id);
    setExpandedId(record.id);
  };

  const handleReceiptUpload = async (recordId: string, files: FileList) => {
    setUploadingReceipt(recordId);
    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${recordId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('service-receipts')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('service_record_receipts')
          .insert({
            service_record_id: recordId,
            storage_path: fileName,
            file_name: file.name,
            file_type: file.type,
          });

        if (dbError) {
          await supabase.storage.from('service-receipts').remove([fileName]);
          throw dbError;
        }
      }
      router.refresh();
    } catch (err) {
      console.error('Failed to upload receipt:', err);
    } finally {
      setUploadingReceipt(null);
    }
  };

  const handleDeleteReceipt = async (receipt: ServiceRecordReceipt) => {
    if (!confirm('Delete this receipt?')) return;

    try {
      await supabase.storage.from('service-receipts').remove([receipt.storage_path]);
      await supabase.from('service_record_receipts').delete().eq('id', receipt.id);
      router.refresh();
    } catch (err) {
      console.error('Failed to delete receipt:', err);
    }
  };

  const isImageFile = (fileType: string | null) => {
    return fileType?.startsWith('image/');
  };

  // Calculate totals
  const totalSpent = serviceRecords.reduce((sum, r) => sum + (r.cost || 0), 0);

  const isFormOpen = isAdding || editingId;

  return (
    <div className="bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <WrenchScrewdriverIcon className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground">Service History</h2>
        </div>
        {canEdit && !isFormOpen && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="w-3 h-3" />
            Add Service
          </button>
        )}
      </div>

      {/* Summary Stats */}
      {serviceRecords.length > 0 && !isFormOpen && (
        <div className="flex gap-4 mb-3 text-sm">
          <span className="text-muted-foreground">
            {serviceRecords.length} record{serviceRecords.length !== 1 ? 's' : ''}
          </span>
          {totalSpent > 0 && (
            <span className="text-muted-foreground">
              ${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
            </span>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {isFormOpen && (
        <div className="space-y-3 mb-4 p-3 bg-muted/50 border border-border">
          <div className="text-sm font-medium mb-2">
            {editingId ? 'Edit Service Record' : 'New Service Record'}
          </div>

          {/* Row 1: Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Service title (e.g., Oil Change)"
              className="sm:col-span-2 px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              autoFocus
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ServiceCategory)}
              className="px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Row 2: Date, Cost, Odometer */}
          <div className="grid grid-cols-3 gap-2">
            <input
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              className="px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
            <input
              type="text"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="Cost ($)"
              className="px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
            <input
              type="text"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder="Odometer"
              className="px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          {/* Row 3: Shop Name */}
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Shop/Location (optional)"
            className="w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />

          {/* Row 4: Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description/Notes (optional)"
            rows={2}
            className="w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
          />

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 py-2 border border-border hover:bg-muted transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !title.trim()}
              className="flex-1 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-sm"
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Service Records List */}
      {serviceRecords.length > 0 ? (
        <details className="group" open={serviceRecords.length <= 3}>
          <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            View all records
          </summary>
          <div className="mt-3 space-y-3 max-h-[600px] overflow-y-auto">
            {serviceRecords.map((record) => {
              const isExpanded = expandedId === record.id;
              const isEditing = editingId === record.id;

              return (
                <div
                  key={record.id}
                  className={`border border-border p-3 space-y-2 ${isEditing ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{record.title}</span>
                        <span className={`px-2 py-0.5 text-xs ${categoryColors[record.category as ServiceCategory] || categoryColors.maintenance}`}>
                          {categoryLabels[record.category as ServiceCategory] || record.category}
                        </span>
                        {record.receipts && record.receipts.length > 0 && (
                          <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground">
                            {record.receipts.length} receipt{record.receipts.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatDate(record.service_date)}
                        {record.shop_name && <span> · {record.shop_name}</span>}
                      </div>
                    </button>
                    <div className="text-right flex-shrink-0">
                      {record.cost !== null && (
                        <div className="font-mono font-medium">
                          ${record.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                      {record.odometer !== null && (
                        <div className="text-xs text-muted-foreground">
                          {record.odometer.toLocaleString()} mi
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && !isEditing && (
                    <div className="border-t border-border pt-2 space-y-3">
                      {/* Description */}
                      {record.description && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {record.description}
                        </p>
                      )}

                      {/* Receipts */}
                      {record.receipts && record.receipts.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">Receipts</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {record.receipts.map((receipt) => (
                              <div key={receipt.id} className="relative group/receipt border border-border">
                                {isImageFile(receipt.file_type) && receiptUrls[receipt.id] ? (
                                  <a
                                    href={receiptUrls[receipt.id]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block aspect-square relative"
                                  >
                                    <Image
                                      src={receiptUrls[receipt.id]}
                                      alt={receipt.file_name}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={receiptUrls[receipt.id]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block aspect-square bg-muted flex flex-col items-center justify-center p-2"
                                  >
                                    <DocumentIcon className="w-8 h-8 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground mt-1 truncate w-full text-center">
                                      {receipt.file_name}
                                    </span>
                                  </a>
                                )}
                                {canEdit && (
                                  <button
                                    onClick={() => handleDeleteReceipt(receipt)}
                                    className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground opacity-0 group-hover/receipt:opacity-100 transition-opacity"
                                    aria-label="Delete receipt"
                                  >
                                    <XMarkIcon className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {canEdit && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border">
                          <label className="flex items-center gap-1 px-2 py-1 text-xs border border-border hover:bg-muted cursor-pointer transition-colors">
                            <PhotoIcon className="w-3 h-3" />
                            {uploadingReceipt === record.id ? 'Uploading...' : 'Add Receipt'}
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              multiple
                              className="hidden"
                              disabled={uploadingReceipt === record.id}
                              onChange={(e) => {
                                if (e.target.files?.length) {
                                  handleReceiptUpload(record.id, e.target.files);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                          <button
                            onClick={() => handleEdit(record)}
                            className="flex items-center gap-1 px-2 py-1 text-xs border border-border hover:bg-muted transition-colors"
                          >
                            <PencilIcon className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            disabled={loading}
                            className="flex items-center gap-1 px-2 py-1 text-xs border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          >
                            <TrashIcon className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      ) : !isFormOpen && (
        <p className="text-muted-foreground text-sm">No service records yet</p>
      )}
    </div>
  );
}
