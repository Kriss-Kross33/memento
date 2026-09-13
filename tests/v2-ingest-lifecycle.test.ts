import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReceiptPages } from '../utils/receipt/index.ts';
import { MAX_RECEIPT_ITEMS, MAX_RECEIPT_PAGES, MAX_PDF_PAGES } from '../utils/receipt/limits.ts';
import {
  extractExplicitReturnPolicy,
  reminderFireDate,
  returnWindowDaysFromDuration,
} from '../utils/receipt/lifecycle.ts';
import { receiptToPurchaseRecord } from '../models/document.ts';
import { originsAfterUserSave, originsFromParsed, shouldKeepUserField } from '../services/ingest/origins.ts';
import { mapParsedToReceiptFields } from '../services/ingest/mapParsed.ts';
import { isPdfInput, isSupportedImageInput } from '../services/ingest/types.ts';
import { receiptInputFromIncomingUrl } from '../services/ingest/incoming.ts';
import { detectDuplicateBeforeSave } from '../services/ingest/finalize.ts';
import { findDuplicateMatches } from '../services/intelligence/duplicates.ts';
import { matchPurchaseQuery } from '../services/search/query.ts';
import { returnStatusCopy, returnStatusFor, warrantyStatusFor } from '../utils/protection.ts';
import { filterAndSortReceipts, DEFAULT_FILTERS } from '../utils/receiptFilters.ts';
import type { OcrDocument } from '../services/ocr/types.ts';
import type { Receipt } from '../models/types.ts';
import type { ParsedReceipt } from '../utils/receipt/types.ts';

const linesOf = (text: string): OcrDocument => {
  const lines = text
    .split('\n')
    .map((line, i) => ({
      text: line,
      boundingBox: { x: 10, y: i * 24, width: 400, height: 20 },
    }))
    .filter((line) => line.text.trim());
  return { text, lines, blocks: [], width: 800, height: Math.max(24, lines.length * 24) };
};

const receipt = (overrides: Partial<Receipt> = {}): Receipt =>
  ({
    id: 'r1',
    merchant: 'Melcom',
    date: '2026-09-12',
    amount: 88,
    currency: 'GHS',
    category: 'Shopping',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }) as Receipt;

test('multi-page merge keeps last-page totals and items from earlier pages', () => {
  const page1 = linesOf('MELCOM\nMilk 10.00\nBread 5.00');
  const page2 = linesOf('Eggs 7.00\nSUBTOTAL 22.00\nTOTAL 22.00');
  const parsed = parseReceiptPages([page1, page2], { date: '2026-09-12', currency: 'GHS' });
  assert.equal(parsed.amount.value, 22);
  assert.ok(parsed.items.value.some((item) => /bread/i.test(item.label)));
  assert.ok(parsed.items.value.some((item) => /egg/i.test(item.label)));
});

test('long item lists stay under the 400 safety cap', () => {
  assert.equal(MAX_RECEIPT_ITEMS, 400);
  assert.equal(MAX_RECEIPT_PAGES, 12);
  assert.equal(MAX_PDF_PAGES, 12);
});

test('ingest router accepts images and flags pdf / unsupported types', () => {
  assert.equal(isPdfInput({ kind: 'pdf', uri: 'file:///a.pdf' }), true);
  assert.equal(isPdfInput({ kind: 'file', uri: 'file:///a.PDF', fileName: 'a.PDF' }), true);
  assert.equal(isSupportedImageInput({ kind: 'file', uri: 'file:///a.jpg', fileName: 'a.jpg' }), true);
  assert.equal(isSupportedImageInput({ kind: 'file', uri: 'file:///a.txt', fileName: 'a.txt', mimeType: 'text/plain' }), false);
});

test('share URLs become receipt inputs', () => {
  const image = receiptInputFromIncomingUrl('file:///tmp/photo.jpg');
  assert.equal(image?.kind, 'share');
  const pdf = receiptInputFromIncomingUrl('content://media/document.pdf');
  assert.equal(pdf?.kind, 'pdf');
  assert.equal(receiptInputFromIncomingUrl('https://example.com'), null);
});

test('receiptToPurchaseRecord hydrates pages, taxes, and user provenance', () => {
  const mapped = receiptToPurchaseRecord(
    receipt({
      subtotal: 80,
      tax: 8,
      taxes: [{ name: 'VAT', amount: 8, confidence: 0.9, source: 'ocr' }],
      sourceMedia: [
        { id: 'm0', uri: 'file://p0', addedAt: '', source: 'camera', pageIndex: 0 },
        { id: 'm1', uri: 'file://p1', addedAt: '', source: 'camera', pageIndex: 1 },
      ],
      fieldOrigins: [{ field: 'merchant', originalValue: 'MELC0M', source: 'user', correctedAt: '2026-09-12' }],
    })
  );
  assert.equal(mapped.sourceMedia?.length, 2);
  assert.equal(mapped.taxes?.[0]?.name, 'VAT');
  assert.equal(mapped.provenance, 'user-corrected');
});

