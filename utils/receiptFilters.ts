import { Receipt } from '@/models/types';
import { Currency } from '@/utils/currency';

/**
 * Structured local filtering for the Receipt Library. Runs entirely
 * on-device; the shape is ready for a future search/filter engine.
 */

export type DateRange = 'all' | '30d' | '90d' | 'year';
export type SortOrder = 'newest' | 'oldest' | 'amount_high' | 'amount_low';

export interface ReceiptFilters {
  dateRange: DateRange;
  minAmount: string;
  maxAmount: string;
  currency: Currency | 'any';
  merchant: string;
  tag: string;
  sort: SortOrder;
}

export const DEFAULT_FILTERS: ReceiptFilters = {
  dateRange: 'all',
  minAmount: '',
  maxAmount: '',
  currency: 'any',
  merchant: '',
  tag: '',
  sort: 'newest',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when any filter deviates from its default. */
export const isFilterActive = (f: ReceiptFilters): boolean =>
  f.dateRange !== DEFAULT_FILTERS.dateRange ||
  f.minAmount.trim() !== '' ||
  f.maxAmount.trim() !== '' ||
  f.currency !== 'any' ||
  f.merchant.trim() !== '' ||
  f.tag.trim() !== '' ||
  f.sort !== 'newest';

const dateCutoff = (range: DateRange): number | null => {
  const now = Date.now();
  switch (range) {
    case '30d':
      return now - 30 * DAY_MS;
    case '90d':
      return now - 90 * DAY_MS;
    case 'year':
      return new Date(new Date().getFullYear(), 0, 1).getTime();
    default:
      return null;
  }
};

/** Applies filters + sort to a receipt list. */
export const filterAndSortReceipts = (receipts: Receipt[], f: ReceiptFilters): Receipt[] => {
  const cutoff = dateCutoff(f.dateRange);
  const min = parseFloat(f.minAmount);
  const max = parseFloat(f.maxAmount);

  const filtered = receipts.filter((r) => {
    if (cutoff !== null && new Date(r.date).getTime() < cutoff) return false;
    if (Number.isFinite(min) && r.amount < min) return false;
    if (Number.isFinite(max) && r.amount > max) return false;
    if (f.currency !== 'any' && r.currency !== f.currency) return false;
    if (f.merchant.trim() && !r.merchant.toLowerCase().includes(f.merchant.trim().toLowerCase())) {
      return false;
    }
    if (f.tag.trim()) {
      const tag = f.tag.trim().replace(/^#/, '').toLowerCase();
      if (!(r.tags ?? []).some((item) => item.toLowerCase() === tag || item.toLowerCase().includes(tag))) {
        return false;
      }
    }
    return true;
  });

  const sorters: Record<SortOrder, (a: Receipt, b: Receipt) => number> = {
    newest: (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    oldest: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    amount_high: (a, b) => b.amount - a.amount,
    amount_low: (a, b) => a.amount - b.amount,
  };

  return [...filtered].sort(sorters[f.sort]);
};

/** Human label for the active filter set, e.g. "Filtered · 30 days · GHS". */
export const describeFilters = (f: ReceiptFilters): string => {
  const parts: string[] = [];
  if (f.dateRange === '30d') parts.push('30 days');
  if (f.dateRange === '90d') parts.push('90 days');
  if (f.dateRange === 'year') parts.push('This year');
  if (f.currency !== 'any') parts.push(f.currency);
  if (f.merchant.trim()) parts.push(f.merchant.trim());
  if (f.tag.trim()) parts.push(`#${f.tag.trim().replace(/^#/, '')}`);
  if (f.minAmount.trim() !== '' || f.maxAmount.trim() !== '') parts.push('Amount range');
  return parts.join(' · ');
};
