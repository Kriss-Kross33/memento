import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyDocument } from '../utils/document/classify.ts';
import { parseReceiptDocument, parseReceiptPages } from '../utils/receipt/index.ts';
import { buildLayout } from '../utils/receipt/layout.ts';
import { findAnchors } from '../utils/receipt/anchors.ts';
import { resolveCurrency } from '../utils/receipt/currency.ts';
import { extractDiscounts, extractTaxes } from '../utils/receipt/charges.ts';
import { extractAmountCandidates } from '../utils/receipt/amounts.ts';
import { extractExplicitReturnPolicy, extractExplicitWarranty } from '../utils/receipt/lifecycle.ts';
import { MAX_RECEIPT_ITEMS } from '../utils/receipt/limits.ts';
import { rememberMerchantCorrection, resolveStoredMerchant } from '../services/intelligence/merchantMemory.ts';
import { rememberCategoryCorrection, suggestCategoryForMerchant } from '../services/intelligence/categoryLearning.ts';
import { findDuplicateMatches } from '../services/intelligence/duplicates.ts';
import { matchPurchaseQuery } from '../services/search/query.ts';
import { scoreParsedAgainstExpected } from '../utils/benchmark/metrics.ts';
import type { OcrDocument } from '../services/ocr/types.ts';
import type { Receipt } from '../models/types.ts';

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

const classify = (text: string) => {
  const layout = buildLayout(linesOf(text));
  return classifyDocument(layout, findAnchors(layout));
};

test('classifies a printed receipt from totals and tender', () => {
  const result = classify('MELCOM\nITEM A 10.00\nSUBTOTAL 10.00\nVAT 1.00\nTOTAL 11.00\nCASH 20.00\nCHANGE 9.00');
  assert.equal(result.type, 'receipt');
  assert.ok(result.confidence >= 0.45);
  assert.ok(result.reasons.length > 0);
});

test('classifies an invoice from bill-to and due date', () => {
  const result = classify('INVOICE NUMBER INV-2044\nBILL TO Acme Ltd\nDUE DATE 12 Oct 2026\nTERMS NET 30\nAMOUNT DUE 240.00');
  assert.equal(result.type, 'invoice');
});

test('classifies a utility bill from meter and account signals', () => {
  const result = classify('ECG PREPAID\nACCOUNT NUMBER 12345678\nMETER ID 998877\nCONSUMPTION 40 kWh\nREADING 1200\nAMOUNT DUE 85.00');
  assert.equal(result.type, 'utility_bill');
});

test('classifies an order confirmation separately from a paper receipt', () => {
  const result = classify('Order Confirmation\nFrom: store@example.com\nSubject: Thanks for your order\nORDER NUMBER A1B2\nTOTAL 49.00');
  assert.ok(result.type === 'order_confirmation' || result.type === 'digital_receipt');
});

test('uncertain documents still parse as a receipt the user can save', () => {
  const parsed = parseReceiptDocument(linesOf('HELLO WORLD\nSOMETHING 12.00'), {
    date: '2026-09-12',
    currency: 'GHS',
  });
  assert.ok(parsed.documentType);
  assert.ok(parsed.merchant);
  assert.ok(parsed.amount);
});

test('extracts structured taxes and discounts', () => {
  const layout = buildLayout(
    linesOf('Items 100.00\nSUBTOTAL 100.00\nDiscount 20.00\nVAT 8.00\nTOTAL 88.00')
  );
  const amounts = extractAmountCandidates(layout, findAnchors(layout));
  const taxes = extractTaxes(layout, amounts);
  const discounts = extractDiscounts(layout, amounts);
  assert.ok(taxes.some((tax) => tax.name === 'VAT' && tax.amount === 8));
  assert.ok(discounts.some((discount) => discount.amount === 20));
});

