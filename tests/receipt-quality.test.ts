import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzePixels, issuesFromMetrics } from '../services/ocr/pixelMetrics.ts';
import { assignMaxWeight } from '../utils/receipt/assignment.ts';
import { weightedOverallConfidence } from '../utils/receipt/confidence.ts';
import { validateReceipt } from '../utils/receipt/validate.ts';
import { isStrongTotalLabel, matchTerms } from '../utils/receipt/vocabulary.ts';

const rgba = (width: number, height: number, fill: (x: number, y: number) => [number, number, number]): Uint8Array => {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
};

test('pixel metrics distinguish a sharp checkerboard from a flat gray field', () => {
  const sharp = analyzePixels(
    rgba(48, 48, (x, y) => ((x + y) % 2 === 0 ? [0, 0, 0] : [255, 255, 255])),
    48,
    48
  );
  const flat = analyzePixels(
    rgba(48, 48, () => [128, 128, 128]),
    48,
    48
  );
  assert.ok(sharp.sharpness > flat.sharpness);
  assert.ok(sharp.contrast > flat.contrast);
  assert.ok(issuesFromMetrics(flat, { minSide: 1200 }).includes('low-contrast'));
});

test('short OCR garbage does not become TOTAL, TAX, or CASH', () => {
  assert.equal(isStrongTotalLabel('TOTAL'), true);
  assert.equal(isStrongTotalLabel('Grand Total'), true);
  assert.equal(isStrongTotalLabel('Total tax'), false);
  assert.equal(isStrongTotalLabel('totl'), false);
  assert.equal(matchTerms('txa', ['tax'])?.method === 'fuzzy' && (matchTerms('txa', ['tax'])?.score ?? 0) >= 0.9, false);
  assert.equal(matchTerms('csh', ['cash']), null);
});

test('global assignment prefers the better swap over greedy', () => {
  const matches = assignMaxWeight(
    [
      [0.7, 0.69],
      [0.68, 0.9],
    ],
    0.42
  );
  const byRow = new Map(matches.map((match) => [match.row, match.col]));
  assert.equal(byRow.get(0), 0);
  assert.equal(byRow.get(1), 1);
});

test('validateReceipt penalizes items that exceed the printed total', () => {
  const result = validateReceipt({
    total: 20,
    items: [
      { id: '1', label: 'A', quantity: 1, unitPrice: 15, total: 15 },
      { id: '2', label: 'B', quantity: 1, unitPrice: 18, total: 18 },
    ],
  });
  assert.equal(result.isConsistent, false);
  assert.ok(result.warnings.some((warning) => warning.code === 'items-exceed-total'));
  assert.ok(result.score < 0.8);
});

test('weighted confidence does not hide a broken item list', () => {
  const highItemsBroken = weightedOverallConfidence({
    merchant: { value: 'Store', confidence: 0.99 },
    date: { value: '2026-09-01', confidence: 0.98 },
    amount: { value: 28.5, confidence: 0.98 },
    currency: { value: 'GHS', confidence: 0.99 },
    category: { value: 'Other', confidence: 0.95 },
    items: { value: [], confidence: 0.25 },
    validation: { isConsistent: false, score: 0.55, warnings: [] },
  });
  const average = (0.99 + 0.98 + 0.98 + 0.99 + 0.95 + 0.25) / 6;
  assert.ok(highItemsBroken < average);
});
