import { formatMoney } from '@/utils/currency';
import type { Currency } from '@/utils/currency';
import type { AmountCandidate, ParsedReceipt } from '@/utils/receipt/types';
import type { FieldExplanation } from '@/models/document';

const money = (value: number, currency: Currency): string => formatMoney(value, currency);

export const buildFieldExplanations = ({
  parsed,
  amounts,
}: {
  parsed: Pick<ParsedReceipt, 'amount' | 'currency' | 'items' | 'validation' | 'merchant'>;
  amounts: AmountCandidate[];
}): FieldExplanation[] => {
  const explanations: FieldExplanation[] = [];
  const currency = parsed.currency.value;
  const competing = parsed.validation.warnings.find((warning) => warning.code === 'competing-totals');
  if (competing) {
    const totals = amounts
      .filter((candidate) => candidate.roleScores.total >= 0.72)
      .map((candidate) => candidate.value);
    const unique = [...new Set(totals.map((value) => value.toFixed(2)))];
    explanations.push({
      field: 'amount',
      message: `Memento found ${unique.length > 1 ? 'more than one possible total' : 'competing totals'} on this receipt. We selected ${money(parsed.amount.value, currency)} because it appears beside “Total”.`,
      detail: `candidates=${unique.join(',')}`,
    });
  }
  if (parsed.validation.warnings.some((warning) => warning.code === 'tax-as-total')) {
    explanations.push({
      field: 'amount',
      message: 'This number sits next to a tax label. Check that it is the amount you actually paid.',
    });
  }
  if (parsed.validation.warnings.some((warning) => warning.code === 'payment-as-total')) {
    explanations.push({
      field: 'amount',
      message: 'This looks like cash or card tendered, not necessarily the receipt total.',
    });
  }
  if (parsed.validation.warnings.some((warning) => warning.code === 'line-math')) {
    explanations.push({
      field: 'items',
      message: 'A line total does not match quantity × unit price. Two prices may be aligned with the same item.',
    });
  }
  if (parsed.validation.warnings.some((warning) => warning.code === 'items-exceed-total')) {
    explanations.push({
      field: 'items',
      message: 'The listed items add up to more than the total. A discount or tax line may have been read as a product.',
    });
  }
  if (parsed.merchant.confidence < 0.72 && parsed.merchant.value) {
    explanations.push({
      field: 'merchant',
      message: 'The store name is a best reading of the header. Confirm it matches the receipt.',
    });
  }
  if (parsed.currency.confidence < 0.75 && parsed.currency.source === 'ambiguous-dollar') {
    explanations.push({
      field: 'currency',
      message: 'A dollar sign is not enough to know which currency this is.',
    });
  }
  return explanations;
};

export const explanationForField = (
  explanations: FieldExplanation[] | undefined,
  field: string
): string | undefined => explanations?.find((entry) => entry.field === field)?.message;
