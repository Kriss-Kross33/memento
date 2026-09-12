import type { Currency } from '@/utils/currency';
import type { ReceiptItem } from '@/models/types';
import type { OcrBox, OcrDocument, OcrLine } from '@/services/ocr/types';
import type {
  DocumentClassification,
  ExplicitReturnPolicy,
  ExplicitWarranty,
  FieldExplanation,
  StructuredDiscount,
  StructuredTax,
} from '@/models/document';

export type ExtractedField<T> = {
  value: T;
  confidence: number;
  source?: string;
  sourceLineIndex?: number;
  sourceText?: string;
  sourceBox?: OcrBox;
};

export type ReviewField = 'merchant' | 'date' | 'amount' | 'currency' | 'category' | 'items';

export type ReviewState = 'high' | 'medium' | 'low';

export type ReviewRequirement = {
  field: ReviewField;
  reason: string;
};

export type ReceiptWarningCode =
  | 'items-exceed-total'
  | 'subtotal-mismatch'
  | 'line-math'
  | 'payment-as-total'
  | 'tax-as-total'
  | 'totals-inconsistent'
  | 'competing-totals'
  | 'duplicate-total-as-item'
  | 'discount-as-item'
  | 'totals-math';

export type ReceiptWarning = {
  code: ReceiptWarningCode;
  message: string;
};

export type ReceiptValidation = {
  isConsistent: boolean;
  score: number;
  warnings: ReceiptWarning[];
};

export type ParsedReceipt = {
  merchant: ExtractedField<string>;
  date: ExtractedField<string>;
  amount: ExtractedField<number>;
  currency: ExtractedField<Currency>;
  category: ExtractedField<string>;
  receiptNumber?: ExtractedField<string | undefined>;
  notes?: ExtractedField<string | undefined>;
  items: ExtractedField<ReceiptItem[]>;
  subtotal?: ExtractedField<number | undefined>;
  tax?: ExtractedField<number | undefined>;
  discount?: ExtractedField<number | undefined>;
  taxes?: StructuredTax[];
  discounts?: StructuredDiscount[];
  documentType?: DocumentClassification;
  explanations?: FieldExplanation[];
  warranty?: ExplicitWarranty;
  returnPolicy?: ExplicitReturnPolicy;
  validation: ReceiptValidation;
  overallConfidence: number;
  reviewState: ReviewState;
  reviewRequirements: ReviewRequirement[];
};

export type ParsedReceiptFields = {
  merchant: string;
  date: string;
  amount: number;
  currency: Currency;
  category: string;
  receiptNumber?: string;
  notes?: string;
  items?: ReceiptItem[];
};

export type ParseFallback = { date: string; currency: Currency };

export type LayoutLine = {
  index: number;
  text: string;
  line: OcrLine;
  box: OcrBox;
  centerX: number;
  centerY: number;
  normalizedX: number;
  normalizedY: number;
  heightRatio: number;
  leftColumnScore: number;
  rightColumnScore: number;
  ocrConfidence: number;
};

export type ReceiptRegions = {
  itemMaxLineIndex: number;
  totalsMinLineIndex: number;
  totalsMaxLineIndex: number;
};

export type LayoutRow = {
  id: string;
  y: number;
  lines: LayoutLine[];
};

export type LayoutDocument = {
  source: OcrDocument;
  width: number;
  height: number;
  lines: LayoutLine[];
  rows: LayoutRow[];
};

export type AmountCandidate = {
  value: number;
  text: string;
  box: OcrBox;
  lineIndex: number;
  roleScores: Record<
    'itemPrice' | 'subtotal' | 'tax' | 'discount' | 'total' | 'cash' | 'change' | 'unknown',
    number
  >;
  confidence: number;
};

export type AnchorRole = 'subtotal' | 'tax' | 'discount' | 'total' | 'cash' | 'change' | 'payment' | 'date';

export type Anchor = {
  role: AnchorRole;
  lineIndex: number;
  confidence: number;
  rank?: number;
};
