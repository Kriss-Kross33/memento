import { Receipt } from '@/models/types';
import { Currency } from '@/utils/currency';

/**
 * Lightweight local insights. Everything is computed from the receipts
 * already on the device — no network, no backend, no aggregated profile.
 */

export interface CategoryInsight {
  name: string;
  total: number;
  /** Share of total spend, 0–1. */
  share: number;
}

export interface MerchantInsight {
  name: string;
  count: number;
  total: number;
}

export interface Insights {
  count: number;
  total: number;
  average: number;
  largest: Receipt | null;
  topCategories: CategoryInsight[];
  topMerchants: MerchantInsight[];
}

const isSameMonth = (iso: string, reference: Date): boolean => {
  const d = new Date(iso);
  return d.getMonth() === reference.getMonth() && d.getFullYear() === reference.getFullYear();
};

/** Insights for the month of `reference` (defaults to the current month). */
export const computeMonthlyInsights = (receipts: Receipt[], reference = new Date()): Insights => {
  const monthReceipts = receipts.filter((r) => isSameMonth(r.date, reference));
  const total = monthReceipts.reduce((sum, r) => sum + r.amount, 0);
  const count = monthReceipts.length;

  const byCategory = new Map<string, number>();
  const byMerchant = new Map<string, { count: number; total: number }>();
  for (const r of monthReceipts) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.amount);
    const key = r.merchant.trim() || 'Unknown merchant';
    const m = byMerchant.get(key) ?? { count: 0, total: 0 };
    byMerchant.set(key, { count: m.count + 1, total: m.total + r.amount });
  }

  const topCategories: CategoryInsight[] = Array.from(byCategory.entries())
    .map(([name, catTotal]) => ({ name, total: catTotal, share: total > 0 ? catTotal / total : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);

  const topMerchants: MerchantInsight[] = Array.from(byMerchant.entries())
    .map(([name, m]) => ({ name, count: m.count, total: m.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const largest = monthReceipts.reduce<Receipt | null>(
    (max, r) => (max === null || r.amount > max.amount ? r : max),
    null
  );

  return {
    count,
    total,
    average: count > 0 ? total / count : 0,
    largest,
    topCategories,
    topMerchants,
  };
};

/**
 * Totals by currency for a set of receipts. Mixed currencies are never summed
 * into one number — each currency keeps its own total.
 */
export const totalsByCurrency = (receipts: Receipt[]): { currency: Currency; total: number }[] => {
  const map = new Map<Currency, number>();
  for (const r of receipts) {
    map.set(r.currency, (map.get(r.currency) ?? 0) + r.amount);
  }
  return Array.from(map.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);
};
