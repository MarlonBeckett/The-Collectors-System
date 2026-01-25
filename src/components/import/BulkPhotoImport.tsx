'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Motorcycle } from '@/types/database';
import { FolderOpenIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface FolderMatch {
  folderName: string;
  files: File[];
  matchedBike: Motorcycle | null;
  confidence: number;
  manualOverride: string | null;
}

interface UploadProgress {
  folderName: string;
  total: number;
  completed: number;
  failed: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

export function BulkPhotoImport() {
  const [bikes, setBikes] = useState<Motorcycle[]>([]);
  const [matches, setMatches] = useState<FolderMatch[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [step, setStep] = useState<'select' | 'match' | 'uploading' | 'done'>('select');

  const supabase = createClient();

  useEffect(() => {
    const loadBikes = async () => {
      const { data } = await supabase
        .from('motorcycles')
        .select('*')
        .order('name');
      if (data) setBikes(data);
    };
    loadBikes();
  }, [supabase]);

  const fuzzyMatch = (folderName: string, bikeName: string): number => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const folder = normalize(folderName);
    const bike = normalize(bikeName);

    if (folder === bike) return 100;
    if (folder.includes(bike) || bike.includes(folder)) return 85;

    // Check word overlap
    const folderWords = new Set(folderName.toLowerCase().split(/\s+/));
    const bikeWords = new Set(bikeName.toLowerCase().split(/\s+/));
    const overlap = [...folderWords].filter((w) => bikeWords.has(w)).length;
    const totalWords = Math.max(folderWords.size, bikeWords.size);

    if (overlap > 0) {
      return Math.round((overlap / totalWords) * 70) + 15;
    }

    return 0;
  };

  const handleFolderSelect = useCallback(async () => {
    try {
      // Use File System Access API if available
      if (window.showDirectoryPicker) {
        const dirHandle = await window.showDirectoryPicker();
        const folderMatches: FolderMatch[] = [];

        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'directory') {
            const subDirHandle = await dirHandle.getDirectoryHandle(entry.name);
            const files: File[] = [];

            for await (const fileEntry of subDirHandle.values()) {
              if (fileEntry.kind === 'file') {
                const fileHandle = fileEntry as FileSystemFileHandle;
                const file = await fileHandle.getFile();
                if (file.type.startsWith('image/')) {
                  files.push(file);
                }
              }
            }

            if (files.length > 0) {
              // Find best matching bike
              let bestMatch: Motorcycle | null = null;
              let bestConfidence = 0;

              for (const bike of bikes) {
                const confidence = fuzzyMatch(entry.name, bike.name);
                if (confidence > bestConfidence) {
                  bestConfidence = confidence;
                  bestMatch = bike;
                }
              }

              folderMatches.push({
                folderName: entry.name,
                files,
                matchedBike: bestConfidence >= 50 ? bestMatch : null,
                confidence: bestConfidence,
                manualOverride: null,
              });
            }
          }
        }

        setMatches(folderMatches);
        setStep('match');
      } else {
        alert('Your browser does not support folder selection. Please use Chrome, Edge, or another modern browser.');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error selecting folder:', err);
      }
    }
  }, [bikes]);

  const handleManualMatch = (folderName: string, bikeId: string | null) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.folderName === folderName
          ? {
              ...m,
              manualOverride: bikeId,
              matchedBike: bikeId ? bikes.find((b) => b.id === bikeId) || null : null,
              confidence: bikeId ? 100 : 0,
            }
          : m
      )
    );
  };

  const startUpload = async () => {
    setStep('uploading');

    const validMatches = matches.filter(
      (m) => m.matchedBike || m.manualOverride
    );

    // Initialize progress
    const initialProgress: Record<string, UploadProgress> = {};
    validMatches.forEach((m) => {
      initialProgress[m.folderName] = {
        folderName: m.folderName,
        total: m.files.length,
        completed: 0,
        failed: 0,
        status: 'pending',
      };
    });
    setUploadProgress(initialProgress);

    // Upload each folder
    for (const match of validMatches) {
      const bikeId = match.manualOverride || match.matchedBike?.id;
      if (!bikeId) continue;

      setUploadProgress((prev) => ({
        ...prev,
        [match.folderName]: { ...prev[match.folderName], status: 'uploading' },
      }));

      // Get current max display_order
      const { data: existingPhotos } = await supabase
        .from('photos')
        .select('display_order')
        .eq('motorcycle_id', bikeId)
        .order('display_order', { ascending: false })
        .limit(1);

      let displayOrder = existingPhotos?.[0]?.display_order ?? -1;

      for (const file of match.files) {
        try {
          displayOrder++;
          const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `${bikeId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('motorcycle-photos')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          // Create photo record
          const { error: dbError } = await supabase.from('photos').insert({
            motorcycle_id: bikeId,
            storage_path: fileName,
            display_order: displayOrder,
          });

          if (dbError) {
            await supabase.storage.from('motorcycle-photos').remove([fileName]);
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
  };

  const reset = () => {
    setMatches([]);
    setUploadProgress({});
    setStep('select');
  };

  const matchedCount = matches.filter(
    (m) => m.matchedBike || m.manualOverride
  ).length;
  const totalPhotos = matches.reduce((sum, m) => sum + m.files.length, 0);

  return (
    <div className="space-y-6">
      {/* Step 1: Select Folder */}
      {step === 'select' && (
        <div>
          <button
            onClick={handleFolderSelect}
            className="w-full border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-primary transition-colors"
          >
            <FolderOpenIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-lg font-medium text-foreground">
              Select Folder
            </p>
            <p className="text-muted-foreground mt-1">
              Choose a folder containing subfolders for each motorcycle
            </p>
          </button>

          <div className="mt-4 bg-card border border-border p-4">
            <h3 className="font-semibold mb-2">Expected Structure</h3>
            <pre className="text-sm text-muted-foreground font-mono">
{`Motorcycles/
├── KTM Super Duke 990/
│   ├── IMG_1234.jpg
│   └── IMG_5678.jpg
├── BMW R1250 GS/
│   └── photo.png
└── Yamaha Vmax/
    └── ...`}
            </pre>
          </div>
        </div>
      )}

      {/* Step 2: Match Folders to Bikes */}
      {step === 'match' && (
        <div className="space-y-6">
          <div className="bg-card border border-border p-4">
            <h3 className="font-semibold mb-2">
              Found {matches.length} folders with {totalPhotos} photos
            </h3>
            <p className="text-sm text-muted-foreground">
              {matchedCount} of {matches.length} folders matched to motorcycles
            </p>
          </div>

          <div className="space-y-3">
            {matches.map((match) => (
              <div
                key={match.folderName}
                className={`border p-4 ${
                  match.matchedBike || match.manualOverride
                    ? 'border-secondary bg-secondary/5'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{match.folderName}</p>
                    <p className="text-sm text-muted-foreground">
                      {match.files.length} photo{match.files.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {match.matchedBike && !match.manualOverride && (
                    <span className="text-sm text-secondary">
                      {match.confidence}% match
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <select
                    value={match.manualOverride || match.matchedBike?.id || ''}
                    onChange={(e) =>
                      handleManualMatch(match.folderName, e.target.value || null)
                    }
                    className="w-full px-3 py-2 bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">-- Select motorcycle --</option>
                    {bikes.map((bike) => (
                      <option key={bike.id} value={bike.id}>
                        {bike.name} {bike.year ? `(${bike.year})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={startUpload}
              disabled={matchedCount === 0}
              className="flex-1 py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
            >
              Upload {matchedCount > 0 ? `${matchedCount} Folder${matchedCount !== 1 ? 's' : ''}` : 'Photos'}
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

      {/* Step 3: Uploading */}
      {(step === 'uploading' || step === 'done') && (
        <div className="space-y-4">
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
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin" />
                  ) : null}
                  <span className="text-sm text-muted-foreground">
                    {progress.completed}/{progress.total}
                    {progress.failed > 0 && (
                      <span className="text-destructive"> ({progress.failed} failed)</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted h-2">
                <div
                  className={`h-2 transition-all ${
                    progress.failed > 0 ? 'bg-destructive' : 'bg-secondary'
                  }`}
                  style={{
                    width: `${((progress.completed + progress.failed) / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}

          {step === 'done' && (
            <div className="flex gap-3">
              <a
                href="/"
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
