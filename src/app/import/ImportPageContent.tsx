'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CSVImport } from '@/components/import/CSVImport';
import { ZipExport } from '@/components/import/ZipExport';
import { BulkPhotoImport } from '@/components/import/BulkPhotoImport';
import { BulkDocumentImport } from '@/components/import/BulkDocumentImport';
import { BulkReceiptImport } from '@/components/import/BulkReceiptImport';
import Link from 'next/link';
import { ArrowLeftIcon, SparklesIcon, ClipboardDocumentIcon, CheckIcon, ArchiveBoxIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

type Tab = 'import' | 'export';
type ImportSource = null | 'zip' | 'csv';

interface UserCollection {
  id: string;
  name: string;
  is_owner: boolean;
}

interface SubscriptionInfo {
  isPro: boolean;
  vehicleCount: number;
  vehicleLimit: number;
}

interface ImportPageContentProps {
  collections: UserCollection[];
  subscriptionInfo: SubscriptionInfo;
}

const AI_PROMPT = `I need help preparing my vehicle collection for import into The Collectors System app.

First, ask me: Do you already have a spreadsheet, list, or document with your vehicle information? Or are we starting from scratch?

---

## IF I HAVE AN EXISTING SPREADSHEET/LIST:

I'll share it with you. Then help me create:

1. **A CSV file** matching The Collectors System's exact format
2. **A ZIP file** with photos organized into folders that exactly match the vehicle names in the CSV (I can drag and drop the ZIP directly into the app)

### CSV Format Required:
Headers (in order): name,make,model,year,vehicle_type,vin,plate_number,mileage,tab_expiration,status,notes,purchase_price,purchase_date,nickname,maintenance_notes

- **name** (REQUIRED): Display name (e.g., "Honda CBR 650 F")
- **make**: Manufacturer (Honda, BMW, Harley, etc.)
- **model**: Model name/number
- **year**: 4-digit year
- **vehicle_type**: motorcycle, car, boat, trailer, or other
- **vin**: Vehicle identification number
- **plate_number**: License plate
- **mileage**: Odometer reading
- **tab_expiration**: Registration expiration (MM/DD/YYYY or YYYY-MM-DD)
- **status**: active, sold, traded, or maintenance
- **notes**: General notes (e.g., "SOLD 7/25/2024 - $12,000")
- **purchase_price**: Numbers only, no $ sign
- **purchase_date**: MM/DD/YYYY or YYYY-MM-DD
- **nickname**: Friendly name (e.g., "Bumblebee")
- **maintenance_notes**: Service history or needs

### Photo Folder Structure:
Create a main folder containing subfolders for each vehicle. **Subfolder names must EXACTLY match the "name" column in the CSV.**

Example:
My Collection/
├── Honda CBR 650 F/
│   ├── IMG_0001.jpg
│   └── IMG_0002.jpg
├── BMW R1250 GS/
│   └── photo1.png
└── Yamaha Vmax/
    └── side_view.jpg

Photo formats: JPG, PNG, WebP, HEIC (max 10MB each)

---

## IF I'M STARTING FROM SCRATCH:

Ask me about my vehicles one by one. I'll tell you what I have, and you'll create:

1. **A formatted CSV** ready to import
2. **A folder naming checklist** so I can organize my photos correctly

Then after I take photos, help me verify the folder names match exactly before I upload.

---

## IMPORTANT NOTES:

- Avoid these characters in vehicle names: : / \\ ?
- The folder names and CSV names must match EXACTLY for automatic photo matching
- If I already have photos organized in folders, help me rename them to match the CSV

Let's get started!`;

function AIPromptHelper() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 p-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <SparklesIcon className="w-5 h-5 text-purple-500" />
        <span className="font-medium">Need help preparing your data?</span>
        <span className="text-sm text-muted-foreground ml-auto">
          {isExpanded ? 'Hide' : 'Show'} AI prompt
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Copy this prompt and paste it into Claude, ChatGPT, or any AI assistant.
            It will help you create a properly formatted CSV and organize your photos.
          </p>

          <div className="relative">
            <pre className="bg-background border border-border p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
              {AI_PROMPT}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-2 bg-background border border-border hover:bg-muted transition-colors"
              title="Copy prompt"
            >
              {copied ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ClipboardDocumentIcon className="w-4 h-4" />
              )}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            After the AI helps you create your CSV and organize photos, come back here to import them.
          </p>
        </div>
      )}
    </div>
  );
}

