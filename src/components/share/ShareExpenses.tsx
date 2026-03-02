'use client';

import { useMemo, useState } from 'react';
import { ExpenseLineItem, ExpenseCategory, VehicleType, Expense } from '@/types/database';
import {
  BanknotesIcon,
  WrenchScrewdriverIcon,
  TruckIcon,
  FolderIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

interface VehicleRow {
  id: string;
  make: string;
  model: string;
  sub_model: string | null;
  nickname: string | null;
  year: number;
  vehicle_type: VehicleType;
  purchase_price: number | null;
  purchase_date: string | null;
  created_at: string;
}

interface ServiceRecordRow {
  id: string;
  motorcycle_id: string;
  service_date: string;
  title: string;
  category: string;
  cost: number;
}

interface DocumentRow {
  id: string;
  motorcycle_id: string;
  title: string;
  document_type: string;
  cost: number;
  created_at: string;
}

interface ShareExpensesProps {
  vehicles: VehicleRow[];
  serviceRecords: ServiceRecordRow[];
  documents: DocumentRow[];
  standaloneExpenses: Expense[];
  includePurchaseInfo: boolean;
}

function getVehicleName(v: VehicleRow): string {
  if (v.nickname) return v.nickname;
  return `${v.year} ${v.make} ${v.model}${v.sub_model ? ` ${v.sub_model}` : ''}`;
}

function mapDocumentTypeToCategory(docType: string): ExpenseCategory {
  switch (docType) {
    case 'registration': return 'Registration';
    case 'insurance': return 'Insurance';
    default: return 'Document';
  }
}

function mapStandaloneCategoryToExpenseCategory(cat: string): ExpenseCategory {
  switch (cat) {
    case 'service': return 'Service';
    case 'purchase': return 'Purchase';
    case 'registration': return 'Registration';
    case 'insurance': return 'Insurance';
    case 'document': return 'Document';
    case 'fuel': return 'Fuel';
    case 'parking': return 'Parking';
    default: return 'Other';
  }
}

const categoryColors: Record<ExpenseCategory, string> = {
  Service: 'bg-blue-500',
  Purchase: 'bg-green-500',
  Registration: 'bg-purple-500',
  Insurance: 'bg-cyan-500',
  Document: 'bg-gray-500',
  Fuel: 'bg-amber-500',
  Parking: 'bg-orange-500',
  Other: 'bg-slate-500',
};

const categoryBgColors: Record<ExpenseCategory, string> = {
  Service: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  Purchase: 'bg-green-500/20 text-green-700 dark:text-green-400',
  Registration: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
  Insurance: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
  Document: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
  Fuel: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  Parking: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  Other: 'bg-slate-500/20 text-slate-600 dark:text-slate-400',
};

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ShareExpenses({ vehicles, serviceRecords, documents, standaloneExpenses, includePurchaseInfo }: ShareExpensesProps) {
  const vehicleMap = useMemo(() => {
    const map = new Map<string, VehicleRow>();
    vehicles.forEach(v => map.set(v.id, v));
    return map;
  }, [vehicles]);

  const allExpenses = useMemo<ExpenseLineItem[]>(() => {
    const items: ExpenseLineItem[] = [];

    serviceRecords.forEach(sr => {
      const vehicle = vehicleMap.get(sr.motorcycle_id);
      if (!vehicle) return;
      items.push({
        id: `sr-${sr.id}`,
        vehicleId: vehicle.id,
        vehicleName: getVehicleName(vehicle),
        category: 'Service',
        description: sr.title,
        cost: sr.cost,
        date: sr.service_date,
      });
    });

    if (includePurchaseInfo) {
      vehicles.forEach(v => {
        if (v.purchase_price == null || v.purchase_price <= 0) return;
        items.push({
          id: `pp-${v.id}`,
          vehicleId: v.id,
          vehicleName: getVehicleName(v),
          category: 'Purchase',
          description: 'Vehicle purchase',
          cost: v.purchase_price,
          date: v.purchase_date || v.created_at.split('T')[0],
        });
      });
    }

    documents.forEach(doc => {
      const vehicle = vehicleMap.get(doc.motorcycle_id);
      if (!vehicle) return;
      items.push({
        id: `doc-${doc.id}`,
        vehicleId: vehicle.id,
        vehicleName: getVehicleName(vehicle),
        category: mapDocumentTypeToCategory(doc.document_type),
        description: doc.title,
        cost: doc.cost,
        date: doc.created_at.split('T')[0],
      });
    });

    standaloneExpenses.forEach(exp => {
      if (!includePurchaseInfo && exp.category === 'purchase') return;
      const vehicle = vehicleMap.get(exp.motorcycle_id);
      if (!vehicle) return;
      items.push({
        id: `exp-${exp.id}`,
        vehicleId: vehicle.id,
        vehicleName: getVehicleName(vehicle),
        category: mapStandaloneCategoryToExpenseCategory(exp.category),
        description: exp.title,
        cost: exp.cost,
        date: exp.expense_date,
      });
    });

    return items;
  }, [serviceRecords, vehicles, documents, standaloneExpenses, vehicleMap, includePurchaseInfo]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allExpenses.forEach(e => {
      const y = new Date(e.date + 'T00:00:00').getFullYear();
      if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allExpenses]);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | null>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const filteredExpenses = useMemo(() => {
    if (selectedYear === null) return allExpenses;
    return allExpenses.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      if (d.getFullYear() !== selectedYear) return false;
      if (selectedMonth !== null && d.getMonth() !== selectedMonth) return false;
      return true;
    });
  }, [allExpenses, selectedYear, selectedMonth]);

  const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.cost, 0);
  const serviceTotal = filteredExpenses.filter(e => e.category === 'Service').reduce((sum, e) => sum + e.cost, 0);
  const purchaseTotal = filteredExpenses.filter(e => e.category === 'Purchase').reduce((sum, e) => sum + e.cost, 0);
  const otherTotal = filteredExpenses.filter(e => e.category !== 'Service' && e.category !== 'Purchase').reduce((sum, e) => sum + e.cost, 0);

  const categoryTotals = useMemo(() => {
    const totals: Partial<Record<ExpenseCategory, number>> = {};
    filteredExpenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.cost; });
    return totals;
  }, [filteredExpenses]);

  const nonZeroCategories = (Object.entries(categoryTotals) as [ExpenseCategory, number][]).filter(([, v]) => v > 0);

  const vehicleExpenses = useMemo(() => {
    const map = new Map<string, { vehicleName: string; vehicleId: string; total: number; items: ExpenseLineItem[] }>();
    filteredExpenses.forEach(e => {
      const existing = map.get(e.vehicleId);
      if (existing) {
        existing.total += e.cost;
        existing.items.push(e);
      } else {
        map.set(e.vehicleId, { vehicleName: e.vehicleName, vehicleId: e.vehicleId, total: e.cost, items: [e] });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);
  const defaultExpanded = vehicleExpenses[0]?.vehicleId || null;
  const activeExpanded = expandedVehicleId ?? defaultExpanded;

  const sortedItems = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredExpenses]);

  const [showAllItems, setShowAllItems] = useState(false);
  const displayedItems = showAllItems ? sortedItems : sortedItems.slice(0, 20);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (allExpenses.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 pt-2">
        <BanknotesIcon className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Expenses</h2>
      </div>

      {/* Time Period Filter */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setSelectedYear(null); setSelectedMonth(null); }}
            className={`px-3 py-1.5 text-sm border transition-colors ${selectedYear === null ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
          >
            All Time
          </button>
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => { setSelectedYear(year); setSelectedMonth(null); }}
              className={`px-3 py-1.5 text-sm border transition-colors ${selectedYear === year ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
            >
              {year}
            </button>
          ))}
        </div>

        {selectedYear !== null && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedMonth(null)}
              className={`px-2 py-1 text-xs border transition-colors ${selectedMonth === null ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
            >
              All
            </button>
            {months.map((month, i) => (
              <button
                key={i}
                onClick={() => setSelectedMonth(i)}
                className={`px-2 py-1 text-xs border transition-colors ${selectedMonth === i ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
              >
                {month}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-card border border-border p-3 text-center">
          <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(totalSpent)}</p>
          <p className="text-xs text-muted-foreground">Total Spent</p>
        </div>
        <div className="bg-card border border-border p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <WrenchScrewdriverIcon className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(serviceTotal)}</p>
          <p className="text-xs text-muted-foreground">Service</p>
        </div>
        <div className="bg-card border border-border p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TruckIcon className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(purchaseTotal)}</p>
          <p className="text-xs text-muted-foreground">Purchases</p>
        </div>
        <div className="bg-card border border-border p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <FolderIcon className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(otherTotal)}</p>
          <p className="text-xs text-muted-foreground">Other</p>
        </div>
      </div>

      {/* Category Breakdown Bar */}
      {nonZeroCategories.length > 0 && (
        <div className="bg-card border border-border p-4">
          <div className="flex h-4 overflow-hidden rounded-sm">
            {nonZeroCategories.map(([cat, amount]) => (
              <div
                key={cat}
                className={`${categoryColors[cat]} transition-all`}
                style={{ width: `${(amount / totalSpent) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {nonZeroCategories.map(([cat, amount]) => (
              <div key={cat} className="flex items-center gap-1.5 text-xs">
                <div className={`w-2.5 h-2.5 rounded-sm ${categoryColors[cat]}`} />
                <span className="text-muted-foreground">{cat}</span>
                <span className="font-mono text-foreground">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Vehicle Accordion */}
      {vehicleExpenses.length > 0 && (
        <div className="bg-card border border-border">
          <div className="flex items-center gap-2 p-4 pb-2">
            <TruckIcon className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">By Vehicle</h3>
          </div>
          <div className="divide-y divide-border">
            {vehicleExpenses.map(({ vehicleId, vehicleName, total, items }) => {
              const isExpanded = activeExpanded === vehicleId;
              return (
                <div key={vehicleId}>
                  <button
                    onClick={() => setExpandedVehicleId(isExpanded ? '__none__' : vehicleId)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-foreground text-sm">{vehicleName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-foreground">{formatCurrency(total)}</span>
                      <ChevronDownIcon className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-1">
                      {items.sort((a, b) => b.date.localeCompare(a.date)).map(item => (
                        <div key={item.id} className="flex items-center justify-between py-1.5 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`px-1.5 py-0.5 text-xs shrink-0 ${categoryBgColors[item.category]}`}>
                              {item.category}
                            </span>
                            <span className="text-foreground truncate">{item.description}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                            <span className="font-mono text-foreground">{formatCurrency(item.cost)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Expenses Line Items */}
      {sortedItems.length > 0 && (
        <div className="bg-card border border-border">
          <div className="flex items-center gap-2 p-4 pb-2">
            <BanknotesIcon className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">All Expenses</h3>
            <span className="text-xs text-muted-foreground ml-auto">{sortedItems.length} items</span>
          </div>
          <div className="divide-y divide-border">
            {displayedItems.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-xs shrink-0 ${categoryBgColors[item.category]}`}>
                      {item.category}
                    </span>
                    <span className="text-foreground truncate">{item.description}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.vehicleName}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                  <span className="font-mono text-foreground">{formatCurrency(item.cost)}</span>
                </div>
              </div>
            ))}
          </div>
          {sortedItems.length > 20 && (
            <button
              onClick={() => setShowAllItems(!showAllItems)}
              className="w-full py-2 text-sm text-primary hover:bg-muted/50 transition-colors border-t border-border"
            >
              {showAllItems ? 'Show less' : `Show all ${sortedItems.length} items`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
