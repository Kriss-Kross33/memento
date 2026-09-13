import type { Receipt } from '@/models/types';
import type { Currency } from '@/utils/currency';
import { returnStatusFor, warrantyStatusFor, type ReturnStatus, type WarrantyStatus } from '@/utils/protection';

/** Structured search — not natural language. */
export type PurchaseQuery = {
  /** Free-text OR across merchant, items, notes, number, amount, date, tags. */
  text?: string;
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
  warrantyStatus?: Exclude<WarrantyStatus, 'unknown'>;
  returnStatus?: Exclude<ReturnStatus, 'unknown' | 'returned'>;
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

const matchesText = (receipt: Receipt, text: string): boolean => {
  const amountText = receipt.amount.toFixed(2);
  return (
    includes(receipt.merchant, text) ||
    includes(receipt.category, text) ||
    includes(receipt.notes, text) ||
    includes(receipt.receiptNumber, text) ||
    includes(receipt.date, text) ||
    amountText.includes(text.toLowerCase()) ||
    String(receipt.amount).includes(text) ||
    (receipt.tags ?? []).some((tag) => includes(tag, text)) ||
    (receipt.items ?? []).some((item) => includes(item.label, text))
  );
};

export const matchPurchaseQuery = (receipt: Receipt, query: PurchaseQuery): boolean => {
  if (query.text && !matchesText(receipt, query.text)) return false;
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
  if (query.warrantyStatus && warrantyStatusFor(receipt) !== query.warrantyStatus) return false;
  if (query.returnStatus && returnStatusFor(receipt) !== query.returnStatus) return false;
  return true;
};
