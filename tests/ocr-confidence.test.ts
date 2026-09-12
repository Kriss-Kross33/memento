import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOcrResult, readNativeConfidence } from '../services/ocr/normalize.ts';
import { parseReceiptDocument } from '../utils/receipt/index.ts';

const dump = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'test-receipts/ocr-dumps/kfc-grenada.json'), 'utf8')
);

test('native confidence accepts 0–1, 0–100, and alternate field names', () => {
  assert.equal(readNativeConfidence({ confidence: 0.84 }), 0.84);
  assert.equal(readNativeConfidence({ confidenceScore: 91 }), 0.91);
  assert.equal(readNativeConfidence({ recognizedConfidence: 0.2 }), 0.2);
  assert.equal(readNativeConfidence({ text: 'TOTAL' }), undefined);
});

test('normalizer preserves line confidence and rolls it up', () => {
  const document = normalizeOcrResult({
    text: 'TOTAL 12.00',
    blocks: [
      {
        text: 'TOTAL 12.00',
        boundingBox: { x: 0, y: 0, width: 80, height: 20 },
        lines: [
          {
            text: 'TOTAL 12.00',
            boundingBox: { x: 0, y: 0, width: 80, height: 20 },
            confidence: 0.41,
            elements: [{ text: '12.00', boundingBox: { x: 40, y: 0, width: 40, height: 20 }, confidence: 0.4 }],
          },
        ],
      },
    ],
  });
  assert.equal(document.lines[0].confidence, 0.41);
  assert.equal(document.meanConfidence, 0.41);
});

test('low OCR confidence on the total line reduces field confidence', () => {
  const high = {
    ...dump,
    lines: dump.lines.map((line: { text: string }) => ({
      ...line,
      confidence: /24[.,]50/.test(line.text) ? 0.98 : 0.95,
    })),
  };
  const low = {
    ...dump,
    lines: dump.lines.map((line: { text: string }) => ({
      ...line,
      confidence: /24[.,]50/.test(line.text) ? 0.12 : 0.95,
    })),
  };
  const fallback = { date: '2026-09-12', currency: 'GHS' as const };
  const highParsed = parseReceiptDocument(high, fallback);
  const lowParsed = parseReceiptDocument(low, fallback);
  assert.equal(highParsed.amount.value, lowParsed.amount.value);
  assert.ok(lowParsed.amount.confidence < highParsed.amount.confidence);
});
