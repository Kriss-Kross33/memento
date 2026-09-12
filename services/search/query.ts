import type { Receipt } from '@/models/types';
import type { Currency } from '@/utils/currency';

/** Structured search — not natural language. */
export type PurchaseQuery = {
  merchant?: string;
  item?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  currency?: Currency;
  receiptNumber?: string;
  tags?: string[];
  notes?: string;
  warrantyExpiringBefore?: string;
  returnAvailableOn?: string;
};

const includes = (haystack: string | undefined, needle: string): boolean =>
  (haystack ?? '').toLowerCase().includes(needle.toLowerCase());

const returnDeadline = (receipt: Receipt): string | undefined => {
  if (receipt.returnWindowDays == null) return undefined;
  const date = new Date(`${receipt.date}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setDate(date.getDate() + receipt.returnWindowDays);
  return date.toISOString().slice(0, 10);
};

export const matchPurchaseQuery = (receipt: Receipt, query: PurchaseQuery): boolean => {
  if (query.merchant && !includes(receipt.merchant, query.merchant)) return false;
  if (query.category && !includes(receipt.category, query.category)) return false;
  if (query.currency && receipt.currency !== query.currency) return false;
  if (query.receiptNumber && !includes(receipt.receiptNumber, query.receiptNumber)) return false;
  if (query.notes && !includes(receipt.notes, query.notes)) return false;
  if (query.minAmount != null && receipt.amount < query.minAmount) return false;
  if (query.maxAmount != null && receipt.amount > query.maxAmount) return false;
  if (query.dateFrom && receipt.date < query.dateFrom) return false;
  if (query.dateTo && receipt.date > query.dateTo) return false;
  if (query.item && !(receipt.items ?? []).some((item) => includes(item.label, query.item!))) return false;
  if (query.tags?.length && !query.tags.every((tag) => (receipt.tags ?? []).some((entry) => includes(entry, tag)))) {
    return false;
  }
  if (query.warrantyExpiringBefore) {
    if (!receipt.warrantyUntil || receipt.warrantyUntil > query.warrantyExpiringBefore) return false;
  }
  if (query.returnAvailableOn) {
    const deadline = returnDeadline(receipt);
    if (!deadline || deadline < query.returnAvailableOn) return false;
  }
  return true;
};
