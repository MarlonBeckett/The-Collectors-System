'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useSelectedCollection } from '@/hooks/useSelectedCollection';
import { CollectionSwitcher } from '@/components/dashboard/CollectionSwitcher';
import { ExpenseLineItem, ExpenseCategory, VehicleType, Expense, StandaloneExpenseCategory } from '@/types/database';
import {
  BanknotesIcon,
  WrenchScrewdriverIcon,
  TruckIcon,
  FolderIcon,
  ChevronDownIcon,
  PlusIcon,
  XMarkIcon,
  TrashIcon,
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
  collection_id: string | null;
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

interface CollectionOption {
  id: string;
  name: string;
  owner_email: string | null;
  owner_display_name: string | null;
  is_owner: boolean;
}

interface ExpensesContentProps {
  collections: CollectionOption[];
  vehicles: VehicleRow[];
  serviceRecords: ServiceRecordRow[];
  documents: DocumentRow[];
  standaloneExpenses: Expense[];
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

const expenseCategoryLabels: Record<StandaloneExpenseCategory, string> = {
  service: 'Service / Repair',
  document: 'Document',
  purchase: 'Purchase',
  registration: 'Registration',
  insurance: 'Insurance',
  fuel: 'Fuel / Gas',
  parking: 'Parking / Tolls',
  other: 'Other',
};

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ExpensesContent({ collections, vehicles, serviceRecords, documents, standaloneExpenses }: ExpensesContentProps) {
  const router = useRouter();
  const supabase = createClient();
  const [selectedCollectionId, setSelectedCollectionId] = useSelectedCollection(collections);

  // Guard against hydration mismatch from localStorage read
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Add expense form state
  const [isAdding, setIsAdding] = useState(false);
  const [formVehicleId, setFormVehicleId] = useState('');
  const [formCategory, setFormCategory] = useState<StandaloneExpenseCategory>('service');
  const [formTitle, setFormTitle] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Build vehicle lookup map
  const vehicleMap = useMemo(() => {
    const map = new Map<string, VehicleRow>();
    vehicles.forEach(v => map.set(v.id, v));
    return map;
  }, [vehicles]);

  // Vehicles in selected collection (for the form dropdown)
  const collectionVehicles = useMemo(() => {
    return vehicles.filter(v => v.collection_id === selectedCollectionId);
  }, [vehicles, selectedCollectionId]);

  // Normalize all expenses into a flat list
  const allExpenses = useMemo<ExpenseLineItem[]>(() => {
    const items: ExpenseLineItem[] = [];

    // Service records
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

    // Purchase prices
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

    // Documents with cost
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

    // Standalone expenses
    standaloneExpenses.forEach(exp => {
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
  }, [serviceRecords, vehicles, documents, standaloneExpenses, vehicleMap]);

  // Filter by selected collection
  const collectionVehicleIds = useMemo(() => {
    return new Set(vehicles.filter(v => v.collection_id === selectedCollectionId).map(v => v.id));
  }, [vehicles, selectedCollectionId]);

  const collectionExpenses = useMemo(() => {
    return allExpenses.filter(e => collectionVehicleIds.has(e.vehicleId));
  }, [allExpenses, collectionVehicleIds]);

  // Derive available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    collectionExpenses.forEach(e => {
      const y = new Date(e.date + 'T00:00:00').getFullYear();
      if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [collectionExpenses]);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | null>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Filter by time period
  const filteredExpenses = useMemo(() => {
    if (selectedYear === null) return collectionExpenses;
    return collectionExpenses.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      if (d.getFullYear() !== selectedYear) return false;
      if (selectedMonth !== null && d.getMonth() !== selectedMonth) return false;
      return true;
    });
  }, [collectionExpenses, selectedYear, selectedMonth]);

  // Summary stats
  const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.cost, 0);
  const serviceTotal = filteredExpenses.filter(e => e.category === 'Service').reduce((sum, e) => sum + e.cost, 0);
  const purchaseTotal = filteredExpenses.filter(e => e.category === 'Purchase').reduce((sum, e) => sum + e.cost, 0);
  const documentTotal = filteredExpenses.filter(e => e.category !== 'Service' && e.category !== 'Purchase').reduce((sum, e) => sum + e.cost, 0);

  // Category breakdown for bar
  const categoryTotals = useMemo(() => {
    const totals: Partial<Record<ExpenseCategory, number>> = {};
    filteredExpenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.cost; });
    return totals;
  }, [filteredExpenses]);

  const nonZeroCategories = (Object.entries(categoryTotals) as [ExpenseCategory, number][]).filter(([, v]) => v > 0);

  // Per-vehicle totals, sorted descending
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

  // Accordion state — top spender expanded by default
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);
  const defaultExpanded = vehicleExpenses[0]?.vehicleId || null;
  const activeExpanded = expandedVehicleId ?? defaultExpanded;

  // Flat line items sorted by date desc
  const sortedItems = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredExpenses]);

  const [showAllItems, setShowAllItems] = useState(false);
  const displayedItems = showAllItems ? sortedItems : sortedItems.slice(0, 20);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const isEmpty = collectionExpenses.length === 0 && !isAdding;

  if (!mounted) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse" />
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-8 w-16 bg-muted animate-pulse" />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  // Form handlers
  const resetForm = () => {
    setFormVehicleId('');
    setFormCategory('service');
    setFormTitle('');
    setFormCost('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
  };

  const handleAddExpense = async () => {
    if (!formVehicleId || !formTitle.trim() || !formCost) return;

    const costNum = parseFloat(formCost.replace(/[,$]/g, ''));
    if (isNaN(costNum) || costNum <= 0) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('expenses').insert({
        motorcycle_id: formVehicleId,
        category: formCategory,
        title: formTitle.trim(),
        cost: costNum,
        expense_date: formDate,
        notes: formNotes.trim() || null,
        created_by: user?.id || null,
      });

      if (error) throw error;

      resetForm();
      setIsAdding(false);
      router.refresh();
    } catch (err) {
      console.error('Failed to save expense:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    // Only standalone expenses (exp- prefixed) can be deleted from here
    const realId = expenseId.replace('exp-', '');
    if (!confirm('Delete this expense?')) return;

    setDeleting(expenseId);
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', realId);
      if (error) throw error;
      router.refresh();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    } finally {
      setDeleting(null);
    }
  };

  const isStandaloneExpense = (id: string) => id.startsWith('exp-');

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      {/* Header with Collection Switcher and Add button */}
      <div className="flex items-center justify-between">
        <CollectionSwitcher
          collections={collections}
          currentCollectionId={selectedCollectionId}
          onSelect={setSelectedCollectionId}
        />
        {!isAdding && (
          <button
            onClick={() => {
              setIsAdding(true);
              // Default to first vehicle in collection
              if (collectionVehicles.length > 0 && !formVehicleId) {
                setFormVehicleId(collectionVehicles[0].id);
              }
            }}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            Record Expense
          </button>
        )}
      </div>

      {/* Add Expense Form */}
      {isAdding && (
        <div className="bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-medium text-foreground">Record Expense</h2>
            <button onClick={() => { resetForm(); setIsAdding(false); }} className="text-muted-foreground hover:text-foreground">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Vehicle Select */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Vehicle</label>
            <select
              value={formVehicleId}
              onChange={(e) => setFormVehicleId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="">Select a vehicle...</option>
              {collectionVehicles.map(v => (
                <option key={v.id} value={v.id}>{getVehicleName(v)}</option>
              ))}
            </select>
          </div>

          {/* Category & Cost row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as StandaloneExpenseCategory)}
                className="w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              >
                {Object.entries(expenseCategoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Cost <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
                placeholder="$0.00"
                className="w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
              />
            </div>
          </div>

          {/* Title & Date row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Description <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Oil change, Registration renewal"
                className="w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Notes (optional)</label>
            <input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional notes"
              className="w-full px-3 py-2 bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => { resetForm(); setIsAdding(false); }}
              disabled={saving}
              className="flex-1 py-2 border border-border hover:bg-muted transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddExpense}
              disabled={saving || !formVehicleId || !formTitle.trim() || !formCost}
              className="flex-1 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="bg-card border border-border p-8 text-center">
          <BanknotesIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            No expenses recorded yet. Tap &quot;Record Expense&quot; to log your first one, or add costs to service records and documents on a vehicle page.
          </p>
        </div>
      ) : (
        <>
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

            {/* Month pills — show when a year is selected */}
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
              <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(documentTotal)}</p>
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
                <h2 className="text-sm font-medium text-muted-foreground">By Vehicle</h2>
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
                            <div key={item.id} className="flex items-center justify-between py-1.5 text-sm group">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`px-1.5 py-0.5 text-xs shrink-0 ${categoryBgColors[item.category]}`}>
                                  {item.category}
                                </span>
                                <span className="text-foreground truncate">{item.description}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                                <span className="font-mono text-foreground">{formatCurrency(item.cost)}</span>
                                {isStandaloneExpense(item.id) && (
                                  <button
                                    onClick={() => handleDeleteExpense(item.id)}
                                    disabled={deleting === item.id}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                                    title="Delete expense"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                  </button>
                                )}
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
                <h2 className="text-sm font-medium text-muted-foreground">All Expenses</h2>
                <span className="text-xs text-muted-foreground ml-auto">{sortedItems.length} items</span>
              </div>
              <div className="divide-y divide-border">
                {displayedItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm group">
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
                      {isStandaloneExpense(item.id) && (
                        <button
                          onClick={() => handleDeleteExpense(item.id)}
                          disabled={deleting === item.id}
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                          title="Delete expense"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
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
        </>
      )}
    </div>
  );
}
