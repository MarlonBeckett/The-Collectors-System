'use client';

import { ShareLinkToggles } from '@/types/database';

export const TOGGLE_LABELS: { key: keyof ShareLinkToggles; label: string; defaultValue: boolean }[] = [
  { key: 'include_vin', label: 'VIN', defaultValue: false },
  { key: 'include_plate', label: 'Plate number', defaultValue: false },
  { key: 'include_purchase_info', label: 'Purchase price & date', defaultValue: false },
  { key: 'include_tab_expiration', label: 'Tab expiration', defaultValue: false },
  { key: 'include_notes', label: 'Notes', defaultValue: false },
  { key: 'include_service_records', label: 'Service records', defaultValue: true },
  { key: 'include_documents', label: 'Documents', defaultValue: true },
  { key: 'include_mileage', label: 'Mileage history', defaultValue: true },
];

export const DEFAULT_TOGGLES: ShareLinkToggles = {
  include_vin: false,
  include_plate: false,
  include_purchase_info: false,
  include_tab_expiration: false,
  include_notes: false,
  include_service_records: true,
  include_documents: true,
  include_mileage: true,
};

interface VisibilityTogglesProps {
  values: ShareLinkToggles;
  onChange: (key: keyof ShareLinkToggles, value: boolean) => void;
}

export function VisibilityToggles({ values, onChange }: VisibilityTogglesProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm text-muted-foreground">Field Visibility</label>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {TOGGLE_LABELS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm py-0.5">
            <input
              type="checkbox"
              checked={values[key]}
              onChange={(e) => onChange(key, e.target.checked)}
              className="rounded border-border"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Compact badge display of which fields are visible on an existing link */
export function VisibilityBadges({ values }: { values: ShareLinkToggles }) {
  const shown = TOGGLE_LABELS.filter(t => values[t.key]);
  const hidden = TOGGLE_LABELS.filter(t => !values[t.key]);

  if (shown.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(({ key, label }) => (
        <span
          key={key}
          className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        >
          {label}
        </span>
      ))}
      {hidden.length > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          +{hidden.length} hidden
        </span>
      )}
    </div>
  );
}
