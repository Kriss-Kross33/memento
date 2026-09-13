import type { ReceiptItem } from '@/models/types';
import type { StructuredDiscount, StructuredTax } from '@/models/document';
import type { AmountCandidate, ReceiptValidation } from '@/utils/receipt/types';
import { AMOUNT_RELATIVE_TOLERANCE, AMOUNT_ROUNDING_TOLERANCE } from '@/utils/receipt/limits';

const almost = (a: number, b: number, slack = AMOUNT_ROUNDING_TOLERANCE): boolean => Math.abs(a - b) <= slack;

const toleranceFor = (total: number): number => Math.max(AMOUNT_ROUNDING_TOLERANCE, total * AMOUNT_RELATIVE_TOLERANCE);

export const validateReceipt = ({
  total,
  items,
  amounts = [],
  subtotal,
  discount = 0,
  taxes = [],
}: {
  total: number;
  items: ReceiptItem[];
  amounts?: AmountCandidate[];
  subtotal?: number;
  discount?: number;
  taxes?: StructuredTax[];
  discounts?: StructuredDiscount[];
}): ReceiptValidation => {
  const warnings: ReceiptValidation['warnings'] = [];
  let score = 1;
  const slack = toleranceFor(total);

  const itemSum = items.reduce((sum, item) => sum + (item.total ?? item.quantity * item.unitPrice), 0);
  if (total > 0 && items.length > 0 && itemSum > total + slack + discount) {
    warnings.push({
      code: 'items-exceed-total',
      message: 'Line items add up to more than the receipt total.',
    });
    score -= 0.28;
  }

  const subtotalCandidate = amounts
    .filter((candidate) => candidate.roleScores.subtotal >= 0.8)
    .sort((a, b) => b.roleScores.subtotal - a.roleScores.subtotal)[0];
  const printedSubtotal = subtotal ?? subtotalCandidate?.value;
  if (printedSubtotal != null && items.length > 0 && !almost(printedSubtotal, itemSum, Math.max(0.2, slack))) {
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

  const taxSum = taxes.reduce((sum, tax) => sum + tax.amount, 0);
  const reconstructedBase = printedSubtotal ?? (items.length > 0 ? itemSum : undefined);
  const taxLooksInclusive =
    reconstructedBase != null && total > 0 && almost(reconstructedBase, total, slack) && (taxSum > 0 || !!taxCandidate);
  if (reconstructedBase != null && total > 0 && !taxLooksInclusive) {
    const reconstructed = reconstructedBase - discount + (taxSum || taxCandidate?.value || 0);
    if ((taxSum > 0 || discount > 0 || taxCandidate) && !almost(reconstructed, total, slack)) {
      warnings.push({
        code: 'totals-math',
        message: 'Subtotal minus discounts plus taxes does not reasonably match the total.',
      });
      score -= 0.12;
    }
  }

  if (printedSubtotal != null && taxCandidate && total > 0 && taxSum === 0 && !taxLooksInclusive) {
    const reconstructed = printedSubtotal + taxCandidate.value - discount;
    if (!almost(reconstructed, total, Math.max(0.25, slack))) {
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

  const discountItem = items.some((item) => /discount|coupon|promo|loyalty/i.test(item.label));
  if (discountItem) {
    warnings.push({
      code: 'discount-as-item',
      message: 'A promotion or discount may have been saved as a purchased item.',
    });
    score -= 0.08;
  }

  score = Math.max(0, Math.min(1, score));
  return {
    isConsistent: warnings.length === 0,
    score,
    warnings,
  };
};
