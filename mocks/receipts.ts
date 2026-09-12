import { Currency, DEFAULT_CURRENCY, isCurrency } from '@/utils/currency';
import {
  Receipt,
  ReceiptItem,
  ReceiptMedia,
  Warranty,
  ReturnPolicy,
  Tag,
  SyncStatus,
  OCRMetadata,
  Category,
} from '@/models/types';
import { builtinCategories } from '@/services/categoryRepository';

// The domain model lives in @/models/types; re-exported here for the
// legacy import surface. New code should import from '@/models/types'.
export type { Receipt, ReceiptItem, ReceiptMedia, Warranty, ReturnPolicy, Tag, SyncStatus, OCRMetadata, Category };

export const categories: Category[] = builtinCategories;

export const getCategory = (name: string): Category | undefined =>
  categories.find((c) => c.name === name);

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

/** Normalizes records stored by older app versions to the current model. */
export const normalizeReceipt = (raw: Record<string, unknown>): Receipt => {
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString();
  return {
    id: String(raw.id ?? Date.now().toString()),
    merchant: typeof raw.merchant === 'string' ? raw.merchant : '',
    date: typeof raw.date === 'string' ? raw.date : daysAgo(0),
    amount: typeof raw.amount === 'number' && Number.isFinite(raw.amount) ? raw.amount : 0,
    currency: isCurrency(raw.currency) ? raw.currency : DEFAULT_CURRENCY,
    category: typeof raw.category === 'string' ? raw.category : 'Other',
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    items: Array.isArray(raw.items) ? (raw.items as ReceiptItem[]) : undefined,
    media: (raw.media as ReceiptMedia | undefined) ?? undefined,
    warrantyUntil: typeof raw.warrantyUntil === 'string' ? raw.warrantyUntil : undefined,
    returnWindowDays:
      typeof raw.returnWindowDays === 'number' && Number.isFinite(raw.returnWindowDays)
        ? raw.returnWindowDays
        : undefined,
    receiptNumber: typeof raw.receiptNumber === 'string' ? raw.receiptNumber : undefined,
    paymentMethod: typeof raw.paymentMethod === 'string' ? raw.paymentMethod : undefined,
    time: typeof raw.time === 'string' ? raw.time : undefined,
    subtotal: typeof raw.subtotal === 'number' && Number.isFinite(raw.subtotal) ? raw.subtotal : undefined,
    tax: typeof raw.tax === 'number' && Number.isFinite(raw.tax) ? raw.tax : undefined,
    discount: typeof raw.discount === 'number' && Number.isFinite(raw.discount) ? raw.discount : undefined,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
    createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt,
    // Local-first: every record starts life as LOCAL_ONLY.
    syncStatus: 'LOCAL_ONLY',
  };
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

/** Long, unambiguous date for detail screens. */
export const formatFullDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/** "Aug 2026" style month label used by library section headers. */
export const formatMonthLabel = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
