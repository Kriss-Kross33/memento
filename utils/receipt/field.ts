import type { ExtractedField, LayoutLine } from '@/utils/receipt/types';

export const extracted = <T>(
  value: T,
  confidence: number,
  line?: LayoutLine | null,
  source = line?.text ?? 'none'
): ExtractedField<T> => ({
  value,
  confidence,
  source,
  sourceLineIndex: line?.index,
  sourceText: line?.text,
  sourceBox: line?.box,
});

export const blendOcrConfidence = (semantic: number, line?: LayoutLine | null): number => {
  if (line == null) return semantic;
  return Math.max(0, Math.min(0.99, semantic * 0.78 + line.ocrConfidence * 0.22));
};
