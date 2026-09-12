import type { Currency } from '@/utils/currency';
import type { ReceiptItem } from '@/models/types';
import type { OcrBox, OcrDocument, OcrLine } from '@/services/ocr/types';

export type ExtractedField<T> = {
  value: T;
  confidence: number;
  source?: string;
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
  overallConfidence: number;
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
  roleScores: Record<'itemPrice' | 'subtotal' | 'tax' | 'total' | 'cash' | 'change' | 'unknown', number>;
  confidence: number;
};

export type AnchorRole = 'subtotal' | 'tax' | 'total' | 'cash' | 'change' | 'payment' | 'date';

export type Anchor = {
  role: AnchorRole;
  lineIndex: number;
  confidence: number;
};
