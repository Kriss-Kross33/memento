import type { OcrDocument, OcrLine } from '@/services/ocr/types';
import { MAX_RECEIPT_PAGES } from '@/utils/receipt/limits';

const offsetBox = <T extends { x: number; y: number; width: number; height: number }>(
  box: T,
  yOffset: number
): T => ({ ...box, y: box.y + yOffset });

/** Concatenate multiple page OCR documents into one layout space. */
export const mergeOcrPages = (pages: OcrDocument[]): OcrDocument => {
  const limited = pages.slice(0, MAX_RECEIPT_PAGES);
  if (limited.length === 0) {
    return { text: '', lines: [], blocks: [], width: 1, height: 1 };
  }
  if (limited.length === 1) return limited[0];

  const width = Math.max(...limited.map((page) => page.width || 1), 1);
  const lines: OcrLine[] = [];
  const texts: string[] = [];
  let yOffset = 0;
  let height = 0;

  for (const page of limited) {
    const pageHeight = page.height > 0 ? page.height : Math.max(1, ...page.lines.map((line) => line.boundingBox.y + line.boundingBox.height));
    texts.push(page.text ?? '');
    for (const line of page.lines) {
      lines.push({
        ...line,
        boundingBox: offsetBox(line.boundingBox, yOffset),
        elements: line.elements?.map((element) => ({
          ...element,
          boundingBox: offsetBox(element.boundingBox, yOffset),
        })),
      });
    }
    yOffset += pageHeight + 24;
    height = yOffset;
  }

  return {
    text: texts.filter(Boolean).join('\n'),
    lines,
    blocks: [],
    width,
    height,
  };
};