function ImportTabs({ collections, subscriptionInfo }: ImportPageContentProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam === 'export' ? 'export' : 'import'
  );
  const [importSource, setImportSource] = useState<ImportSource>(null);
  const [csvStep, setCsvStep] = useState<string>('upload');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (tabParam === 'export') {
      setActiveTab('export');
    }
  }, [tabParam]);

  // If there's a pending export in IndexedDB (survived a page refresh),
  // auto-switch to the export tab so the user sees the download link.
  useEffect(() => {
    if (activeTab === 'export') return; // already there
    let cancelled = false;
    import('@/lib/exportStore').then(({ hasPendingExport }) =>
      hasPendingExport().then((has) => {
        if (!cancelled && has) {
          setActiveTab('export');
          // Update URL so subsequent refreshes also land on the export tab
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'export');
          window.history.replaceState({}, '', url.toString());
        }
      })
    );
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCsvStepChange = useCallback((step: string) => {
    setCsvStep(step);
    setIsImporting(step === 'importing');
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === 'export') {
      url.searchParams.set('tab', 'export');
    } else {
      url.searchParams.delete('tab');
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  const handleBulkImportingChange = useCallback((importing: boolean) => {
    setIsImporting(importing);
  }, []);

  const csvImportDone = csvStep === 'done';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/settings"
          className="p-2 hover:bg-muted transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Management</h1>
          <p className="text-muted-foreground">
            {activeTab === 'import'
              ? 'Import vehicles and photos'
              : 'Export your collection data'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => handleTabChange('import')}
          className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
            activeTab === 'import'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Import
        </button>
        <button
          onClick={() => handleTabChange('export')}
          className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
            activeTab === 'export'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Export
        </button>
      </div>

      <div className="space-y-6">
        {activeTab === 'import' && (
          <>
            {/* Source Selection */}
            {importSource === null && (
              <>
                <AIPromptHelper />

                <div>
                  <h2 className="font-semibold mb-3">What are you importing?</h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => setImportSource('zip')}
                      className="w-full flex items-start gap-4 p-4 border border-border hover:border-primary bg-card transition-colors text-left"
                    >
                      <ArchiveBoxIcon className="w-8 h-8 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">A TCS ZIP file</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          A ZIP file exported from The Collectors System. This includes all your vehicle data, photos, documents, and service records in one file.
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => setImportSource('csv')}
                      className="w-full flex items-start gap-4 p-4 border border-border hover:border-primary bg-card transition-colors text-left"
                    >
                      <DocumentTextIcon className="w-8 h-8 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">A CSV file with separate photo/document folders</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          A spreadsheet with your vehicle data, plus separate folders for photos, documents, and service receipts.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ZIP Import Flow */}
            {importSource === 'zip' && (
              <>
                {!isImporting && csvStep !== 'done' && (
                  <button
                    onClick={() => setImportSource(null)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    Back to import options
                  </button>
                )}

                <div className="bg-card border border-border p-4">
                  <h2 className="font-semibold mb-2">Import TCS ZIP File</h2>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Upload a ZIP file exported from The Collectors System</li>
                    <li>Includes vehicles, photos, documents, service records, and mileage history</li>
                    <li>Everything will be imported automatically</li>
                  </ul>
                </div>

                {isImporting && (
                  <p className="text-xs text-destructive font-medium">Don&apos;t leave this page or progress will be lost. This may take a little while.</p>
                )}

                <CSVImport collections={collections} subscriptionInfo={subscriptionInfo} onStepChange={handleCsvStepChange} />
              </>
            )}

            {/* CSV + Separate Files Flow */}
            {importSource === 'csv' && (
              <>
                {!isImporting && !csvImportDone && (
                  <button
                    onClick={() => setImportSource(null)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    Back to import options
                  </button>
                )}

                {/* Step 1: CSV Import */}
                <div className="bg-card border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      csvImportDone ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'
                    }`}>1</span>
                    <h2 className="font-semibold">Import Vehicle Data (CSV)</h2>
                  </div>
                  {!csvImportDone && (
                    <ul className="text-sm text-muted-foreground space-y-1 ml-8">
                      <li>&ldquo;Name&rdquo; column is required</li>
                      <li>Dates can be: 6/25, 6/25/26, or 6/25/2026</li>
                      <li>Notes starting with SOLD or TRADED will set status</li>
                    </ul>
                  )}
                  {csvImportDone && (
                    <p className="text-sm text-secondary ml-8">Vehicle data imported successfully. Now upload your files below.</p>
                  )}
                </div>

                {isImporting && (
                  <p className="text-xs text-destructive font-medium">Don&apos;t leave this page or progress will be lost. This may take a little while.</p>
                )}

                {!csvImportDone && (
                  <CSVImport collections={collections} subscriptionInfo={subscriptionInfo} onStepChange={handleCsvStepChange} />
                )}

                {/* Step 2: Bulk file uploads (shown after CSV import completes) */}
                {csvImportDone && (
                  <>
                    <div className="border-t border-border pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-primary text-primary-foreground">2</span>
                        <h2 className="font-semibold">Upload Photos</h2>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4 ml-8">
                        Organize photos in folders named after each vehicle, then upload them all at once.
                      </p>
                      <BulkPhotoImport collections={collections} onImportingChange={handleBulkImportingChange} />
                    </div>

                    <div className="border-t border-border pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-primary text-primary-foreground">3</span>
                        <h2 className="font-semibold">Upload Document Files</h2>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4 ml-8">
                        Upload document files (PDFs, images) organized in folders by vehicle name.
                        Files are matched to existing document records by title.
                      </p>
                      <BulkDocumentImport collections={collections} onImportingChange={handleBulkImportingChange} />
                    </div>

                    <div className="border-t border-border pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-primary text-primary-foreground">4</span>
                        <h2 className="font-semibold">Upload Service Receipts</h2>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4 ml-8">
                        Upload service receipt files organized in folders by vehicle name.
                        Files are matched to existing service records by title.
                      </p>
                      <BulkReceiptImport collections={collections} onImportingChange={handleBulkImportingChange} />
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'export' && <ZipExport collections={collections} />}
      </div>
    </div>
  );
}

export function ImportPageContent({ collections, subscriptionInfo }: ImportPageContentProps) {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    }>
      <ImportTabs collections={collections} subscriptionInfo={subscriptionInfo} />
    </Suspense>
  );
}
