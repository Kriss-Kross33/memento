import type { ReceiptItem } from '@/models/types';
import type { AmountCandidate, ReceiptValidation } from '@/utils/receipt/types';

const almost = (a: number, b: number, slack = 0.08): boolean => Math.abs(a - b) <= slack;

export const validateReceipt = ({
  total,
  items,
  amounts = [],
}: {
  total: number;
  items: ReceiptItem[];
  amounts?: AmountCandidate[];
}): ReceiptValidation => {
  const warnings: ReceiptValidation['warnings'] = [];
  let score = 1;

  const itemSum = items.reduce((sum, item) => sum + (item.total ?? item.quantity * item.unitPrice), 0);
  if (total > 0 && items.length > 0 && itemSum > total + 0.15) {
    warnings.push({
      code: 'items-exceed-total',
      message: 'Line items add up to more than the receipt total.',
    });
    score -= 0.28;
  }

  const subtotalCandidate = amounts
    .filter((candidate) => candidate.roleScores.subtotal >= 0.8)
    .sort((a, b) => b.roleScores.subtotal - a.roleScores.subtotal)[0];
  if (subtotalCandidate && items.length > 0 && !almost(subtotalCandidate.value, itemSum, 0.2)) {
    warnings.push({
      code: 'subtotal-mismatch',
      message: 'Printed subtotal does not match the sum of line items.',
    });
    score -= 0.16;
  }

  const brokenLines = items.filter((item) => {
    const expected = item.quantity * item.unitPrice;
    const lineTotal = item.total ?? expected;
    return item.quantity > 1 && !almost(expected, lineTotal, 0.12);
  }).length;
  if (brokenLines > 0) {
    warnings.push({
      code: 'line-math',
      message: 'Quantity × unit price does not match a line total.',
    });
    score -= Math.min(0.18, brokenLines * 0.06);
  }

  const paymentAsTotal = amounts.some(
    (candidate) =>
      candidate.roleScores.cash >= 0.7 &&
      almost(candidate.value, total, 0.01) &&
      candidate.roleScores.total < 0.6
  );
  if (paymentAsTotal && total > 0) {
    warnings.push({
      code: 'payment-as-total',
      message: 'The total may actually be a payment or tender amount.',
    });
    score -= 0.12;
  }

  const taxCandidate = amounts
    .filter((candidate) => candidate.roleScores.tax >= 0.8)
    .sort((a, b) => b.roleScores.tax - a.roleScores.tax)[0];
  if (taxCandidate && total > 0 && almost(taxCandidate.value, total, 0.01) && taxCandidate.roleScores.total < 0.6) {
    warnings.push({
      code: 'tax-as-total',
      message: 'The total may actually be a tax amount.',
    });
    score -= 0.18;
  }

  if (subtotalCandidate && taxCandidate && total > 0) {
    const reconstructed = subtotalCandidate.value + taxCandidate.value;
    if (!almost(reconstructed, total, Math.max(0.25, total * 0.03))) {
      warnings.push({
        code: 'totals-inconsistent',
        message: 'Subtotal plus tax does not reasonably match the receipt total.',
      });
      score -= 0.14;
    }
  }

  const strongTotals = amounts.filter((candidate) => candidate.roleScores.total >= 0.8);
  const uniqueTotals = new Set(strongTotals.map((candidate) => candidate.value.toFixed(2)));
  if (uniqueTotals.size > 1) {
    warnings.push({
      code: 'competing-totals',
      message: 'More than one plausible total was found.',
    });
    score -= 0.12;
  }

  const duplicateTotalItem = items.some((item) => almost(item.total ?? item.unitPrice, total, 0.01) && items.length > 1);
  if (duplicateTotalItem) {
    warnings.push({
      code: 'duplicate-total-as-item',
      message: 'A line item looks like the receipt total was copied into the list.',
    });
    score -= 0.1;
  }

  score = Math.max(0, Math.min(1, score));
  return {
    isConsistent: warnings.length === 0,
    score,
    warnings,
  };
};
