import { Receipt } from '@/models/types';
import { Currency } from '@/utils/currency';
import { matchPurchaseQuery, type PurchaseQuery } from '@/services/search/query';
import type { ReturnStatus, WarrantyStatus } from '@/utils/protection';

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
  category: string;
  tag: string;
  sort: SortOrder;
  warrantyStatus: WarrantyStatus | 'any';
  returnStatus: ReturnStatus | 'any';
}

export const DEFAULT_FILTERS: ReceiptFilters = {
  dateRange: 'all',
  minAmount: '',
  maxAmount: '',
  currency: 'any',
  merchant: '',
  category: '',
  tag: '',
  sort: 'newest',
  warrantyStatus: 'any',
  returnStatus: 'any',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when any filter deviates from its default. */
export const isFilterActive = (f: ReceiptFilters): boolean =>
  f.dateRange !== DEFAULT_FILTERS.dateRange ||
  f.minAmount.trim() !== '' ||
  f.maxAmount.trim() !== '' ||
  f.currency !== 'any' ||
  f.merchant.trim() !== '' ||
  f.category.trim() !== '' ||
  f.tag.trim() !== '' ||
  f.warrantyStatus !== 'any' ||
  f.returnStatus !== 'any' ||
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

export const purchaseQueryFromFilters = (f: ReceiptFilters, search = ''): PurchaseQuery => {
  const cutoff = dateCutoff(f.dateRange);
  const min = parseFloat(f.minAmount);
  const max = parseFloat(f.maxAmount);
  return {
    text: search.trim() || undefined,
    merchant: f.merchant.trim() || undefined,
    category: f.category.trim() || undefined,
    minAmount: Number.isFinite(min) ? min : undefined,
    maxAmount: Number.isFinite(max) ? max : undefined,
    currency: f.currency === 'any' ? undefined : f.currency,
    tags: f.tag.trim() ? [f.tag.trim().replace(/^#/, '')] : undefined,
    dateFrom: cutoff ? new Date(cutoff).toISOString().slice(0, 10) : undefined,
    warrantyStatus:
      f.warrantyStatus === 'active' || f.warrantyStatus === 'expired' ? f.warrantyStatus : undefined,
    returnStatus:
      f.returnStatus === 'any' || f.returnStatus === 'unknown' || f.returnStatus === 'returned'
        ? undefined
        : f.returnStatus,
  };
};

/** Applies filters + sort to a receipt list. */
export const filterAndSortReceipts = (receipts: Receipt[], f: ReceiptFilters, search = ''): Receipt[] => {
  const query = purchaseQueryFromFilters(f, search);
  const filtered = receipts.filter((r) => matchPurchaseQuery(r, query));

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
  if (f.category.trim()) parts.push(f.category.trim());
  if (f.tag.trim()) parts.push(`#${f.tag.trim().replace(/^#/, '')}`);
  if (f.warrantyStatus !== 'any') parts.push(`Warranty ${f.warrantyStatus}`);
  if (f.returnStatus !== 'any') parts.push(`Return ${f.returnStatus}`);
  if (f.minAmount.trim() !== '' || f.maxAmount.trim() !== '') parts.push('Amount range');
  return parts.join(' · ');
};
