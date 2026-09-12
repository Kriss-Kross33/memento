import { Receipt } from '@/models/types';
import { Currency } from '@/utils/currency';

/**
 * Lightweight local insights. Everything is computed from the receipts
 * already on the device — no network, no backend, no aggregated profile.
 *
 * Amounts from different currencies are never added together.
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

export interface CurrencyTotal {
  currency: Currency;
  total: number;
  count: number;
}

export interface PeriodBar {
  label: string;
  total: number;
}

export interface Insights {
  count: number;
  total: number;
  average: number;
  currency?: Currency;
  largest: Receipt | null;
  topCategories: CategoryInsight[];
  topMerchants: MerchantInsight[];
}

export const isSameMonth = (iso: string, reference: Date): boolean => {
  const d = new Date(iso);
  return d.getMonth() === reference.getMonth() && d.getFullYear() === reference.getFullYear();
};

export const receiptsInMonth = (receipts: Receipt[], reference = new Date()): Receipt[] =>
  receipts.filter((receipt) => isSameMonth(receipt.date, reference));

export const previousMonth = (reference = new Date()): Date =>
  new Date(reference.getFullYear(), reference.getMonth() - 1, 1);

/** Totals by currency. Mixed currencies stay separate. */
export const totalsByCurrency = (receipts: Receipt[]): CurrencyTotal[] => {
  const map = new Map<Currency, { total: number; count: number }>();
  for (const receipt of receipts) {
    const current = map.get(receipt.currency) ?? { total: 0, count: 0 };
    map.set(receipt.currency, {
      total: current.total + receipt.amount,
      count: current.count + 1,
    });
  }
  return Array.from(map.entries())
    .map(([currency, value]) => ({ currency, total: value.total, count: value.count }))
    .sort((a, b) => b.total - a.total);
};

export const currencyTrend = (
  receipts: Receipt[],
  currency: Currency,
  reference = new Date()
): { current: number; previous: number; percent: number } => {
  const current = receiptsInMonth(receipts, reference)
    .filter((receipt) => receipt.currency === currency)
    .reduce((sum, receipt) => sum + receipt.amount, 0);
  const previous = receiptsInMonth(receipts, previousMonth(reference))
    .filter((receipt) => receipt.currency === currency)
    .reduce((sum, receipt) => sum + receipt.amount, 0);
  return {
    current,
    previous,
    percent: previous === 0 ? 0 : ((current - previous) / previous) * 100,
  };
};

/** Week buckets for the month of `reference` (1–7, 8–14, 15–21, 22–end). */
export const weeklySpend = (
  receipts: Receipt[],
  currency: Currency,
  reference = new Date()
): PeriodBar[] => {
  const buckets = [
    { label: '1–7', total: 0 },
    { label: '8–14', total: 0 },
    { label: '15–21', total: 0 },
    { label: '22+', total: 0 },
  ];
  for (const receipt of receiptsInMonth(receipts, reference)) {
    if (receipt.currency !== currency) continue;
    const day = new Date(receipt.date).getDate();
    const index = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
    buckets[index].total += receipt.amount;
  }
  return buckets;
};

/** Put the preferred currency first so Home/Insights lead with the user's default. */
export const sortCurrencyTotals = (
  totals: CurrencyTotal[],
  preferred: Currency
): CurrencyTotal[] =>
  [...totals].sort((a, b) => {
    if (a.currency === preferred && b.currency !== preferred) return -1;
    if (b.currency === preferred && a.currency !== preferred) return 1;
    return b.total - a.total;
  });

/** Prefer the user's default currency when it has spend; otherwise the largest bucket. */
export const pickDisplayCurrency = (
  totals: CurrencyTotal[],
  preferred: Currency
): Currency | undefined => {
  if (totals.some((entry) => entry.currency === preferred)) return preferred;
  return totals[0]?.currency;
};

/** Insights for the month of `reference`, limited to one currency so amounts stay comparable. */
export const computeMonthlyInsights = (
  receipts: Receipt[],
  reference: Date,
  currency: Currency
): Insights => {
  const monthReceipts = receiptsInMonth(receipts, reference).filter((receipt) =>
    currency ? receipt.currency === currency : true
  );
  const total = monthReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  const count = monthReceipts.length;

  const byCategory = new Map<string, number>();
  const byMerchant = new Map<string, { count: number; total: number }>();
  for (const receipt of monthReceipts) {
    byCategory.set(receipt.category, (byCategory.get(receipt.category) ?? 0) + receipt.amount);
    const key = receipt.merchant.trim() || 'Unknown merchant';
    const merchant = byMerchant.get(key) ?? { count: 0, total: 0 };
    byMerchant.set(key, { count: merchant.count + 1, total: merchant.total + receipt.amount });
  }

  const topCategories: CategoryInsight[] = Array.from(byCategory.entries())
    .map(([name, catTotal]) => ({ name, total: catTotal, share: total > 0 ? catTotal / total : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const topMerchants: MerchantInsight[] = Array.from(byMerchant.entries())
    .map(([name, merchant]) => ({ name, count: merchant.count, total: merchant.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const largest = monthReceipts.reduce<Receipt | null>(
    (max, receipt) => (max === null || receipt.amount > max.amount ? receipt : max),
    null
  );

  return {
    count,
    total,
    average: count > 0 ? total / count : 0,
    currency,
    largest,
    topCategories,
    topMerchants,
  };
};
