import type { OcrBlock, OcrDocument, OcrElement, OcrLine } from '@/services/ocr/types';

type RawBox = { x?: number; y?: number; width?: number; height?: number };
type RawRecord = Record<string, unknown>;

const emptyBox = () => ({ x: 0, y: 0, width: 0, height: 0 });

const toBox = (value: unknown): { x: number; y: number; width: number; height: number } => {
  const box = (value ?? {}) as RawBox;
  return {
    x: Number(box.x) || 0,
    y: Number(box.y) || 0,
    width: Number(box.width) || 0,
    height: Number(box.height) || 0,
  };
};

/**
 * Accepts the shapes native engines actually emit:
 * 0–1, 0–100, `confidence`, `confidenceScore`, or `recognizedConfidence`.
 */
export const readNativeConfidence = (value: unknown): number | undefined => {
  if (value == null || typeof value !== 'object') return undefined;
  const record = value as RawRecord;
  const raw = record.confidence ?? record.confidenceScore ?? record.recognizedConfidence;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  if (raw > 1 && raw <= 100) return raw / 100;
  if (raw < 0 || raw > 1) return undefined;
  return raw;
};

const meanConfidence = (values: Array<number | undefined>): number | undefined => {
  const known = values.filter((value): value is number => typeof value === 'number');
  if (known.length === 0) return undefined;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
};

const toElement = (value: unknown): OcrElement => {
  const record = (value ?? {}) as RawRecord;
  return {
    text: String(record.text ?? '').trim(),
    boundingBox: toBox(record.boundingBox),
    confidence: readNativeConfidence(record),
  };
};

const toLine = (value: unknown): OcrLine => {
  const record = (value ?? {}) as RawRecord;
  const elements = (Array.isArray(record.elements) ? record.elements : [])
    .map(toElement)
    .filter((element) => element.text);
  const candidates = Array.isArray(record.candidates)
    ? record.candidates
        .map((candidate) => {
          const item = (candidate ?? {}) as RawRecord;
          const confidence = readNativeConfidence(item);
          const text = String(item.text ?? '').trim();
          return text && confidence != null ? { text, confidence } : null;
        })
        .filter((candidate): candidate is { text: string; confidence: number } => candidate != null)
    : undefined;
  return {
    text: String(record.text ?? '').trim(),
    boundingBox: toBox(record.boundingBox),
    confidence: readNativeConfidence(record) ?? meanConfidence(elements.map((element) => element.confidence)),
    elements,
    candidates: candidates?.length ? candidates : undefined,
  };
};

const toBlock = (value: unknown): OcrBlock => {
  const record = (value ?? {}) as RawRecord;
  return {
    text: String(record.text ?? '').trim(),
    boundingBox: toBox(record.boundingBox),
    lines: (Array.isArray(record.lines) ? record.lines : []).map(toLine).filter((line) => line.text),
  };
};

export const normalizeOcrResult = (result: { text?: string; blocks?: unknown[] } | null): OcrDocument => {
  const blocks = (result?.blocks ?? []).map(toBlock).filter((block) => block.text || block.lines.length > 0);
  const lines = blocks
    .flatMap((block) => block.lines)
    .sort((a, b) => a.boundingBox.y - b.boundingBox.y || a.boundingBox.x - b.boundingBox.x);
  return {
    text: (result?.text ?? '').trim(),
    width: Math.max(1, ...lines.map((line) => line.boundingBox.x + line.boundingBox.width)),
    height: Math.max(1, ...lines.map((line) => line.boundingBox.y + line.boundingBox.height)),
    blocks,
    lines,
    meanConfidence: meanConfidence(lines.map((line) => line.confidence)),
  };
};
