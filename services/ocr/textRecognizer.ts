import type { OcrBlock, OcrDocument, OcrElement, OcrLine } from '@/services/ocr/types';

type RawBox = { x: number; y: number; width: number; height: number };
type RawElement = { text: string; boundingBox: RawBox };
type RawLine = { text: string; boundingBox: RawBox; elements?: RawElement[] };
type RawBlock = { text: string; boundingBox: RawBox; lines?: RawLine[] };
type RecognitionResult = { text: string; blocks?: RawBlock[] };

const emptyBox = (): RawBox => ({ x: 0, y: 0, width: 0, height: 0 });

const toElement = (value: RawElement): OcrElement => ({
  text: value.text?.trim() ?? '',
  boundingBox: value.boundingBox ?? emptyBox(),
});

const toLine = (value: RawLine): OcrLine => ({
  text: value.text?.trim() ?? '',
  boundingBox: value.boundingBox ?? emptyBox(),
  elements: (value.elements ?? []).map(toElement).filter((e) => e.text),
});

const toBlock = (value: RawBlock): OcrBlock => ({
  text: value.text?.trim() ?? '',
  boundingBox: value.boundingBox ?? emptyBox(),
  lines: (value.lines ?? []).map(toLine).filter((line) => line.text),
});

const normalize = (result: RecognitionResult): OcrDocument => {
  const blocks = (result.blocks ?? []).map(toBlock).filter((b) => b.text || b.lines.length > 0);
  const lines = blocks
    .flatMap((block) => block.lines)
    .sort((a, b) => a.boundingBox.y - b.boundingBox.y || a.boundingBox.x - b.boundingBox.x);
  const width = Math.max(1, ...lines.map((line) => line.boundingBox.x + line.boundingBox.width));
  const height = Math.max(1, ...lines.map((line) => line.boundingBox.y + line.boundingBox.height));
  return {
    text: (result.text ?? '').trim(),
    width,
    height,
    blocks,
    lines,
  };
};

export interface TextRecognizer {
  isSupported(): boolean;
  recognize(uri: string): Promise<OcrDocument>;
}

export const mlkitRecognizer: TextRecognizer = {
  isSupported() {
    return true;
  },
  async recognize(uri: string): Promise<OcrDocument> {
    const { isSupported, recognizeText } = await import('expo-mlkit-ocr');
    if (typeof isSupported === 'function' && !isSupported()) {
      throw new Error('mlkit-ocr-not-supported');
    }
    const raw = (await recognizeText(uri)) as RecognitionResult;
    return normalize(raw ?? { text: '', blocks: [] });
  },
};
