import type { StructuredDiscount, StructuredTax } from '@/models/document';
import type { AmountCandidate, LayoutDocument } from '@/utils/receipt/types';
import { fuzzyHasTerm } from '@/utils/receipt/vocabulary';
import { parseAmountToken } from '@/utils/receipt/amounts';

const TAX_NAMES: Array<{ name: string; terms: string[]; rate?: number }> = [
  { name: 'VAT', terms: ['vat'] },
  { name: 'GST', terms: ['gst'] },
  { name: 'NHIL', terms: ['nhil'] },
  { name: 'GETFund', terms: ['getfund', 'get fund', 'get-fund'] },
  { name: 'Levy', terms: ['levy'] },
  { name: 'Service charge', terms: ['service charge', 'service fee'] },
  { name: 'Tax', terms: ['tax', 'sales tax'] },
];

const DISCOUNT_KINDS: Array<{
  kind: StructuredDiscount['kind'];
  name: string;
  terms: string[];
}> = [
  { kind: 'coupon', name: 'Coupon', terms: ['coupon'] },
  { kind: 'loyalty', name: 'Loyalty', terms: ['loyalty', 'rewards'] },
  { kind: 'store_credit', name: 'Store credit', terms: ['store credit', 'gift card'] },
  { kind: 'promotion', name: 'Promotion', terms: ['promo', 'promotion', 'savings'] },
  { kind: 'discount', name: 'Discount', terms: ['discount'] },
];

const signedAmount = (raw: string): number | null => {
  const negative = /-\s*\d/.test(raw) || /\(.*\d.*\)/.test(raw);
  const value = parseAmountToken(raw.replace(/[()]/g, '').replace(/^\s*-/, ''));
  if (value == null) return null;
  return negative ? -Math.abs(value) : value;
};

const lineAmount = (
  text: string,
  candidates: AmountCandidate[],
  lineIndex: number,
  role?: 'tax' | 'discount'
): number | null => {
  const nearby = candidates
    .filter((candidate) => {
      const close = Math.abs(candidate.lineIndex - lineIndex) <= 1;
      if (!close) return false;
      if (!role) return true;
      return candidate.lineIndex === lineIndex || candidate.roleScores[role] >= 0.45;
    })
    .sort((a, b) => Math.abs(a.lineIndex - lineIndex) - Math.abs(b.lineIndex - lineIndex))[0];
  if (nearby) return nearby.value;
  const match = text.match(/-?\s*(?:GH₵|GHC|GHS|SGD|USD|GBP|EUR|[$£€₵])?\s*\d[\d.,]*/);
  if (!match) return null;
  const parsed = signedAmount(match[0]);
  return parsed == null ? null : Math.abs(parsed);
};

export const extractTaxes = (layout: LayoutDocument, amounts: AmountCandidate[]): StructuredTax[] => {
  const taxes: StructuredTax[] = [];
  for (const line of layout.lines) {
    for (const tax of TAX_NAMES) {
      if (!fuzzyHasTerm(line.text, tax.terms, 0.86)) continue;
      const amount = lineAmount(line.text, amounts, line.index, 'tax');
      if (amount == null || amount <= 0) continue;
      if (taxes.some((entry) => entry.name === tax.name && Math.abs(entry.amount - amount) < 0.01)) continue;
      const rateMatch = line.text.match(/(\d{1,2}(?:\.\d+)?)\s*%/);
      taxes.push({
        name: tax.name,
        rate: rateMatch ? Number(rateMatch[1]) : tax.rate,
        amount,
        confidence: 0.82,
        source: line.text,
      });
      break;
    }
  }
  return taxes;
};

export const extractDiscounts = (layout: LayoutDocument, amounts: AmountCandidate[]): StructuredDiscount[] => {
  const discounts: StructuredDiscount[] = [];
  for (const line of layout.lines) {
    for (const discount of DISCOUNT_KINDS) {
      if (!fuzzyHasTerm(line.text, discount.terms, 0.86)) continue;
      const amount = lineAmount(line.text, amounts, line.index, 'discount');
      if (amount == null || amount <= 0) continue;
      if (discounts.some((entry) => Math.abs(entry.amount - amount) < 0.01)) continue;
      discounts.push({
        name: discount.name,
        amount,
        confidence: 0.8,
        source: line.text,
        kind: discount.kind,
      });
      break;
    }
  }
  return discounts;
};

export const pickPrintedSubtotal = (amounts: AmountCandidate[]): number | undefined => {
  const candidate = amounts
    .filter((entry) => entry.roleScores.subtotal >= 0.8)
    .sort((a, b) => b.roleScores.subtotal - a.roleScores.subtotal)[0];
  return candidate?.value;
};

export const sumCharges = (taxes: StructuredTax[]): number =>
  taxes.reduce((sum, tax) => sum + tax.amount, 0);

export const sumDiscounts = (discounts: StructuredDiscount[]): number =>
  discounts.reduce((sum, discount) => sum + discount.amount, 0);
