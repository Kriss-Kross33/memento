import type { OcrDocument, OcrLine } from '@/services/ocr/types';
import type { LayoutDocument, LayoutLine, LayoutRow } from '@/utils/receipt/types';
import { estimateOcrConfidence, sanitizeOcrText } from '@/utils/receipt/vocabulary';

const hasLayout = (lines: OcrLine[]): boolean => {
  const boxed = lines.filter((line) => line.boundingBox.width >= 8 && line.boundingBox.height >= 8);
  if (boxed.length < 3) return false;
  const ys = boxed.map((line) => line.boundingBox.y);
  return Math.max(...ys) - Math.min(...ys) > 40;
};

export const buildLayout = (source: OcrDocument): LayoutDocument => {
  const lines = source.lines.length > 0 ? source.lines : [];
  const laidOut = hasLayout(lines);
  const width = laidOut ? Math.max(source.width, ...lines.map((line) => line.boundingBox.x + line.boundingBox.width)) : Math.max(source.width, 1);
  const height = laidOut ? Math.max(source.height, ...lines.map((line) => line.boundingBox.y + line.boundingBox.height)) : Math.max(source.lines.length, 1);
  const prepared: LayoutLine[] = lines
    .map((line, index) => {
      const text = sanitizeOcrText(line.text);
      const box = laidOut
        ? line.boundingBox
        : { x: 0, y: index, width: Math.max(text.length * 7, 1), height: 1 };
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const normalizedX = width > 0 ? centerX / width : 0;
      const normalizedY = height > 0 ? centerY / height : 0;
      return {
        index,
        text,
        line: { ...line, text },
        box,
        centerX,
        centerY,
        normalizedX,
        normalizedY,
        heightRatio: height > 0 ? box.height / height : 0,
        leftColumnScore: Math.max(0, 1 - normalizedX * 1.2),
        rightColumnScore: Math.max(0, (normalizedX - 0.45) / 0.55),
        ocrConfidence: line.confidence ?? estimateOcrConfidence(text),
      };
    })
    .filter((line) => line.text.length > 0)
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);

  const rows: LayoutRow[] = [];
  for (const line of prepared) {
    const yTolerance = Math.max(20, line.box.height * 0.6);
    const row = rows.find((entry) => Math.abs(entry.y - line.centerY) <= yTolerance);
    if (row) {
      row.lines.push(line);
      row.y = (row.y + line.centerY) / 2;
    } else {
      rows.push({ id: `row_${rows.length}`, y: line.centerY, lines: [line] });
    }
  }
  for (const row of rows) row.lines.sort((a, b) => a.box.x - b.box.x);

  return {
    source,
    width: Math.max(width, 1),
    height: Math.max(height, 1),
    lines: prepared,
    rows,
  };
};
