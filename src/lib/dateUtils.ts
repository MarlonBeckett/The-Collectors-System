import { parse, isValid, format, addYears, isBefore } from 'date-fns';

/**
 * Parse flexible date formats into a Date object
 * Supported formats:
 * - 6/25 → assume current/next year
 * - 6/25/26 → 2-digit year
 * - 6/25/2026 → full year
 * - 2026-06-25 → ISO format
 */
export function parseFlexibleDate(dateString: string | null | undefined): Date | null {
  if (!dateString || typeof dateString !== 'string') return null;

  const trimmed = dateString.trim();
  if (!trimmed) return null;

  const currentYear = new Date().getFullYear();
  const today = new Date();

  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const date = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    if (isValid(date)) return date;
  }

  // Try MM/DD/YYYY format
  const fullYearMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fullYearMatch) {
    const date = new Date(parseInt(fullYearMatch[3]), parseInt(fullYearMatch[1]) - 1, parseInt(fullYearMatch[2]));
    if (isValid(date)) return date;
  }

  // Try MM/DD/YY format (2-digit year)
  const shortYearMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (shortYearMatch) {
    let year = parseInt(shortYearMatch[3]);
    // Assume 2000s for years 00-99
    year = year < 100 ? 2000 + year : year;
    const date = new Date(year, parseInt(shortYearMatch[1]) - 1, parseInt(shortYearMatch[2]));
    if (isValid(date)) return date;
  }

  // Try MM/DD format (no year - assume current or next year)
  const noYearMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (noYearMatch) {
    const month = parseInt(noYearMatch[1]) - 1;
    const day = parseInt(noYearMatch[2]);

    // Try current year first
    let date = new Date(currentYear, month, day);

    // If the date is in the past, use next year
    if (isBefore(date, today)) {
      date = new Date(currentYear + 1, month, day);
    }

    if (isValid(date)) return date;
  }

  // Try parsing with date-fns as fallback
  const formats = ['M/d/yyyy', 'MM/dd/yyyy', 'M/d/yy', 'MM/dd/yy', 'yyyy-MM-dd'];
  for (const fmt of formats) {
    const parsed = parse(trimmed, fmt, new Date());
    if (isValid(parsed)) return parsed;
  }

  return null;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(dateObj)) return '';

  return format(dateObj, 'MMM d, yyyy');
}

/**
 * Format a date for database storage (YYYY-MM-DD)
 */
export function formatDateForDB(date: Date | null | undefined): string | null {
  if (!date || !isValid(date)) return null;
  return format(date, 'yyyy-MM-dd');
}

/**
 * Calculate days until expiration
 * Returns negative number if expired
 */
export function daysUntilExpiration(expirationDate: string | Date | null | undefined): number | null {
  if (!expirationDate) return null;

  const expDate = typeof expirationDate === 'string' ? new Date(expirationDate) : expirationDate;
  if (!isValid(expDate)) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expDate.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get expiration status for styling
 */
export type ExpirationStatus = 'expired' | 'warning' | 'soon' | 'current' | 'unknown';

export function getExpirationStatus(expirationDate: string | Date | null | undefined): ExpirationStatus {
  const days = daysUntilExpiration(expirationDate);

  if (days === null) return 'unknown';
  if (days < 0) return 'expired';
  if (days <= 7) return 'warning';
  if (days <= 30) return 'soon';
  return 'current';
}
