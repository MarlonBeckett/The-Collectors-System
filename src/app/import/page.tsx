'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { CSVImport } from '@/components/import/CSVImport';
import { CSVExport } from '@/components/import/CSVExport';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

type Tab = 'import' | 'export';

function ImportPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<Tab>(tabParam === 'export' ? 'export' : 'import');

  useEffect(() => {
    if (tabParam === 'export') {
      setActiveTab('export');
    }
  }, [tabParam]);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/"
            className="p-2 hover:bg-muted transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {activeTab === 'import' ? 'Import Data' : 'Export Data'}
            </h1>
            <p className="text-muted-foreground">
              {activeTab === 'import'
                ? 'Import vehicles from a CSV file'
                : 'Export your collection to CSV'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
              activeTab === 'import'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Import
          </button>
          <button
            onClick={() => setActiveTab('export')}
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
              <div className="bg-card border border-border p-4">
                <h2 className="font-semibold mb-2">CSV Format Tips</h2>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Include a header row with column names</li>
                  <li>&ldquo;Name&rdquo; column is required</li>
                  <li>Dates can be: 6/25, 6/25/26, or 6/25/2026</li>
                  <li>Notes starting with SOLD, TRADED, or STORED will set status</li>
                  <li>Example: &ldquo;SOLD 7/25 $10,000&rdquo; extracts sale info</li>
                </ul>
              </div>

              <CSVImport />
            </>
          )}

          {activeTab === 'export' && <CSVExport />}
        </div>
      </div>
    </AppShell>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </div>
      </AppShell>
    }>
      <ImportPageContent />
    </Suspense>
  );
}
