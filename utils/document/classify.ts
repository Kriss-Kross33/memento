import type { DocumentClassification, DocumentType } from '@/models/document';
import type { Anchor, LayoutDocument } from '@/utils/receipt/types';
import { fuzzyHasTerm } from '@/utils/receipt/vocabulary';

const RECEIPT_TERMS = [
  'total',
  'subtotal',
  'cash',
  'change',
  'vat',
  'gst',
  'item',
  'tender',
  'cashier',
  'eat in',
  'takeaway',
];
const INVOICE_TERMS = ['bill to', 'invoice number', 'invoice no', 'due date', 'payment terms', 'terms net'];
const UTILITY_TERMS = [
  'meter',
  'account number',
  'account no',
  'usage',
  'reading',
  'prepaid',
  'consumption',
  'service address',
  'kilowatt',
  'kwh',
];
const DIGITAL_TERMS = [
  'order confirmation',
  'purchase confirmation',
  'online order',
  'order number',
  'order no',
  'shipped to',
  'sold by',
  'your order',
];
const ORDER_TERMS = ['order confirmation', 'purchase confirmation', 'thanks for your order'];

const countHits = (text: string, terms: string[]): { hits: number; reasons: string[] } => {
  const reasons: string[] = [];
  let hits = 0;
  for (const term of terms) {
    if (fuzzyHasTerm(text, [term], 0.86) || new RegExp(`\\b${term.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) {
      hits += 1;
      reasons.push(term);
    }
  }
  return { hits, reasons };
};

const score = (hits: number, weight: number, bonus = 0): number =>
  Math.min(0.99, hits * weight + bonus);

export const classifyDocument = (
  layout: LayoutDocument,
  anchors: Anchor[] = []
): DocumentClassification => {
  const text = layout.lines.map((line) => line.text).join('\n');
  const receiptHits = countHits(text, RECEIPT_TERMS);
  const invoiceHits = countHits(text, INVOICE_TERMS);
  const utilityHits = countHits(text, UTILITY_TERMS);
  const digitalHits = countHits(text, DIGITAL_TERMS);
  const orderHits = countHits(text, ORDER_TERMS);

  const hasPayable = anchors.some((anchor) => anchor.role === 'total' || anchor.role === 'subtotal');
  const hasCash = anchors.some((anchor) => anchor.role === 'payment' || anchor.role === 'change');
  const looksLikeEmail = /@|\b(from|subject|sent):/i.test(text);

  const scores: Record<Exclude<DocumentType, 'unknown'>, { value: number; reasons: string[] }> = {
    receipt: {
      value: score(receiptHits.hits, 0.12, (hasPayable ? 0.18 : 0) + (hasCash ? 0.16 : 0)),
      reasons: [
        ...receiptHits.reasons.map((reason) => `receipt:${reason}`),
        ...(hasPayable ? ['receipt:payable-total'] : []),
        ...(hasCash ? ['receipt:tender'] : []),
      ],
    },
    invoice: {
      value: score(invoiceHits.hits, 0.22, invoiceHits.hits >= 2 ? 0.2 : 0),
      reasons: invoiceHits.reasons.map((reason) => `invoice:${reason}`),
    },
    utility_bill: {
      value: score(utilityHits.hits, 0.2, utilityHits.hits >= 2 ? 0.18 : 0),
      reasons: utilityHits.reasons.map((reason) => `utility:${reason}`),
    },
    digital_receipt: {
      value: score(digitalHits.hits, 0.18, looksLikeEmail ? 0.12 : 0),
      reasons: [
        ...digitalHits.reasons.map((reason) => `digital:${reason}`),
        ...(looksLikeEmail ? ['digital:email-metadata'] : []),
      ],
    },
    order_confirmation: {
      value: score(orderHits.hits, 0.32, orderHits.hits > 0 ? 0.15 : 0),
      reasons: orderHits.reasons.map((reason) => `order:${reason}`),
    },
  };

  // Thermal / POS receipts often print "TAX INVOICE". Tender + totals win.
  if (scores.receipt.value >= 0.45 && scores.invoice.value > 0 && scores.invoice.value < scores.receipt.value + 0.15) {
    scores.invoice.value *= 0.45;
  }
  if (scores.order_confirmation.value >= 0.4) {
    scores.digital_receipt.value = Math.min(scores.digital_receipt.value, scores.order_confirmation.value - 0.05);
  }

  const ranked = (Object.entries(scores) as Array<[Exclude<DocumentType, 'unknown'>, { value: number; reasons: string[] }]>)
    .sort((a, b) => b[1].value - a[1].value);
  const [bestType, best] = ranked[0];
  const second = ranked[1]?.[1].value ?? 0;

  if (best.value < 0.28) {
    return { type: 'unknown', confidence: 0.34, reasons: ['No strong document signals'] };
  }
  const confidence = Math.max(0.3, Math.min(0.97, best.value - Math.max(0, second - 0.2) * 0.25));
  return { type: bestType, confidence: Number(confidence.toFixed(3)), reasons: best.reasons.slice(0, 8) };
};
