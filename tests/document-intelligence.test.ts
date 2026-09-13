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

test('reads Ghana column receipts with whole-number prices and a tax-inclusive total', () => {
  const dump: OcrDocument = {
    text: '',
    width: 1200,
    height: 2300,
    blocks: [],
    lines: [
      { text: 'CHICKENMAN', boundingBox: { x: 342, y: 73, width: 495, height: 56 } },
      { text: 'TAX INVOICE', boundingBox: { x: 377, y: 172, width: 432, height: 47 } },
      { text: 'October 29th 2025.', boundingBox: { x: 272, y: 578, width: 316, height: 33 } },
      { text: 'CASH', boundingBox: { x: 734, y: 755, width: 106, height: 30 } },
      { text: 'ITEM', boundingBox: { x: 181, y: 968, width: 85, height: 30 } },
      { text: 'QTY', boundingBox: { x: 541, y: 983, width: 76, height: 29 } },
      { text: '(GHS)', boundingBox: { x: 648, y: 1014, width: 108, height: 39 } },
      { text: '(GHS)', boundingBox: { x: 838, y: 1022, width: 114, height: 41 } },
      { text: 'Kersame Large', boundingBox: { x: 175, y: 1058, width: 242, height: 47 } },
      { text: '1', boundingBox: { x: 600, y: 1081, width: 8, height: 24 } },
      { text: '170', boundingBox: { x: 723, y: 1086, width: 56, height: 28 } },
      { text: '17C', boundingBox: { x: 938, y: 1096, width: 57, height: 29 } },
      { text: 'Ceres', boundingBox: { x: 173, y: 1115, width: 93, height: 32 } },
      { text: '1', boundingBox: { x: 599, y: 1140, width: 9, height: 24 } },
      { text: '60', boundingBox: { x: 741, y: 1146, width: 37, height: 27 } },
      { text: '6C', boundingBox: { x: 955, y: 1157, width: 39, height: 29 } },
      { text: 'Total', boundingBox: { x: 701, y: 1204, width: 77, height: 34 } },
      { text: '23C', boundingBox: { x: 934, y: 1218, width: 60, height: 32 } },
      { text: 'Tax Exclus. Amount', boundingBox: { x: 455, y: 1251, width: 324, height: 49 } },
      { text: '187.14', boundingBox: { x: 881, y: 1278, width: 112, height: 33 } },
      { text: 'GETFund Levy 2.5%', boundingBox: { x: 432, y: 1305, width: 346, height: 60 } },
      { text: '4.08', boundingBox: { x: 921, y: 1344, width: 74, height: 29 } },
      { text: 'VAT 15o', boundingBox: { x: 626, y: 1582, width: 161, height: 44 } },
      { text: '29.76', boundingBox: { x: 904, y: 1596, width: 102, height: 37 } },
      { text: 'Tax lncluslvo Auount', boundingBox: { x: 241, y: 1700, width: 552, height: 78 } },
      { text: '230.00', boundingBox: { x: 886, y: 1746, width: 123, height: 38 } },
      { text: 'Annount Pakd', boundingBox: { x: 527, y: 1804, width: 267, height: 51 } },
      { text: '230.00', boundingBox: { x: 884, y: 1899, width: 123, height: 35 } },
      { text: 'all Pizza Man want Chop, Where from all chicken', boundingBox: { x: 180, y: 2100, width: 700, height: 40 } },
    ],
  };
  dump.text = dump.lines.map((line) => line.text).join('\n');
  const parsed = parseReceiptDocument(dump, { date: '2026-09-12', currency: 'GHS' });
  assert.equal(parsed.merchant.value, 'Chickenman');
  assert.equal(parsed.date.value, '2025-10-29');
  assert.equal(parsed.amount.value, 230);
  assert.equal(parsed.currency.value, 'GHS');
  assert.equal(parsed.items.value.length, 2);
  assert.ok(parsed.items.value.some((item) => /kersame/i.test(item.label) && item.total === 170));
  assert.ok(parsed.items.value.some((item) => /ceres/i.test(item.label) && item.total === 60));
  assert.ok(parsed.items.value.every((item) => !/ghs|total|exclus|levy|tax/i.test(item.label)));
  const itemSum = parsed.items.value.reduce((sum, item) => sum + (item.total ?? 0), 0);
  assert.equal(itemSum, 230);
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
