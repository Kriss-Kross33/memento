import type { Receipt } from '@/models/types';
import { findDuplicateMatches, type DuplicateCandidate } from '@/services/intelligence/duplicates';
import type { DuplicateMatch } from '@/models/intelligence';
import type { NewReceipt } from '@/services/receiptRepository';

const DUPLICATE_SAVE_THRESHOLD = 0.85;

export type FinalizeHandlers = {
  addReceipt: (receipt: NewReceipt) => Promise<string>;
  consumeScan: () => Promise<unknown>;
};

export type FinalizeResult =
  | { status: 'saved'; id: string }
  | { status: 'duplicate'; match: DuplicateMatch };

const asCandidate = (
  receipt: Pick<Receipt, 'merchant' | 'date' | 'amount' | 'receiptNumber' | 'items'> & { id?: string }
): DuplicateCandidate => ({
  id: receipt.id ?? '',
  merchant: receipt.merchant,
  date: receipt.date,
  amount: receipt.amount,
  receiptNumber: receipt.receiptNumber,
  itemLabels: receipt.items?.map((item) => item.label),
});

export const detectDuplicateBeforeSave = (
  incoming: NewReceipt,
  existing: Receipt[],
  threshold = DUPLICATE_SAVE_THRESHOLD
): DuplicateMatch | undefined =>
  findDuplicateMatches(asCandidate(incoming), existing.map(asCandidate), threshold)[0];

/**
 * Save one logical purchase (any number of pages) and consume one scan.
 * Callers must resolve a duplicate match before passing `saveAnyway`.
 */
export const finalizeScannedReceipt = async (
  incoming: NewReceipt,
  existing: Receipt[],
  handlers: FinalizeHandlers,
  options?: { saveAnyway?: boolean }
): Promise<FinalizeResult> => {
  if (!options?.saveAnyway) {
    const match = detectDuplicateBeforeSave(incoming, existing);
    if (match) return { status: 'duplicate', match };
  }
  const id = await handlers.addReceipt(incoming);
  await handlers.consumeScan();
  return { status: 'saved', id };
};