test('does not treat a lone dollar sign as USD', () => {
  const layout = buildLayout(linesOf('Corner Shop\nTOTAL $12.00'));
  const resolved = resolveCurrency(layout, 'Corner Shop', 'GHS');
  assert.equal(resolved.value, 'GHS');
  assert.ok(resolved.confidence < 0.7);
  assert.equal(resolved.source, 'ambiguous-dollar');
});

test('long-receipt safety cap stays configurable and high', () => {
  assert.ok(MAX_RECEIPT_ITEMS >= 200);
});

test('merchant memory resolves OCR aliases after a correction', () => {
  const profiles = rememberMerchantCorrection([], 'MELC0M GH LTD', 'Melcom', { category: 'Shopping' });
  const hit = resolveStoredMerchant('MELCOM', profiles);
  assert.equal(hit?.name, 'Melcom');
  assert.ok((hit?.confidence ?? 0) >= 0.78);
});

test('category learning needs repeated corrections before suggesting', () => {
  const once = rememberCategoryCorrection([], 'Melcom', 'Shopping');
  assert.equal(suggestCategoryForMerchant('Melcom', once), null);
  const twice = rememberCategoryCorrection(once, 'Melcom', 'Shopping');
  assert.equal(suggestCategoryForMerchant('Melcom', twice)?.category, 'Shopping');
});

test('duplicate detection scores matching merchant, date, and total', () => {
  const matches = findDuplicateMatches(
    { merchant: 'Melcom', date: '2026-09-12', amount: 88, receiptNumber: 'A1' },
    [{ id: 'r1', merchant: 'Melcom', date: '2026-09-12', amount: 88, receiptNumber: 'A1' }]
  );
  assert.equal(matches[0]?.receiptId, 'r1');
  assert.ok(matches[0].score >= 0.8);
});

test('multi-page OCR merges into one document', () => {
  const page1 = linesOf('ITEM A 1.00\nITEM B 2.00');
  const page2 = linesOf('SUBTOTAL 3.00\nTOTAL 3.00');
  const parsed = parseReceiptPages([page1, page2], { date: '2026-09-12', currency: 'GHS' });
  assert.equal(parsed.amount.value, 3);
});

test('never invents warranty or return windows', () => {
  const text = 'Thanks for shopping. Share feedback within the next 5 days.';
  assert.equal(extractExplicitWarranty(text, '2026-09-12'), undefined);
  assert.equal(extractExplicitReturnPolicy(text, '2026-09-12'), undefined);
  const warranty = extractExplicitWarranty('Manufacturer warranty for 12 months', '2026-09-12');
  assert.equal(warranty?.duration, '12 months');
  const returns = extractExplicitReturnPolicy('Returns accepted within 30 days', '2026-09-12');
  assert.equal(returns?.deadline, '2026-10-12');
});

test('structured purchase search matches merchant, amount, and item', () => {
  const receipt = {
    id: '1',
    merchant: 'Melcom',
    date: '2026-09-12',
    amount: 520,
    currency: 'GHS',
    category: 'Shopping',
    items: [{ id: 'i', label: 'Coffee', quantity: 1, unitPrice: 20 }],
    createdAt: '',
    updatedAt: '',
  } as Receipt;
  assert.equal(matchPurchaseQuery(receipt, { merchant: 'Melcom', minAmount: 500, item: 'coffee' }), true);
  assert.equal(matchPurchaseQuery(receipt, { currency: 'USD' }), false);
});

test('benchmark helper scores a parsed receipt against expected fields', () => {
  const parsed = parseReceiptDocument(linesOf('Walmart\nTOTAL 10.00\nGallatin TN'), {
    date: '2026-09-12',
    currency: 'GHS',
  });
  const scores = scoreParsedAgainstExpected(parsed, {
    documentType: 'receipt',
    merchant: parsed.merchant.value,
    date: parsed.date.value,
    currency: parsed.currency.value,
    amount: parsed.amount.value,
    items: parsed.items.value,
  });
  assert.equal(scores.total, 1);
  assert.equal(scores.currency, 1);
});
