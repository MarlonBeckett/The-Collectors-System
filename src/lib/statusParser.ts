import type { MotorcycleStatus, SaleInfo } from '@/types/database';
import { parseFlexibleDate, formatDateForDB } from './dateUtils';

interface ParsedStatus {
  status: MotorcycleStatus;
  saleInfo: SaleInfo | null;
  cleanedNotes: string;
}

/**
 * Parse status information from notes field
 * Examples:
 * - "SOLD 7/25 $10,000" → status: sold, sale_info: {date: "2025-07-25", amount: 10000}
 * - "Traded in Vegas $7,000" → status: traded, sale_info: {amount: 7000, notes: "in Vegas"}
 * - "STORED - winter" → status: stored
 * - Regular notes → status: active
 */
export function parseStatusFromNotes(notes: string | null | undefined): ParsedStatus {
  if (!notes || typeof notes !== 'string') {
    return { status: 'active', saleInfo: null, cleanedNotes: '' };
  }

  const trimmed = notes.trim();
  const upperNotes = trimmed.toUpperCase();

  // Check for SOLD pattern
  const soldMatch = trimmed.match(/^SOLD\s*/i);
  if (soldMatch) {
    const remainder = trimmed.slice(soldMatch[0].length);
    const saleInfo = extractSaleInfo(remainder);
    return {
      status: 'sold',
      saleInfo: { ...saleInfo, type: 'sold' },
      cleanedNotes: saleInfo.notes || '',
    };
  }

  // Check for TRADED pattern
  const tradedMatch = trimmed.match(/^TRADED?\s*/i);
  if (tradedMatch) {
    const remainder = trimmed.slice(tradedMatch[0].length);
    const saleInfo = extractSaleInfo(remainder);
    return {
      status: 'traded',
      saleInfo: { ...saleInfo, type: 'traded' },
      cleanedNotes: saleInfo.notes || '',
    };
  }

  // Check for STORED pattern
  if (upperNotes.startsWith('STORED')) {
    const remainder = trimmed.slice(6).replace(/^[\s-]+/, '').trim();
    return {
      status: 'stored',
      saleInfo: null,
      cleanedNotes: remainder,
    };
  }

  // Default to active
  return { status: 'active', saleInfo: null, cleanedNotes: trimmed };
}

/**
 * Extract sale information from a string
 * Looks for date patterns and dollar amounts
 */
function extractSaleInfo(text: string): SaleInfo {
  const saleInfo: SaleInfo = {};
  let remaining = text.trim();

  // Extract dollar amount (e.g., $10,000 or $7000 or 10000)
  const amountMatch = remaining.match(/\$?([\d,]+(?:\.\d{2})?)/);
  if (amountMatch) {
    const amountStr = amountMatch[1].replace(/,/g, '');
    const amount = parseFloat(amountStr);
    if (!isNaN(amount) && amount > 100) {
      // Assume amounts > 100 are sale prices
      saleInfo.amount = amount;
      remaining = remaining.replace(amountMatch[0], '').trim();
    }
  }

  // Extract date pattern
  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(\d{1,2}\/\d{1,2})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];

  for (const pattern of datePatterns) {
    const dateMatch = remaining.match(pattern);
    if (dateMatch) {
      const parsed = parseFlexibleDate(dateMatch[1]);
      if (parsed) {
        saleInfo.date = formatDateForDB(parsed) || undefined;
        remaining = remaining.replace(dateMatch[0], '').trim();
        break;
      }
    }
  }

  // Clean up remaining text as notes
  remaining = remaining
    .replace(/^[\s,-]+/, '')
    .replace(/[\s,-]+$/, '')
    .trim();

  if (remaining) {
    saleInfo.notes = remaining;
  }

  return saleInfo;
}

/**
 * Format sale info for display
 */
export function formatSaleInfo(saleInfo: SaleInfo | null | undefined): string {
  if (!saleInfo) return '';

  const parts: string[] = [];

  if (saleInfo.type) {
    parts.push(saleInfo.type === 'sold' ? 'Sold' : 'Traded');
  }

  if (saleInfo.date) {
    const date = new Date(saleInfo.date);
    parts.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  }

  if (saleInfo.amount) {
    parts.push(`$${saleInfo.amount.toLocaleString()}`);
  }

  if (saleInfo.notes) {
    parts.push(saleInfo.notes);
  }

  return parts.join(' - ');
}
