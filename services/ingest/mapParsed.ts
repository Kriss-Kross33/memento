import type { Receipt } from '@/models/types';
import { buildOcrMetadata } from '@/services/ocrMetadata';
import { originsFromParsed } from '@/services/ingest/origins';
import { returnWindowDaysFromDuration } from '@/utils/receipt/lifecycle';
import type { ParseFallback, ParsedReceipt } from '@/utils/receipt/types';

export type MappedReceiptFields = Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>;

export const emptyReceiptFields = (fallback: ParseFallback): MappedReceiptFields => ({
  merchant: '',
  date: fallback.date || new Date().toISOString().slice(0, 10),
  amount: 0,
  currency: fallback.currency,
  category: 'Other',
  notes: '',
  ocr: buildOcrMetadata(null, false),
});

/** Map one parsed document onto the receipt row shape (plus structured extras). */
export const mapParsedToReceiptFields = (
  parsed: ParsedReceipt,
  fallback: ParseFallback,
  hadOcr: boolean
): MappedReceiptFields => {
  const blank = emptyReceiptFields(fallback);
  return {
    ...blank,
    merchant: parsed.merchant.value,
    date: parsed.date.value,
    amount: parsed.amount.value,
    currency: parsed.currency.value,
    category: parsed.category.value,
    receiptNumber: parsed.receiptNumber?.value,
    notes: parsed.notes?.value ?? '',
    items: parsed.items.value,
    subtotal: parsed.subtotal?.value,
    tax: parsed.tax?.value,
    discount: parsed.discount?.value,
    taxes: parsed.taxes,
    discounts: parsed.discounts,
    warrantyUntil: parsed.warranty?.expiryDate,
    returnWindowDays: returnWindowDaysFromDuration(parsed.returnPolicy?.duration),
    fieldOrigins: originsFromParsed(parsed),
    ocr: {
      ...buildOcrMetadata(parsed, hadOcr),
      suggestedMerchant: parsed.memorySuggestions?.merchant ?? (parsed.merchant.value || undefined),
      suggestedCategory: parsed.memorySuggestions?.category ?? (parsed.category.value || undefined),
    },
  };
};
