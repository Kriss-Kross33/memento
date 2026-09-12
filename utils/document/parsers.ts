import type { DocumentClassification, DocumentType } from '@/models/document';
import type { LayoutDocument, ParseFallback, ParsedReceipt } from '@/utils/receipt/types';
import type { Anchor } from '@/utils/receipt/types';
import { resolveReceipt } from '@/utils/receipt/resolve';
import { extracted } from '@/utils/receipt/field';

export type ParseContext = {
  classification: DocumentClassification;
  anchors: Anchor[];
};

export type DocumentParser = {
  type: DocumentType;
  parse: (layout: LayoutDocument, fallback: ParseFallback, context: ParseContext) => ParsedReceipt;
};

const overlayClassification = (parsed: ParsedReceipt, classification: DocumentClassification): ParsedReceipt => ({
  ...parsed,
  documentType: classification,
});

const labeledValue = (text: string, labels: RegExp): string | undefined => {
  const match = text.match(labels);
  return match?.[1]?.trim();
};

export const receiptParser: DocumentParser = {
  type: 'receipt',
  parse: (layout, fallback, context) => overlayClassification(resolveReceipt(layout, fallback, context), context.classification),
};

export const invoiceParser: DocumentParser = {
  type: 'invoice',
  parse: (layout, fallback, context) => {
    const parsed = resolveReceipt(layout, fallback, context);
    const text = layout.lines.map((line) => line.text).join('\n');
    const invoiceNumber =
      labeledValue(text, /\binvoice\s*(?:no\.?|number|#)\s*[:.-]?\s*([A-Z0-9][A-Z0-9-]{3,})/i) ??
      parsed.receiptNumber?.value;
    const due = labeledValue(text, /\bdue\s*date\s*[:.-]?\s*([A-Za-z0-9,/ -]{6,})/i);
    const notes = [invoiceNumber ? `Invoice ${invoiceNumber}` : parsed.notes?.value, due ? `Due ${due}` : null]
      .filter(Boolean)
      .join(' · ');
    return overlayClassification(
      {
        ...parsed,
        receiptNumber: extracted(invoiceNumber, invoiceNumber ? 0.84 : 0.2, undefined, invoiceNumber ?? 'none'),
        notes: extracted(notes || undefined, notes ? 0.78 : 0.3, undefined, notes ? 'invoice-fields' : 'none'),
        items: { ...parsed.items, value: parsed.items.value, source: 'invoice-parser' },
      },
      context.classification
    );
  },
};

export const utilityBillParser: DocumentParser = {
  type: 'utility_bill',
  parse: (layout, fallback, context) => {
    const parsed = resolveReceipt(layout, fallback, context);
    const text = layout.lines.map((line) => line.text).join('\n');
    const account = labeledValue(text, /\baccount\s*(?:no\.?|number|#)\s*[:.-]?\s*([A-Z0-9-]{4,})/i);
    const meter = labeledValue(text, /\bmeter\s*(?:id|no\.?|number|#)?\s*[:.-]?\s*([A-Z0-9-]{4,})/i);
    const notes = [account ? `Account ${account}` : null, meter ? `Meter ${meter}` : null, parsed.notes?.value]
      .filter(Boolean)
      .join(' · ');
    return overlayClassification(
      {
        ...parsed,
        category: parsed.category.value === 'Other' ? { ...parsed.category, value: 'Utilities', confidence: 0.9, source: 'utility-parser' } : parsed.category,
        notes: extracted(notes || undefined, notes ? 0.8 : parsed.notes?.confidence ?? 0.3, undefined, 'utility-fields'),
      },
      context.classification
    );
  },
};

export const digitalReceiptParser: DocumentParser = {
  type: 'digital_receipt',
  parse: (layout, fallback, context) => {
    const parsed = resolveReceipt(layout, fallback, context);
    const text = layout.lines.map((line) => line.text).join('\n');
    const order =
      labeledValue(text, /\border\s*(?:no\.?|number|#)\s*[:.-]?\s*([A-Z0-9-]{4,})/i) ?? parsed.receiptNumber?.value;
    return overlayClassification(
      {
        ...parsed,
        receiptNumber: extracted(order, order ? 0.82 : parsed.receiptNumber?.confidence ?? 0.2, undefined, order ?? 'none'),
      },
      context.classification
    );
  },
};

const PARSERS: Record<DocumentType, DocumentParser> = {
  receipt: receiptParser,
  invoice: invoiceParser,
  utility_bill: utilityBillParser,
  digital_receipt: digitalReceiptParser,
  order_confirmation: digitalReceiptParser,
  unknown: receiptParser,
};

/**
 * Uncertain documents still use the receipt parser so the user can save a purchase.
 */
export const selectDocumentParser = (
  classification: DocumentClassification,
  forceType?: DocumentType
): DocumentParser => {
  if (forceType) return PARSERS[forceType] ?? receiptParser;
  if (classification.type === 'unknown' || classification.confidence < 0.62) return receiptParser;
  return PARSERS[classification.type] ?? receiptParser;
};
