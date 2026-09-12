import assert from 'node:assert/strict';
import { test } from 'node:test';
import { denormalizeVisionBox, sortVisionObservations, unionBoxes } from '../services/ocr/visionGeometry.ts';
import { mapVisionResult } from '../services/ocr/visionMap.ts';
import { selectOcrEngine } from '../services/ocr/enginePreference.ts';

test('Vision normalized boxes convert to top-left pixels', () => {
  const box = denormalizeVisionBox({ x: 0.1, y: 0.2, width: 0.5, height: 0.25 }, { width: 1000, height: 2000 });
  assert.equal(box.x, 100);
  assert.equal(box.width, 500);
  assert.equal(box.height, 500);
  assert.equal(box.y, 1100);
});

test('malformed Vision boxes become empty rather than NaN', () => {
  const box = denormalizeVisionBox({ x: Number.NaN }, { width: 100, height: 100 });
  assert.deepEqual(box, { x: 0, y: 0, width: 0, height: 0 });
});

test('empty Vision result produces an empty OcrDocument', () => {
  const document = mapVisionResult({ text: '', width: 800, height: 600, blocks: [] });
  assert.equal(document.text, '');
  assert.equal(document.lines.length, 0);
  assert.equal(document.meanConfidence, undefined);
});

test('multiple Vision observations become lines with confidence', () => {
  const document = mapVisionResult({
    text: 'KFC\nTOTAL 28.50',
    width: 100,
    height: 200,
    coordinateSpace: 'normalized',
    lines: [
      {
        text: 'KFC',
        boundingBox: { x: 0.1, y: 0.8, width: 0.2, height: 0.1 },
        confidence: 0.99,
      },
      {
        text: 'TOTAL 28.50',
        boundingBox: { x: 0.1, y: 0.1, width: 0.6, height: 0.1 },
        confidence: 0.97,
        candidates: [
          { text: 'TOTAL 28.50', confidence: 0.97 },
          { text: 'T0TAL 28.50', confidence: 0.41 },
        ],
      },
    ],
  });
  assert.equal(document.lines.length, 2);
  assert.equal(document.lines[0].text, 'KFC');
  assert.equal(document.lines[1].text, 'TOTAL 28.50');
  assert.equal(document.lines[1].confidence, 0.97);
  assert.equal(document.lines[1].candidates?.[1].text, 'T0TAL 28.50');
  assert.ok(document.lines[1].boundingBox.y > document.lines[0].boundingBox.y);
});

test('missing confidence is allowed and still maps geometry', () => {
  const document = mapVisionResult({
    width: 10,
    height: 10,
    coordinateSpace: 'pixels',
    lines: [{ text: 'CASH', boundingBox: { x: 1, y: 2, width: 3, height: 4 } }],
  });
  assert.equal(document.lines[0].confidence, undefined);
  assert.deepEqual(document.lines[0].boundingBox, { x: 1, y: 2, width: 3, height: 4 });
});

test('recognizer selection is platform-based unless overridden', () => {
  assert.equal(selectOcrEngine('ios', 'auto'), 'vision');
  assert.equal(selectOcrEngine('android', 'auto'), 'mlkit');
  assert.equal(selectOcrEngine('web', 'auto'), 'unsupported');
  assert.equal(selectOcrEngine('ios', 'mlkit'), 'mlkit');
  assert.equal(selectOcrEngine('android', 'vision'), 'vision');
});

test('Vision observations sort top-to-bottom from bottom-left origin', () => {
  const sorted = sortVisionObservations([
    { boundingBox: { x: 0.2, y: 0.1, width: 0.3, height: 0.05 }, text: 'bottom' },
    { boundingBox: { x: 0.1, y: 0.8, width: 0.3, height: 0.05 }, text: 'top' },
  ]);
  assert.equal(sorted[0].text, 'top');
  assert.equal(sorted[1].text, 'bottom');
});

test('unionBoxes covers the receipt region', () => {
  const box = unionBoxes([
    { x: 10, y: 20, width: 30, height: 10 },
    { x: 5, y: 40, width: 50, height: 10 },
  ]);
  assert.deepEqual(box, { x: 5, y: 20, width: 50, height: 30 });
});
