'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { VehicleDocument, DocumentType } from '@/types/database';
import { formatDate } from '@/lib/dateUtils';
import {
  PlusIcon,
  FolderIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import Image from 'next/image';

interface DocumentsSectionProps {
  motorcycleId: string;
  documents: VehicleDocument[];
  canEdit?: boolean;
  initialUrls?: Record<string, string>;
}

const documentTypeLabels: Record<DocumentType, string> = {
  title: 'Title',
  registration: 'Registration',
  insurance: 'Insurance',
  receipt: 'Receipt',
  manual: 'Manual',
  other: 'Other',
};

const documentTypeColors: Record<DocumentType, string> = {
  title: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
  registration: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  insurance: 'bg-green-500/20 text-green-700 dark:text-green-400',
  receipt: 'bg-destructive/20 text-destructive',
  manual: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
  other: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
};

export function DocumentsSection({ motorcycleId, documents: initialDocuments, canEdit = true, initialUrls = {} }: DocumentsSectionProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<VehicleDocument[]>(initialDocuments);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>(initialUrls);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('other');
  const [expirationDate, setExpirationDate] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Load signed URLs for new documents not already in initialUrls
  useEffect(() => {
    const missingDocs = documents.filter(d => !documentUrls[d.id]);
    if (missingDocs.length === 0) return;
    const loadDocumentUrls = async () => {
      const paths = missingDocs.map(d => d.storage_path);
      const { data } = await supabase.storage
        .from('vehicle-documents')
        .createSignedUrls(paths, 3600);
      if (data) {
        const urls: Record<string, string> = {};
        data.forEach((item, i) => {
          if (item.signedUrl) urls[missingDocs[i].id] = item.signedUrl;
        });
        setDocumentUrls(prev => ({ ...prev, ...urls }));
      }
    };
    loadDocumentUrls();
  }, [documents, supabase]);

  const resetForm = () => {
    setTitle('');
    setDocumentType('other');
    setExpirationDate('');
    setCost('');
    setNotes('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const populateForm = (doc: VehicleDocument) => {
    setTitle(doc.title);
    setDocumentType(doc.document_type as DocumentType);
    setExpirationDate(doc.expiration_date || '');
    setCost(doc.cost != null ? String(doc.cost) : '');
    setNotes(doc.notes || '');
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    // For new documents, file is required
    if (!editingId && !selectedFile) return;

    setLoading(true);
    try {
      const parsedCost = cost ? parseFloat(cost.replace(/[,$]/g, '')) : null;

      if (editingId) {
        // Update existing document metadata only
        const { error } = await supabase
          .from('vehicle_documents')
          .update({
            title: title.trim(),
            document_type: documentType,
            expiration_date: expirationDate || null,
            cost: parsedCost && !isNaN(parsedCost) ? parsedCost : null,
            notes: notes.trim() || null,
          })
          .eq('id', editingId);

        if (error) throw error;
        setEditingId(null);
      } else {
        // Create new document with file upload
        if (!selectedFile) return;

        setUploading(true);
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'bin';
        const fileName = `${motorcycleId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('vehicle-documents')
          .upload(fileName, selectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('vehicle_documents')
          .insert({
            motorcycle_id: motorcycleId,
            title: title.trim(),
            document_type: documentType,
            expiration_date: expirationDate || null,
            cost: parsedCost && !isNaN(parsedCost) ? parsedCost : null,
            notes: notes.trim() || null,
            storage_path: fileName,
            file_name: selectedFile.name,
            file_type: selectedFile.type,
          });

        if (dbError) {
          // Rollback file upload on DB error
          await supabase.storage.from('vehicle-documents').remove([fileName]);
          throw dbError;
        }

        setIsAdding(false);
      }

      resetForm();
      router.refresh();
    } catch (err) {
      console.error('Failed to save document:', err);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return;

    setLoading(true);
    try {
      const doc = documents.find(d => d.id === docId);
      if (doc) {
        await supabase.storage.from('vehicle-documents').remove([doc.storage_path]);
      }

      const { error } = await supabase
        .from('vehicle_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;
      router.refresh();
    } catch (err) {
      console.error('Failed to delete document:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (doc: VehicleDocument) => {
    populateForm(doc);
    setEditingId(doc.id);
    setExpandedId(doc.id);
  };

  const isImageFile = (fileType: string | null) => {
    return fileType?.startsWith('image/');
  };

  const isFormOpen = isAdding || editingId;

  return (
    <div className="bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FolderIcon className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground">Documents</h2>
        </div>
        {canEdit && !isFormOpen && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="w-3 h-3" />
            Add Document
          </button>
        )}
      </div>

      {/* Summary Stats */}
      {documents.length > 0 && !isFormOpen && (
        <div className="flex gap-4 mb-3 text-sm">
          <span className="text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Add/Edit Form */}
      {isFormOpen && (
        <div className="space-y-3 mb-4 p-3 bg-muted/50 border border-border">
          <div className="text-sm font-medium mb-2">
            {editingId ? 'Edit Document' : 'New Document'}
          </div>

          {/* File Upload - only for new documents */}
          {!editingId && (
            <div className="space-y-2">
              <label className="block text-sm text-muted-foreground">
                File <span className="text-destructive">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    // Auto-fill title from filename if empty
                    if (!title.trim()) {
                      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                      setTitle(nameWithoutExt);
                    }
                  }
                }}
                className="w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm file:mr-4 file:py-1 file:px-3 file:border-0 file:text-sm file:bg-muted file:text-foreground"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          )}

          {/* Row 1: Title & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="sm:col-span-2 px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              autoFocus={!!editingId}
            />
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            >
              {Object.entries(documentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Row 2: Expiration Date & Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Expiration Date (optional)
              </label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Cost (optional)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="$0.00"
                className="w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
              />
            </div>
          </div>

          {/* Row 3: Notes */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
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
              disabled={loading || !title.trim() || (!editingId && !selectedFile)}
              className="flex-1 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-sm"
            >
              {uploading ? 'Uploading...' : loading ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Documents List */}
      {documents.length > 0 ? (
        <details className="group" open={documents.length <= 3}>
          <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            View all documents
          </summary>
          <div className="mt-3 space-y-3 max-h-[600px] overflow-y-auto">
            {documents.map((doc) => {
              const isExpanded = expandedId === doc.id;
              const isEditing = editingId === doc.id;
              return (
                <div
                  key={doc.id}
                  className={`border border-border p-3 space-y-2 ${isEditing ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{doc.title}</span>
                        <span className={`px-2 py-0.5 text-xs ${documentTypeColors[doc.document_type as DocumentType] || documentTypeColors.other}`}>
                          {documentTypeLabels[doc.document_type as DocumentType] || doc.document_type}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {doc.file_name}
                      </div>
                    </button>
                    <div className="text-right flex-shrink-0">
                      {doc.cost != null && (
                        <div className="text-sm font-mono text-foreground">
                          ${doc.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                      {doc.expiration_date && (
                        <div className="text-sm text-muted-foreground">
                          Exp. {formatDate(doc.expiration_date)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && !isEditing && (
                    <div className="border-t border-border pt-2 space-y-3">
                      {/* File Preview */}
                      <div className="flex justify-center">
                        {isImageFile(doc.file_type) && documentUrls[doc.id] ? (
                          <a
                            href={documentUrls[doc.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block max-w-sm"
                          >
                            <Image
                              src={documentUrls[doc.id]}
                              alt={doc.title}
                              width={400}
                              height={300}
                              className="object-contain border border-border"
                              unoptimized
                            />
                          </a>
                        ) : (
                          <a
                            href={documentUrls[doc.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center p-6 bg-muted border border-border hover:bg-muted/80 transition-colors"
                          >
                            <DocumentIcon className="w-12 h-12 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground mt-2">
                              {doc.file_name}
                            </span>
                            <span className="text-xs text-primary mt-1">
                              Click to open
                            </span>
                          </a>
                        )}
                      </div>

                      {/* Notes */}
                      {doc.notes && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {doc.notes}
                        </p>
                      )}

                      {/* Actions */}
                      {canEdit && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border">
                          <button
                            onClick={() => handleEdit(doc)}
                            className="flex items-center gap-1 px-2 py-1 text-xs border border-border hover:bg-muted transition-colors"
                          >
                            <PencilIcon className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
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
        <p className="text-muted-foreground text-sm">No documents yet</p>
      )}
    </div>
  );
}
