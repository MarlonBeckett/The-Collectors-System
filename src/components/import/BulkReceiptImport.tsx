'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Motorcycle, ServiceRecord } from '@/types/database';
import { matchFileToRecord } from '@/lib/importFileMatcher';
import { FolderOpenIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface UserCollection {
  id: string;
  name: string;
  is_owner: boolean;
}

interface BulkReceiptImportProps {
  collections: UserCollection[];
  onImportingChange?: (importing: boolean) => void;
}

interface FileMatch {
  file: File;
  matchedRecord: ServiceRecord | null;
  confidence: number;
}

interface FolderMatch {
  folderName: string;
  files: FileMatch[];
  matchedVehicle: Motorcycle | null;
  vehicleConfidence: number;
  manualOverride: string | null;
  serviceRecords: ServiceRecord[];
}

interface UploadProgress {
  folderName: string;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/pdf',
];

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf'].includes(ext || '');
}

export function BulkReceiptImport({ collections, onImportingChange }: BulkReceiptImportProps) {
  const [vehicles, setVehicles] = useState<Motorcycle[]>([]);
  const [matches, setMatches] = useState<FolderMatch[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [step, setStep] = useState<'select' | 'match' | 'uploading' | 'done'>('select');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultCollection = collections.find(c => c.is_owner) || collections[0];
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(defaultCollection?.id || '');

  const supabase = createClient();

  useEffect(() => {
    const loadVehicles = async () => {
      if (!selectedCollectionId) return;

      const { data } = await supabase
        .from('motorcycles')
        .select('*')
        .eq('collection_id', selectedCollectionId)
        .order('name');
      if (data) setVehicles(data);
    };
    loadVehicles();
  }, [supabase, selectedCollectionId]);

  const fuzzyMatch = (folderName: string, vehicleName: string): number => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const folder = normalize(folderName);
    const vehicle = normalize(vehicleName);

    if (folder === vehicle) return 100;
    if (folder.includes(vehicle) || vehicle.includes(folder)) return 85;

    const folderWords = new Set(folderName.toLowerCase().split(/\s+/));
    const vehicleWords = new Set(vehicleName.toLowerCase().split(/\s+/));
    const overlap = [...folderWords].filter((w) => vehicleWords.has(w)).length;
    const totalWords = Math.max(folderWords.size, vehicleWords.size);

    if (overlap > 0) {
      return Math.round((overlap / totalWords) * 70) + 15;
    }

    return 0;
  };

  const loadServiceRecordsForVehicle = useCallback(async (vehicleId: string): Promise<ServiceRecord[]> => {
    const { data } = await supabase
      .from('service_records')
      .select('*')
      .eq('motorcycle_id', vehicleId)
      .order('title');
    return data || [];
  }, [supabase]);

  const matchFilesToRecords = (files: File[], records: ServiceRecord[]): FileMatch[] => {
    const titles = records.map(r => r.title);
    return files.map(file => {
      const match = matchFileToRecord(file.name, titles);
      return {
        file,
        matchedRecord: match ? records[match.index] : null,
        confidence: match?.confidence || 0,
      };
    });
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const folderMap: Record<string, File[]> = {};

    for (const file of fileArray) {
      if (!isAcceptedFile(file)) continue;

      const relativePath = file.webkitRelativePath || file.name;
      const pathParts = relativePath.split('/').filter(p => p);

      if (relativePath.includes('__MACOSX') || relativePath.includes('/._')) continue;
      if (file.name.startsWith('.')) continue;

      let folderName: string;
      if (pathParts.length >= 2) {
        folderName = pathParts[pathParts.length - 2];
      } else {
        continue;
      }

      if (!folderMap[folderName]) {
        folderMap[folderName] = [];
      }
      folderMap[folderName].push(file);
    }

    const folderMatches: FolderMatch[] = [];

    for (const [folderName, folderFiles] of Object.entries(folderMap)) {
      if (folderFiles.length === 0) continue;

      let bestMatch: Motorcycle | null = null;
      let bestConfidence = 0;

      for (const vehicle of vehicles) {
        const confidence = fuzzyMatch(folderName, vehicle.name);
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = vehicle;
        }
      }

      const matchedVehicle = bestConfidence >= 50 ? bestMatch : null;
      let serviceRecords: ServiceRecord[] = [];
      let fileMatches: FileMatch[];

      if (matchedVehicle) {
        serviceRecords = await loadServiceRecordsForVehicle(matchedVehicle.id);
        fileMatches = matchFilesToRecords(folderFiles, serviceRecords);
      } else {
        fileMatches = folderFiles.map(f => ({ file: f, matchedRecord: null, confidence: 0 }));
      }

      folderMatches.push({
        folderName,
        files: fileMatches,
        matchedVehicle,
        vehicleConfidence: bestConfidence,
        manualOverride: null,
        serviceRecords,
      });
    }

    folderMatches.sort((a, b) => a.folderName.localeCompare(b.folderName));

    if (folderMatches.length === 0) {
      alert('No receipt folders found. Make sure your folder contains subfolders with receipt files (images or PDFs).');
      return;
    }

    setMatches(folderMatches);
    setStep('match');
  }, [vehicles, loadServiceRecordsForVehicle]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    const allFiles: File[] = [];
    const promises: Promise<void>[] = [];

    const traverseDirectory = async (entry: FileSystemEntry, path: string = ''): Promise<void> => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        return new Promise((resolve) => {
          fileEntry.file((file) => {
            const fullPath = path ? `${path}/${file.name}` : file.name;
            Object.defineProperty(file, 'webkitRelativePath', {
              value: fullPath,
              writable: false,
            });
            allFiles.push(file);
            resolve();
          }, () => resolve());
        });
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const dirReader = dirEntry.createReader();

        return new Promise((resolve) => {
          const readEntries = () => {
            dirReader.readEntries(async (entries) => {
              if (entries.length === 0) {
                resolve();
                return;
              }

              for (const childEntry of entries) {
                const childPath = path ? `${path}/${entry.name}` : entry.name;
                await traverseDirectory(childEntry, childPath);
              }

              readEntries();
            }, () => resolve());
          };
          readEntries();
        });
      }
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry();
      if (entry) {
        promises.push(traverseDirectory(entry));
      }
    }

    Promise.all(promises).then(() => {
      if (allFiles.length > 0) {
        processFiles(allFiles);
      }
    });
  }, [processFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleManualMatch = async (folderName: string, vehicleId: string | null) => {
    const folderMatch = matches.find(m => m.folderName === folderName);
    if (!folderMatch) return;

    let serviceRecords: ServiceRecord[] = [];
    let fileMatches: FileMatch[];

    if (vehicleId) {
      serviceRecords = await loadServiceRecordsForVehicle(vehicleId);
      const rawFiles = folderMatch.files.map(f => f.file);
      fileMatches = matchFilesToRecords(rawFiles, serviceRecords);
    } else {
      fileMatches = folderMatch.files.map(f => ({ file: f.file, matchedRecord: null, confidence: 0 }));
    }

    setMatches((prev) =>
      prev.map((m) =>
        m.folderName === folderName
          ? {
              ...m,
              manualOverride: vehicleId,
              matchedVehicle: vehicleId ? vehicles.find((v) => v.id === vehicleId) || null : null,
              vehicleConfidence: vehicleId ? 100 : 0,
              serviceRecords,
              files: fileMatches,
            }
          : m
      )
    );
  };

  const startUpload = async () => {
    setStep('uploading');
    onImportingChange?.(true);

    const validMatches = matches.filter(
      (m) => (m.matchedVehicle || m.manualOverride) && m.files.some(f => f.matchedRecord)
    );

    const initialProgress: Record<string, UploadProgress> = {};
    validMatches.forEach((m) => {
      initialProgress[m.folderName] = {
        folderName: m.folderName,
        total: m.files.length,
        completed: 0,
        failed: 0,
        skipped: 0,
        status: 'pending',
      };
    });
    setUploadProgress(initialProgress);

    for (const match of validMatches) {
      setUploadProgress((prev) => ({
        ...prev,
        [match.folderName]: { ...prev[match.folderName], status: 'uploading' },
      }));

      for (const fileMatch of match.files) {
        if (!fileMatch.matchedRecord) {
          setUploadProgress((prev) => ({
            ...prev,
            [match.folderName]: {
              ...prev[match.folderName],
              skipped: prev[match.folderName].skipped + 1,
            },
          }));
          continue;
        }

        try {
          const recordId = fileMatch.matchedRecord.id;
          const fileExt = fileMatch.file.name.split('.').pop()?.toLowerCase() || 'pdf';
          const storagePath = `${recordId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('service-receipts')
            .upload(storagePath, fileMatch.file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          const { error: dbError } = await supabase
            .from('service_record_receipts')
            .insert({
              service_record_id: recordId,
              storage_path: storagePath,
              file_name: fileMatch.file.name,
              file_type: fileMatch.file.type || null,
            });

          if (dbError) {
            await supabase.storage.from('service-receipts').remove([storagePath]);
            throw dbError;
          }

          setUploadProgress((prev) => ({
            ...prev,
            [match.folderName]: {
              ...prev[match.folderName],
              completed: prev[match.folderName].completed + 1,
            },
          }));
        } catch (err) {
          console.error('Upload error:', err);
          setUploadProgress((prev) => ({
            ...prev,
            [match.folderName]: {
              ...prev[match.folderName],
              failed: prev[match.folderName].failed + 1,
            },
          }));
        }
      }

      setUploadProgress((prev) => ({
        ...prev,
        [match.folderName]: { ...prev[match.folderName], status: 'done' },
      }));
    }

    setStep('done');
    onImportingChange?.(false);
  };

  const reset = () => {
    setMatches([]);
    setUploadProgress({});
    setStep('select');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const matchedFolderCount = matches.filter(
    (m) => m.matchedVehicle || m.manualOverride
  ).length;
  const totalFiles = matches.reduce((sum, m) => sum + m.files.length, 0);
  const totalFileMatches = matches.reduce(
    (sum, m) => sum + m.files.filter(f => f.matchedRecord).length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Collection Selector */}
      {collections.length > 0 && (step === 'select' || step === 'match') && (
        <div className="bg-card border border-border p-4">
          <label className="block text-sm font-medium mb-2">
            Import receipts to Collection
          </label>
          <select
            value={selectedCollectionId}
            onChange={(e) => {
              setSelectedCollectionId(e.target.value);
              setMatches([]);
              setStep('select');
            }}
            className="w-full px-4 py-3 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name} {collection.is_owner ? '(Owner)' : ''}
              </option>
            ))}
          </select>
          {vehicles.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} in this collection
            </p>
          )}
          {selectedCollectionId && vehicles.length === 0 && (
            <p className="text-sm text-destructive mt-2">
              No vehicles in this collection. Import vehicles first.
            </p>
          )}
        </div>
      )}

      {/* Step 1: Select Folder */}
      {step === 'select' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is not in the type definitions
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFileInputChange}
            className="hidden"
            id="receipt-folder-input"
          />

          <div
            onClick={() => vehicles.length > 0 && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed p-8 text-center transition-colors ${
              vehicles.length === 0
                ? 'border-border opacity-50 cursor-not-allowed'
                : isDragging
                ? 'border-primary bg-primary/5 cursor-pointer'
                : 'border-border hover:border-primary cursor-pointer'
            }`}
          >
            <FolderOpenIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-lg font-medium text-foreground">
              {isDragging ? 'Drop folder here...' : 'Drop your receipt folder here'}
            </p>
            <p className="text-muted-foreground mt-1">
              or tap to select a folder
            </p>
          </div>

          <div className="mt-4 bg-card border border-border p-4">
            <h3 className="font-semibold mb-2">Folder Structure</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Organize receipt files in folders named after each vehicle.
              Filenames should match service record titles:
            </p>
            <pre className="text-sm text-muted-foreground font-mono">
{`My Receipts/
├── Honda CBR 650 F/
│   ├── Oil Change.pdf
│   ├── Tire Replacement.jpg
│   └── Annual Inspection.pdf
├── BMW R1250 GS/
│   └── Brake Service.pdf
└── Yamaha Vmax/
    └── ...`}
            </pre>
            <p className="text-xs text-muted-foreground mt-2">
              Files named like &ldquo;2019-Honda-CBR650F-Oil Change.pdf&rdquo; are also supported.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Match Folders to Vehicles & Files to Service Records */}
      {step === 'match' && (
        <div className="space-y-6">
          <div className="bg-card border border-border p-4">
            <h3 className="font-semibold mb-2">
              Found {matches.length} folder{matches.length !== 1 ? 's' : ''} with {totalFiles} file{totalFiles !== 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-muted-foreground">
              {matchedFolderCount} of {matches.length} folders matched to vehicles
              {totalFileMatches > 0 && ` \u2022 ${totalFileMatches} file${totalFileMatches !== 1 ? 's' : ''} matched to service records`}
            </p>
          </div>

          <div className="space-y-3">
            {matches.map((match) => (
              <div
                key={match.folderName}
                className={`border p-4 ${
                  match.matchedVehicle || match.manualOverride
                    ? 'border-secondary bg-secondary/5'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{match.folderName}</p>
                    <p className="text-sm text-muted-foreground">
                      {match.files.length} file{match.files.length !== 1 ? 's' : ''}
                      {match.files.filter(f => f.matchedRecord).length > 0 && (
                        <span className="text-secondary">
                          {' '}&bull; {match.files.filter(f => f.matchedRecord).length} matched to records
                        </span>
                      )}
                    </p>
                  </div>

                  {match.matchedVehicle && !match.manualOverride && (
                    <span className="text-sm text-secondary">
                      {match.vehicleConfidence}% match
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <select
                    value={match.manualOverride || match.matchedVehicle?.id || ''}
                    onChange={(e) =>
                      handleManualMatch(match.folderName, e.target.value || null)
                    }
                    className="w-full px-3 py-2 bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">-- Select vehicle --</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} {vehicle.year ? `(${vehicle.year})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Per-file matching display */}
                {(match.matchedVehicle || match.manualOverride) && match.serviceRecords.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">File &rarr; Service Record Matching:</p>
                    <div className="space-y-1">
                      {match.files.map((fm, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          {fm.matchedRecord ? (
                            <CheckCircleIcon className="w-4 h-4 text-secondary flex-shrink-0" />
                          ) : (
                            <XCircleIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="truncate flex-1">{fm.file.name}</span>
                          {fm.matchedRecord ? (
                            <span className="text-secondary flex-shrink-0">
                              &rarr; {fm.matchedRecord.title}
                            </span>
                          ) : (
                            <span className="text-muted-foreground flex-shrink-0">unmatched</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(match.matchedVehicle || match.manualOverride) && match.serviceRecords.length === 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No service records found for this vehicle. Import service records via CSV first.
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={startUpload}
              disabled={totalFileMatches === 0}
              className="flex-1 py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
            >
              Upload {totalFileMatches > 0 ? `${totalFileMatches} Matched File${totalFileMatches !== 1 ? 's' : ''}` : 'Receipts'}
            </button>
            <button
              onClick={reset}
              className="py-3 px-6 border border-border hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 3/4: Uploading & Done */}
      {(step === 'uploading' || step === 'done') && (
        <div className="space-y-4">
          {step === 'uploading' && (
            <p className="text-xs text-destructive font-medium">Don&apos;t leave this page or progress will be lost. This may take a little while.</p>
          )}

          {step === 'done' && (
            <div className="bg-secondary/10 border border-secondary p-4 text-center">
              <CheckCircleIcon className="w-10 h-10 mx-auto text-secondary mb-2" />
              <p className="font-semibold">Upload Complete</p>
            </div>
          )}

          {Object.values(uploadProgress).map((progress) => (
            <div
              key={progress.folderName}
              className="border border-border p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">{progress.folderName}</p>
                <div className="flex items-center gap-2">
                  {progress.status === 'done' ? (
                    <CheckCircleIcon className="w-5 h-5 text-secondary" />
                  ) : progress.status === 'error' ? (
                    <XCircleIcon className="w-5 h-5 text-destructive" />
                  ) : progress.status === 'uploading' ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  <span className="text-sm text-muted-foreground">
                    {progress.completed}/{progress.total - progress.skipped}
                    {progress.skipped > 0 && (
                      <span> ({progress.skipped} skipped)</span>
                    )}
                    {progress.failed > 0 && (
                      <span className="text-destructive"> ({progress.failed} failed)</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted h-2 rounded-full">
                <div
                  className={`h-2 rounded-full transition-all ${
                    progress.failed > 0 ? 'bg-destructive' : 'bg-secondary'
                  }`}
                  style={{
                    width: `${((progress.completed + progress.failed) / Math.max(progress.total - progress.skipped, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}

          {step === 'done' && (
            <div className="flex gap-3">
              <a
                href="/dashboard"
                className="flex-1 py-3 px-4 bg-primary text-primary-foreground font-semibold text-center hover:opacity-90"
              >
                View Collection
              </a>
              <button
                onClick={reset}
                className="py-3 px-6 border border-border hover:bg-muted"
              >
                Import More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
