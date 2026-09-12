import { Platform } from 'react-native';
import { enhanceReceiptImage } from '@/services/ocrPreprocess';
import { scoreOcrResult } from '@/utils/parseReceiptOcr';

export type OcrBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrLine = {
  text: string;
  boundingBox: OcrBox;
};

export type OcrResult = {
  text: string;
  lines: OcrLine[];
};

const emptyBox = (): OcrBox => ({ x: 0, y: 0, width: 0, height: 0 });

const logOcrDump = (label: string, result: OcrResult | null, extra?: Record<string, unknown>) => {
  if (!__DEV__) return;
  if (!result) {
    console.log(`[ocr] ${label}: <null>`, extra ?? '');
    return;
  }
  const lines = result.lines
    .map((line, i) => {
      const { x, y, width, height } = line.boundingBox;
      return `  ${i} y=${Math.round(y)} x=${Math.round(x)} ${Math.round(width)}x${Math.round(height)}  ${JSON.stringify(line.text)}`;
    })
    .join('\n');
  console.log(`[ocr] ${label}`, {
    score: scoreOcrResult(result),
    lineCount: result.lines.length,
    charCount: result.text.length,
    ...extra,
  });
  console.log(`[ocr] ${label} text:\n${result.text || '<empty>'}`);
  console.log(`[ocr] ${label} lines:\n${lines || '  <none>'}`);
};

const toOcrResult = (result: {
  text?: string;
  blocks?: Array<{
    text?: string;
    boundingBox?: OcrBox;
    lines?: Array<{ text?: string; boundingBox?: OcrBox }>;
  }>;
}): OcrResult => {
  const lines: OcrLine[] = [];
  for (const block of result.blocks ?? []) {
    if (block.lines?.length) {
      for (const line of block.lines) {
        const text = line.text?.trim();
        if (!text) continue;
        lines.push({ text, boundingBox: line.boundingBox ?? emptyBox() });
      }
    } else if (block.text?.trim()) {
      lines.push({
        text: block.text.trim(),
        boundingBox: block.boundingBox ?? emptyBox(),
      });
    }
  }
  lines.sort((a, b) => a.boundingBox.y - b.boundingBox.y || a.boundingBox.x - b.boundingBox.x);
  return { text: (result.text ?? '').trim(), lines };
};

const recognizeUri = async (uri: string, label: string): Promise<OcrResult | null> => {
  try {
    const { isSupported, recognizeText } = await import('expo-mlkit-ocr');
    if (typeof isSupported === 'function' && !isSupported()) {
      if (__DEV__) console.log(`[ocr] ${label}: mlkit not supported`);
      return null;
    }
    const result = await recognizeText(uri);
    if (__DEV__) {
      console.log(`[ocr] ${label} mlkit raw`, {
        uri,
        hasText: Boolean(result?.text?.trim()),
        textLength: result?.text?.length ?? 0,
        blockCount: result?.blocks?.length ?? 0,
      });
    }
    if (!result?.text?.trim()) {
      logOcrDump(label, { text: '', lines: [] }, { uri });
      return { text: '', lines: [] };
    }
    const parsed = toOcrResult(result);
    logOcrDump(label, parsed, { uri });
    return parsed;
  } catch (error) {
    console.warn('[ocr] recognition unavailable', error);
    return null;
  }
};

const STRONG_SCORE = 10;

const pickBetter = (a: OcrResult | null, b: OcrResult | null): OcrResult | null => {
  if (!a) return b;
  if (!b) return a;
  return scoreOcrResult(b) > scoreOcrResult(a) ? b : a;
};

/**
 * On-device OCR via Google ML Kit (Android) / ML Kit or Apple Vision (iOS).
 * JPEG-encodes / upscales the crop, then dual-passes the original if the
 * first read looks thin.
 */
export async function recognizeReceiptImage(uri: string): Promise<OcrResult | null> {
  if (Platform.OS === 'web' || !uri) return null;

  if (__DEV__) console.log('[ocr] start', { uri });

  const enhancedUri = await enhanceReceiptImage(uri);
  if (__DEV__) {
    console.log('[ocr] preprocess', {
      original: uri,
      enhanced: enhancedUri,
      changed: enhancedUri !== uri,
    });
  }

  const first = await recognizeUri(enhancedUri, enhancedUri === uri ? 'pass:original' : 'pass:enhanced');
  if (enhancedUri === uri) {
    logOcrDump('chosen', first, { reason: 'no-preprocess' });
    return first;
  }
  if (first && scoreOcrResult(first) >= STRONG_SCORE) {
    logOcrDump('chosen', first, { reason: `enhanced-strong score=${scoreOcrResult(first)}` });
    return first;
  }

  const second = await recognizeUri(uri, 'pass:original');
  const chosen = pickBetter(first, second);
  logOcrDump('chosen', chosen, {
    reason: 'dual-pass',
    enhancedScore: first ? scoreOcrResult(first) : null,
    originalScore: second ? scoreOcrResult(second) : null,
  });
  return chosen;
}
