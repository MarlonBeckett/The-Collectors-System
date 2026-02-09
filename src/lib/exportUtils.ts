import { Motorcycle, VehicleDocument, ServiceRecord, MileageHistory } from '@/types/database';
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

// --- Comprehensive CSV (all record types in one file) ---

export interface ComprehensiveExportRow {
  record_type: string;
  vehicle_name: string;
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
  estimated_value: string;
  sale_info_type: string;
  sale_info_date: string;
  sale_info_amount: string;
  sale_info_notes: string;
  service_date: string;
  service_title: string;
  service_description: string;
  service_cost: string;
  service_odometer: string;
  service_shop: string;
  service_category: string;
  service_receipt_files: string;
  document_title: string;
  document_type: string;
  document_expiration: string;
  document_file_name: string;
  document_file_type: string;
  recorded_date: string;
}

const COMPREHENSIVE_COLUMNS: (keyof ComprehensiveExportRow)[] = [
  'record_type',
  'vehicle_name',
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
  'estimated_value',
  'sale_info_type',
  'sale_info_date',
  'sale_info_amount',
  'sale_info_notes',
  'service_date',
  'service_title',
  'service_description',
  'service_cost',
  'service_odometer',
  'service_shop',
  'service_category',
  'service_receipt_files',
  'document_title',
  'document_type',
  'document_expiration',
  'document_file_name',
  'document_file_type',
  'recorded_date',
];

function emptyRow(vehicleName: string, recordType: string): ComprehensiveExportRow {
  const row: ComprehensiveExportRow = {
    record_type: recordType,
    vehicle_name: vehicleName,
    make: '', model: '', year: '', vehicle_type: '', vin: '', plate_number: '',
    mileage: '', tab_expiration: '', status: '', notes: '',
    purchase_price: '', purchase_date: '', nickname: '', maintenance_notes: '',
    estimated_value: '', sale_info_type: '', sale_info_date: '', sale_info_amount: '', sale_info_notes: '',
    service_date: '', service_title: '', service_description: '', service_cost: '',
    service_odometer: '', service_shop: '', service_category: '', service_receipt_files: '',
    document_title: '', document_type: '', document_expiration: '', document_file_name: '', document_file_type: '',
    recorded_date: '',
  };
  return row;
}

export function generateComprehensiveCSV(
  vehicles: Motorcycle[],
  documents: (VehicleDocument & { vehicle_name: string })[],
  serviceRecords: (ServiceRecord & { vehicle_name: string; receipt_files: string })[],
  mileageHistory: (MileageHistory & { vehicle_name: string })[],
  options: ExportOptions
): string {
  const filtered = filterVehiclesForExport(vehicles, options);
  const filteredNames = new Set(filtered.map((v) => v.name));

  const rows: ComprehensiveExportRow[] = [];

  for (const vehicle of filtered) {
    // Vehicle row
    const vRow = emptyRow(vehicle.name, 'vehicle');
    vRow.make = vehicle.make || '';
    vRow.model = vehicle.model || '';
    vRow.year = vehicle.year?.toString() || '';
    vRow.vehicle_type = vehicle.vehicle_type || 'motorcycle';
    vRow.vin = vehicle.vin || '';
    vRow.plate_number = vehicle.plate_number || '';
    vRow.mileage = vehicle.mileage || '';
    vRow.tab_expiration = vehicle.tab_expiration || '';
    vRow.status = vehicle.status || 'active';
    vRow.notes = vehicle.notes || '';
    vRow.purchase_price = vehicle.purchase_price?.toString() || '';
    vRow.purchase_date = vehicle.purchase_date || '';
    vRow.nickname = vehicle.nickname || '';
    vRow.maintenance_notes = vehicle.maintenance_notes || '';
    vRow.estimated_value = vehicle.estimated_value?.toString() || '';
    if (vehicle.sale_info) {
      vRow.sale_info_type = vehicle.sale_info.type || '';
      vRow.sale_info_date = vehicle.sale_info.date || '';
      vRow.sale_info_amount = vehicle.sale_info.amount?.toString() || '';
      vRow.sale_info_notes = vehicle.sale_info.notes || '';
    }
    rows.push(vRow);

    // Service record rows for this vehicle
    const vehicleServices = serviceRecords.filter((sr) => sr.vehicle_name === vehicle.name);
    for (const sr of vehicleServices) {
      const sRow = emptyRow(vehicle.name, 'service');
      sRow.service_date = sr.service_date || '';
      sRow.service_title = sr.title || '';
      sRow.service_description = sr.description || '';
      sRow.service_cost = sr.cost?.toString() || '';
      sRow.service_odometer = sr.odometer?.toString() || '';
      sRow.service_shop = sr.shop_name || '';
      sRow.service_category = sr.category || '';
      sRow.service_receipt_files = sr.receipt_files || '';
      rows.push(sRow);
    }

    // Document rows for this vehicle
    const vehicleDocs = documents.filter((d) => d.vehicle_name === vehicle.name);
    for (const doc of vehicleDocs) {
      const dRow = emptyRow(vehicle.name, 'document');
      dRow.document_title = doc.title || '';
      dRow.document_type = doc.document_type || '';
      dRow.document_expiration = doc.expiration_date || '';
      dRow.document_file_name = doc.file_name || '';
      dRow.document_file_type = doc.file_type || '';
      dRow.notes = doc.notes || '';
      rows.push(dRow);
    }

    // Mileage history rows for this vehicle
    const vehicleMileage = mileageHistory.filter((m) => m.vehicle_name === vehicle.name);
    for (const m of vehicleMileage) {
      const mRow = emptyRow(vehicle.name, 'mileage');
      mRow.mileage = m.mileage?.toString() || '';
      mRow.recorded_date = m.recorded_date || '';
      mRow.notes = m.notes || '';
      rows.push(mRow);
    }
  }

  return Papa.unparse(rows, {
    header: true,
    columns: COMPREHENSIVE_COLUMNS,
  });
}
