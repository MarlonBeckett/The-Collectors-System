import { AppShell } from '@/components/layout/AppShell';
import { BulkPhotoImport } from '@/components/import/BulkPhotoImport';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function BulkPhotoImportPage() {
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
            <h1 className="text-2xl font-bold text-foreground">Bulk Photo Import</h1>
            <p className="text-muted-foreground">Import photos from organized folders</p>
          </div>
        </div>

        <BulkPhotoImport />
      </div>
    </AppShell>
  );
}
