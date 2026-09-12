import { Receipt } from '@/models/types';
import { formatMoney } from '@/utils/currency';

/**
 * Local CSV generation for receipt exports. Runs entirely on-device —
 * no network, no account, no backend.
 */

const csvEscape = (value: string): string => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const describeItems = (receipt: Receipt): string =>
  (receipt.items ?? [])
    .filter((i) => i.label.trim() || i.unitPrice > 0)
    .map((i) => `${i.label.trim() || 'Item'} ×${i.quantity} @ ${formatMoney(i.unitPrice, receipt.currency)}`)
    .join('; ');

/** Builds a spreadsheet-friendly CSV of receipts. Returns the full text. */
export const buildReceiptsCsv = (receipts: Receipt[]): string => {
  const header = [
    'Date',
    'Merchant',
    'Category',
    'Currency',
    'Total',
    'Receipt number',
    'Items',
    'Warranty until',
    'Tags',
    'Notes',
  ];

  const rows = receipts.map((r) => [
    r.date,
    r.merchant,
    r.category,
    r.currency,
    r.amount.toFixed(2),
    r.receiptNumber ?? '',
    describeItems(r),
    r.warrantyUntil ?? '',
    (r.tags ?? []).join(' '),
    (r.notes ?? '').replace(/\n/g, ' '),
  ]);

  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
};

/** Suggested export filename, e.g. receipts-2026-09-11.csv */
export const buildExportFilename = (date = new Date()): string =>
  `receiptsnap-receipts-${date.toISOString().split('T')[0]}.csv`;
