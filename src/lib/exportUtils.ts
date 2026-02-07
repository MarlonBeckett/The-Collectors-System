import { Motorcycle, VehicleDocument, ServiceRecord } from '@/types/database';
import Papa from 'papaparse';

export interface ExportOptions {
  includeInactive: boolean;
  encodeStatusInNotes: boolean;
}

export interface ExportRow {
  name: string;
  make: string;
  model: string;
  year: string;
  vehicle_type: string;
  vin: string;
  plate_number: string;
  mileage: string;
  tab_expiration: string;
  status: string;
  notes: string;
  purchase_price: string;
  purchase_date: string;
  nickname: string;
  maintenance_notes: string;
}

const isActiveStatus = (status: string): boolean => {
  return status === 'active' || status === 'maintenance';
};

export function formatVehicleForExport(
  vehicle: Motorcycle,
  options: ExportOptions
): ExportRow {
  let notes = vehicle.notes || '';

  // Encode status in notes for re-import compatibility
  if (options.encodeStatusInNotes && vehicle.status !== 'active') {
    const statusPrefix = vehicle.status.toUpperCase();
    let saleDetails = '';

    if (vehicle.sale_info) {
      if (vehicle.sale_info.date) {
        saleDetails += ` ${vehicle.sale_info.date}`;
      }
      if (vehicle.sale_info.amount) {
        saleDetails += ` $${vehicle.sale_info.amount.toLocaleString()}`;
      }
    }

    notes = `${statusPrefix}${saleDetails}${notes ? ' - ' + notes : ''}`;
  }

  return {
    name: vehicle.name || '',
    make: vehicle.make || '',
    model: vehicle.model || '',
    year: vehicle.year?.toString() || '',
    vehicle_type: vehicle.vehicle_type || 'motorcycle',
    vin: vehicle.vin || '',
    plate_number: vehicle.plate_number || '',
    mileage: vehicle.mileage || '',
    tab_expiration: vehicle.tab_expiration || '',
    status: vehicle.status || 'active',
    notes: notes,
    purchase_price: vehicle.purchase_price?.toString() || '',
    purchase_date: vehicle.purchase_date || '',
    nickname: vehicle.nickname || '',
    maintenance_notes: vehicle.maintenance_notes || '',
  };
}

export function filterVehiclesForExport(
  vehicles: Motorcycle[],
  options: ExportOptions
): Motorcycle[] {
  if (options.includeInactive) {
    return vehicles;
  }
  return vehicles.filter((v) => isActiveStatus(v.status));
}

export function generateCSV(
  vehicles: Motorcycle[],
  options: ExportOptions
): string {
  const filtered = filterVehiclesForExport(vehicles, options);
  const rows = filtered.map((v) => formatVehicleForExport(v, options));

  return Papa.unparse(rows, {
    header: true,
    columns: [
      'name',
      'make',
      'model',
      'year',
      'vehicle_type',
      'vin',
      'plate_number',
      'mileage',
      'tab_expiration',
      'status',
      'notes',
      'purchase_price',
      'purchase_date',
      'nickname',
      'maintenance_notes',
    ],
  });
}

export function downloadCSV(csv: string, filename: string = 'vehicles-export.csv'): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getExportFilename(): string {
  const date = new Date().toISOString().split('T')[0];
  return `vehicles-export-${date}.csv`;
}

export interface DocumentExportRow {
  vehicle_name: string;
  title: string;
  document_type: string;
  expiration_date: string;
  notes: string;
  file_name: string;
}

export interface ServiceRecordExportRow {
  vehicle_name: string;
  service_date: string;
  title: string;
  description: string;
  cost: string;
  odometer: string;
  shop_name: string;
  category: string;
}

export function generateDocumentsCSV(
  documents: (VehicleDocument & { vehicle_name: string })[]
): string {
  const rows: DocumentExportRow[] = documents.map((d) => ({
    vehicle_name: d.vehicle_name,
    title: d.title || '',
    document_type: d.document_type || '',
    expiration_date: d.expiration_date || '',
    notes: d.notes || '',
    file_name: d.file_name || '',
  }));

  return Papa.unparse(rows, {
    header: true,
    columns: ['vehicle_name', 'title', 'document_type', 'expiration_date', 'notes', 'file_name'],
  });
}

export function generateServiceRecordsCSV(
  records: (ServiceRecord & { vehicle_name: string })[]
): string {
  const rows: ServiceRecordExportRow[] = records.map((r) => ({
    vehicle_name: r.vehicle_name,
    service_date: r.service_date || '',
    title: r.title || '',
    description: r.description || '',
    cost: r.cost?.toString() || '',
    odometer: r.odometer?.toString() || '',
    shop_name: r.shop_name || '',
    category: r.category || '',
  }));

  return Papa.unparse(rows, {
    header: true,
    columns: ['vehicle_name', 'service_date', 'title', 'description', 'cost', 'odometer', 'shop_name', 'category'],
  });
}
