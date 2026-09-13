import type { DuplicateMatch } from '@/models/intelligence';
import { normalizeMerchantKey } from '@/services/intelligence/merchantMemory';

export type DuplicateCandidate = {
  id: string;
  merchant: string;
  date: string;
  amount: number;
  receiptNumber?: string;
  itemLabels?: string[];
};

const almost = (a: number, b: number, slack = 0.02): boolean => Math.abs(a - b) <= slack;

export const scoreDuplicate = (left: DuplicateCandidate, right: DuplicateCandidate): DuplicateMatch => {
  const reasons: string[] = [];
  let score = 0;
  if (left.id === right.id) return { receiptId: right.id, score: 1, reasons: ['same-record'] };

  if (left.receiptNumber && right.receiptNumber && left.receiptNumber === right.receiptNumber) {
    score += 0.45;
    reasons.push('receipt-number');
  }
  if (left.date && left.date === right.date) {
    score += 0.2;
    reasons.push('same-date');
  }
  if (almost(left.amount, right.amount, 0.05) && left.amount > 0) {
    score += 0.25;
    reasons.push('same-total');
  }
  const merchantScore =
    normalizeMerchantKey(left.merchant) &&
    normalizeMerchantKey(left.merchant) === normalizeMerchantKey(right.merchant);
  if (merchantScore) {
    score += 0.2;
    reasons.push('same-merchant');
  }
  const leftItems = new Set((left.itemLabels ?? []).map((label) => label.toLowerCase()));
  const overlap = (right.itemLabels ?? []).filter((label) => leftItems.has(label.toLowerCase())).length;
  if (overlap >= 3) {
    score += 0.1;
    reasons.push('item-overlap');
  }

  return {
    receiptId: right.id,
    score: Number(Math.min(0.99, score).toFixed(3)),
    reasons,
  };
};

export const findDuplicateMatches = (
  incoming: Omit<DuplicateCandidate, 'id'> & { id?: string },
  existing: DuplicateCandidate[],
  threshold = 0.72
): DuplicateMatch[] =>
  existing
    .filter((candidate) => candidate.id !== incoming.id)
    .map((candidate) => scoreDuplicate({ ...incoming, id: incoming.id ?? '' }, candidate))
    .filter((match) => match.score >= threshold)
    .sort((a, b) => b.score - a.score);
