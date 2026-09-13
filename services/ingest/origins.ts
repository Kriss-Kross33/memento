import type { FieldOrigin, Receipt } from '@/models/types';
import type { ParsedReceipt } from '@/utils/receipt/types';

export const ORIGIN_FIELDS = ['merchant', 'date', 'amount', 'currency', 'category'] as const;
export type OriginField = (typeof ORIGIN_FIELDS)[number];

const asText = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  return String(value);
};

export const originsFromParsed = (parsed: ParsedReceipt): FieldOrigin[] =>
  ORIGIN_FIELDS.map((field) => ({
    field,
    originalValue:
      field === 'amount'
        ? asText(parsed.amount.value)
        : field === 'merchant'
          ? parsed.merchant.value
          : field === 'date'
            ? parsed.date.value
            : field === 'currency'
              ? parsed.currency.value
              : parsed.category.value,
    source: 'ocr' as const,
  }));

export const currentFieldValue = (
  receipt: Pick<Receipt, 'merchant' | 'date' | 'amount' | 'currency' | 'category'>,
  field: OriginField
): string => {
  if (field === 'amount') return asText(receipt.amount);
  return asText(receipt[field]);
};

/** Mark fields the user changed from the stored OCR original. */
export const originsAfterUserSave = (
  previous: FieldOrigin[] | undefined,
  original: Pick<Receipt, 'merchant' | 'date' | 'amount' | 'currency' | 'category'>,
  next: Pick<Receipt, 'merchant' | 'date' | 'amount' | 'currency' | 'category'>
): FieldOrigin[] => {
  const byField = new Map((previous ?? []).map((origin) => [origin.field, origin]));
  const now = new Date().toISOString();
  return ORIGIN_FIELDS.map((field) => {
    const existing = byField.get(field);
    const originalValue = existing?.originalValue ?? currentFieldValue(original, field);
    const nextValue = currentFieldValue(next, field);
    if (nextValue !== originalValue) {
      return { field, originalValue, source: 'user' as const, correctedAt: now };
    }
    return existing ?? { field, originalValue, source: 'ocr' as const };
  });
};

export const shouldKeepUserField = (origins: FieldOrigin[] | undefined, field: OriginField): boolean =>
  (origins ?? []).some((origin) => origin.field === field && origin.source === 'user');
