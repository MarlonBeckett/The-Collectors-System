import { AppShell } from '@/components/layout/AppShell';
import { VehicleForm } from '@/components/vehicles/VehicleForm';
import Link from 'next/link';
import { ArrowLeftIcon, DocumentArrowDownIcon, PhotoIcon } from '@heroicons/react/24/outline';

export default function NewVehiclePage() {
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
          <h1 className="text-2xl font-bold text-foreground">Add Vehicle</h1>
        </div>

        <VehicleForm mode="create" />

        {/* Bulk Import Section */}
        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Bulk Import</h2>
          <div className="grid gap-3">
            <Link
              href="/import"
              className="flex items-center gap-3 p-4 bg-card border border-border hover:border-primary transition-colors"
            >
              <DocumentArrowDownIcon className="w-6 h-6 text-muted-foreground" />
              <div>
                <p className="font-medium">Import from CSV</p>
                <p className="text-sm text-muted-foreground">Import multiple vehicles from a spreadsheet</p>
              </div>
            </Link>
            <Link
              href="/import/photos"
              className="flex items-center gap-3 p-4 bg-card border border-border hover:border-primary transition-colors"
            >
              <PhotoIcon className="w-6 h-6 text-muted-foreground" />
              <div>
                <p className="font-medium">Import Photos from Folder</p>
                <p className="text-sm text-muted-foreground">Bulk upload photos organized by vehicle</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
