import { Currency } from '@/utils/currency';

/**
 * Memento domain model.
 *
 * These types describe the domain independently of how data is persisted.
 * Sync-related fields exist so a future sync engine can adopt the local
 * database without a breaking rewrite; in V1 they are always `LOCAL_ONLY`
 * and never surfaced in the UI (no fake sync indicators).
 */

/**
 * Future sync states. The local database is the primary source of truth;
 * sync is an enhancement, never a requirement for the app to function.
 */
export type SyncStatus =
  | 'LOCAL_ONLY'
  | 'PENDING_SYNC'
  | 'SYNCED'
  | 'SYNC_ERROR'
  | 'CONFLICT';

export type MediaStatus = 'ready' | 'missing' | 'processing';

/** A single line item on a receipt. Independent of the receipt image. */
export interface ReceiptItem {
  id: string;
  label: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  /** Present on freshly parsed items; not persisted per line. */
  confidence?: number;
  sourceLineIndex?: number;
  sourceBox?: { x: number; y: number; width: number; height: number };
  brand?: string;
  normalizedName?: string;
  sku?: string;
  barcode?: string;
  category?: string;
}

/**
 * Managed receipt media. `uri` always points at Memento's own app storage
 * (a private copy), never at the user's original Photos/Gallery asset.
 */
export interface ReceiptMedia {
  id: string;
  uri: string;
  thumbnailUri?: string;
  type?: 'image';
  status?: MediaStatus;
  addedAt: string;
  source: 'camera' | 'library' | 'file' | 'share' | 'pdf';
  pageIndex?: number;
}

export interface Receipt {
  id: string;
  merchant: string;
  date: string;
  /** Optional time of purchase, HH:mm. */
  time?: string;
  /** Receipt total. */
  amount: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  currency: Currency;
  category: string;
  categoryId?: string;
  notes?: string;
  items?: ReceiptItem[];
  media?: ReceiptMedia;
  tags?: string[];
  ocr?: OCRMetadata;
  /** ISO date the manufacturer/vendor warranty expires, if tracked. */
  warrantyUntil?: string;
  /** Length of the merchant return window in days, if tracked. */
  returnWindowDays?: number;
  /** Merchant reference printed on the receipt (V2: searchable, OCR-filled). */
  receiptNumber?: string;
  /** e.g. card / cash / mobile money (V2). */
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
  /** Sync metadata — always LOCAL_ONLY until a sync engine ships. */
  syncStatus?: SyncStatus;
  remoteId?: string | null;
  lastSyncedAt?: string | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  builtin?: boolean;
}

/** Future dedicated warranty records. Never invent a period. */
export interface Warranty {
  id: string;
  receiptId: string;
  productName: string;
  startDate: string;
  duration?: string;
  expiryDate?: string;
  provider?: string;
  terms?: string;
  notes?: string;
  confidence?: number;
  source?: string;
}

/** Future dedicated return-policy records. Never invent a deadline. */
export interface ReturnPolicy {
  id: string;
  receiptId: string;
  returnWindowDays?: number;
  startDate?: string;
  deadline?: string;
  expiryDate?: string;
  policyText?: string;
  notes?: string;
  confidence?: number;
  source?: string;
}

/** User-defined tags (#business, #tax, #travel, ...). */
export interface Tag {
  id: string;
  name: string;
}

export interface ReceiptTag {
  receiptId: string;
  tagId: string;
}

/**
 * OCR pipeline output, kept as structured confidence metadata so the
 * review screen can show "verify detected info" instead of silent guesses.
 */
export interface OCRMetadata {
  id: string;
  receiptId: string;
  processingStatus: 'pending' | 'done' | 'failed' | 'skipped';
  merchantConfidence?: number;
  dateConfidence?: number;
  totalConfidence?: number;
  currencyConfidence?: number;
  categoryConfidence?: number;
  itemsConfidence?: number;
  overallConfidence?: number;
  processedAt?: string;
  documentType?: string;
  documentTypeConfidence?: number;
  suggestedMerchant?: string;
  suggestedCategory?: string;
  reviewHints?: Array<{ field: string; message: string }>;
}