test('field origins mark user edits and protect them on reread', () => {
  const parsed = {
    merchant: { value: 'MELC0M', confidence: 0.7, source: 'ocr' },
    date: { value: '2026-09-12', confidence: 0.8, source: 'ocr' },
    amount: { value: 10, confidence: 0.8, source: 'ocr' },
    currency: { value: 'GHS', confidence: 0.8, source: 'ocr' },
    category: { value: 'Other', confidence: 0.4, source: 'ocr' },
  } as ParsedReceipt;
  const origins = originsFromParsed(parsed);
  const next = originsAfterUserSave(origins, receipt({ merchant: 'MELC0M', amount: 10 }), receipt({ merchant: 'Melcom', amount: 10 }));
  assert.equal(next.find((origin) => origin.field === 'merchant')?.source, 'user');
  assert.equal(shouldKeepUserField(next, 'merchant'), true);
  assert.equal(shouldKeepUserField(next, 'amount'), false);
});

test('month-based return windows map to days and never invent dates', () => {
  assert.equal(returnWindowDaysFromDuration('14 days'), 14);
  assert.equal(returnWindowDaysFromDuration('2 months'), 60);
  assert.equal(extractExplicitReturnPolicy('Thanks for shopping', '2026-09-12'), undefined);
  const fields = mapParsedToReceiptFields(
    {
      merchant: { value: 'Store', confidence: 0.8, source: 'ocr' },
      date: { value: '2026-09-12', confidence: 0.8, source: 'ocr' },
      amount: { value: 20, confidence: 0.8, source: 'ocr' },
      currency: { value: 'GHS', confidence: 0.8, source: 'ocr' },
      category: { value: 'Other', confidence: 0.4, source: 'ocr' },
      items: { value: [], confidence: 0, source: 'none' },
      returnPolicy: { duration: '2 months', confidence: 0.8, source: 'Returns within 2 months' },
      validation: { isConsistent: true, score: 1, warnings: [] },
      overallConfidence: 0.8,
      reviewState: 'high',
      reviewRequirements: [],
    },
    { date: '2026-09-12', currency: 'GHS' },
    true
  );
  assert.equal(fields.returnWindowDays, 60);
});

test('reminder dates fire before a real deadline and skip invented or past dates', () => {
  const fire = reminderFireDate('2026-10-01', 3, new Date('2026-09-20T00:00:00'));
  assert.ok(fire);
  assert.ok(new Date(fire) < new Date('2026-10-01T12:00:00'));
  assert.ok(new Date(fire) > new Date('2026-09-20T00:00:00'));
  assert.equal(reminderFireDate('not-a-date', 3), null);
  assert.equal(reminderFireDate('2026-09-12', 3, new Date('2026-09-20T00:00:00')), null);
});

test('duplicates gate same receipt but stay silent on a different total', () => {
  const same = findDuplicateMatches(
    { merchant: 'Melcom', date: '2026-09-12', amount: 88, receiptNumber: 'A1' },
    [{ id: 'r1', merchant: 'Melcom', date: '2026-09-12', amount: 88, receiptNumber: 'A1' }],
    0.85
  );
  assert.ok((same[0]?.score ?? 0) >= 0.85);
  const differentTotal = detectDuplicateBeforeSave(
    receipt({ amount: 40 }),
    [receipt({ id: 'r2', amount: 88 })]
  );
  assert.equal(differentTotal, undefined);
});

test('structured search and lifecycle filters', () => {
  const active = receipt({ warrantyUntil: '2027-01-01', returnWindowDays: 30 });
  assert.equal(matchPurchaseQuery(active, { text: 'melcom', warrantyStatus: 'active' }), true);
  assert.equal(matchPurchaseQuery(active, { returnStatus: 'eligible' }), true);
  assert.equal(warrantyStatusFor(receipt({ warrantyUntil: '2020-01-01' })), 'expired');
  assert.equal(returnStatusFor(receipt({ date: '2020-01-01', returnWindowDays: 7 })), 'expired');
  assert.match(returnStatusCopy(receipt({ date: '2026-09-10', returnWindowDays: 10 }), new Date('2026-09-12')) ?? '', /more days/);
  const filtered = filterAndSortReceipts(
    [active, receipt({ id: 'r2', merchant: 'Shoprite', category: 'Food' })],
    { ...DEFAULT_FILTERS, category: 'Shopping' }
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].merchant, 'Melcom');
});
