import { Receipt } from '@/models/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type ProtectionKind = 'return' | 'warranty';
export type ReturnStatus = 'eligible' | 'approaching' | 'expired' | 'returned' | 'unknown';
export type WarrantyStatus = 'active' | 'expired' | 'unknown';

export interface ProtectionItem {
  receiptId: string;
  merchant: string;
  kind: ProtectionKind;
  expiryDate: string;
  daysLeft: number;
  label: string;
}

const addDays = (iso: string, days: number): string => {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const daysUntil = (iso: string, now = new Date()): number => {
  const expiry = new Date(iso);
  expiry.setHours(0, 0, 0, 0);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - start.getTime()) / DAY_MS);
};

export const protectionItemsFor = (receipts: Receipt[], now = new Date()): ProtectionItem[] => {
  const items: ProtectionItem[] = [];
  for (const receipt of receipts) {
    if (receipt.returnWindowDays) {
      const expiryDate = addDays(receipt.date, receipt.returnWindowDays);
      const daysLeft = daysUntil(expiryDate, now);
      items.push({
        receiptId: receipt.id,
        merchant: receipt.merchant.trim() || 'Unfiled receipt',
        kind: 'return',
        expiryDate,
        daysLeft,
        label:
          daysLeft < 0
            ? `Return window ended ${Math.abs(daysLeft)} days ago`
            : daysLeft === 0
              ? 'Return window ends today'
              : `Return window expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      });
    }
    if (receipt.warrantyUntil) {
      const daysLeft = daysUntil(receipt.warrantyUntil, now);
      items.push({
        receiptId: receipt.id,
        merchant: receipt.merchant.trim() || 'Unfiled receipt',
        kind: 'warranty',
        expiryDate: receipt.warrantyUntil,
        daysLeft,
        label:
          daysLeft < 0
            ? `Warranty ended ${Math.abs(daysLeft)} days ago`
            : daysLeft === 0
              ? 'Warranty ends today'
              : `Warranty expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      });
    }
  }
  return items.sort((a, b) => a.daysLeft - b.daysLeft);
};

export const urgentProtection = (receipts: Receipt[], withinDays = 7): ProtectionItem[] =>
  protectionItemsFor(receipts).filter((item) => item.daysLeft >= 0 && item.daysLeft <= withinDays);

export const returnStatusFor = (receipt: Receipt, now = new Date()): ReturnStatus => {
  if (receipt.returnWindowDays == null) return 'unknown';
  const expiryDate = addDays(receipt.date, receipt.returnWindowDays);
  const daysLeft = daysUntil(expiryDate, now);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 3) return 'approaching';
  return 'eligible';
};

export const warrantyStatusFor = (receipt: Receipt, now = new Date()): WarrantyStatus => {
  if (!receipt.warrantyUntil) return 'unknown';
  return daysUntil(receipt.warrantyUntil, now) < 0 ? 'expired' : 'active';
};

/** Quiet status copy. Only mentions a deadline when one was stored. */
export const returnStatusCopy = (receipt: Receipt, now = new Date()): string | undefined => {
  if (receipt.returnWindowDays == null) return undefined;
  const expiryDate = addDays(receipt.date, receipt.returnWindowDays);
  const daysLeft = daysUntil(expiryDate, now);
  if (daysLeft < 0) return 'Return window expired.';
  if (daysLeft === 0) return 'Return available today.';
  if (daysLeft === 1) return 'Return available for 1 more day.';
  return `Return available for ${daysLeft} more days.`;
};

export const warrantyStatusCopy = (receipt: Receipt, now = new Date()): string | undefined => {
  if (!receipt.warrantyUntil) return undefined;
  const daysLeft = daysUntil(receipt.warrantyUntil, now);
  if (daysLeft < 0) return 'Warranty expired.';
  if (daysLeft === 0) return 'Warranty ends today.';
  return daysLeft === 1 ? 'Warranty active — 1 day left.' : `Warranty active — ${daysLeft} days left.`;
};
