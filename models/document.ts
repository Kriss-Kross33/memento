import type { Currency } from '@/utils/currency';
import type { Receipt, ReceiptItem, ReceiptMedia } from '@/models/types';

/** What kind of document Memento is looking at — decided before receipt parsing. */
export type DocumentType =
  | 'receipt'
  | 'invoice'
  | 'utility_bill'
  | 'digital_receipt'
  | 'order_confirmation'
  | 'unknown';

export type DocumentClassification = {
  type: DocumentType;
  confidence: number;
  reasons: string[];
};

export type ReceiptSource = {
  id: string;
  uri: string;
  pageIndex: number;
  width: number;
  height: number;
};

export type ReceiptRegionKind = 'header' | 'items' | 'totals' | 'footer' | 'unknown';

export type ReceiptRegion = {
  kind: ReceiptRegionKind;
  pageIndex: number;
  startLineIndex: number;
  endLineIndex: number;
};

export type StructuredTax = {
  name: string;
  rate?: number;
  amount: number;
  confidence: number;
  source: string;
};

export type StructuredDiscount = {
  name: string;
  amount: number;
  confidence: number;
  source: string;
  kind: 'discount' | 'coupon' | 'promotion' | 'loyalty' | 'store_credit';
};

export type DetectedBarcode = {
  type: 'qr' | 'ean' | 'upc' | 'code128' | 'unknown';
  value: string;
  source: 'image' | 'ocr-text';
  confidence?: number;
};

export type FieldExplanation = {
  field: string;
  message: string;
  detail?: string;
};

export type ExplicitWarranty = {
  startDate?: string;
  duration?: string;
  expiryDate?: string;
  provider?: string;
  terms?: string;
  confidence: number;
  source: string;
};

export type ExplicitReturnPolicy = {
  startDate?: string;
  deadline?: string;
  duration?: string;
  policyText?: string;
  confidence: number;
  source: string;
};

/**
 * Logical receipt spanning one or more captured pages.
 * The image(s) remain the source of truth; this is the structured view.
 */
export type ReceiptDocument = {
  pages: ReceiptSource[];
  header?: ReceiptRegion;
  items: ReceiptItem[];
  itemGroups?: Array<{ pageIndex: number; items: ReceiptItem[] }>;
  totals?: {
    subtotal?: number;
    discount?: number;
    taxes?: StructuredTax[];
    total?: number;
  };
  footer?: ReceiptRegion;
};

/**
 * Searchable purchase record. A receipt image can produce one of these.
 * Existing `Receipt` rows map onto this shape without a data rewrite.
 */
export type PurchaseRecord = {
  id: string;
  merchant: string;
  purchaseDate: string;
  currency: Currency;
  subtotal?: number;
  discounts?: StructuredDiscount[];
  taxes?: StructuredTax[];
  total: number;
  receiptNumber?: string;
  items: ReceiptItem[];
  paymentMethod?: string;
  sourceMedia?: ReceiptMedia[];
  category: string;
  tags?: string[];
  notes?: string;
  warranty?: ExplicitWarranty;
  returnPolicy?: ExplicitReturnPolicy;
  confidence?: number;
  provenance?: string;
};

export const receiptToPurchaseRecord = (receipt: Receipt): PurchaseRecord => ({
  id: receipt.id,
  merchant: receipt.merchant,
  purchaseDate: receipt.date,
  currency: receipt.currency,
  subtotal: receipt.subtotal,
  discounts:
    receipt.discounts && receipt.discounts.length > 0
      ? receipt.discounts
      : receipt.discount && receipt.discount > 0
        ? [{ name: 'Discount', amount: receipt.discount, confidence: 0.7, source: 'stored', kind: 'discount' }]
        : undefined,
  taxes:
    receipt.taxes && receipt.taxes.length > 0
      ? receipt.taxes
      : receipt.tax && receipt.tax > 0
        ? [{ name: 'Tax', amount: receipt.tax, confidence: 0.7, source: 'stored' }]
        : undefined,
  total: receipt.amount,
  receiptNumber: receipt.receiptNumber,
  items: receipt.items ?? [],
  paymentMethod: receipt.paymentMethod,
  sourceMedia: receipt.sourceMedia?.length ? receipt.sourceMedia : receipt.media ? [receipt.media] : undefined,
  category: receipt.category,
  tags: receipt.tags,
  notes: receipt.notes,
  warranty: receipt.warrantyUntil
    ? { startDate: receipt.date, expiryDate: receipt.warrantyUntil, confidence: 1, source: 'user' }
    : undefined,
  returnPolicy:
    receipt.returnWindowDays != null
      ? { startDate: receipt.date, duration: `${receipt.returnWindowDays} days`, confidence: 1, source: 'user' }
      : undefined,
  confidence: receipt.ocr?.overallConfidence,
  provenance: receipt.fieldOrigins?.some((origin) => origin.source === 'user') ? 'user-corrected' : 'local-receipt',
});
