import { Platform } from 'react-native';
import type { OcrDocument, OcrResult } from '@/services/ocr/types';
import { getActiveOcrEngine, getTextRecognizer } from '@/services/ocr/engine';
import {
  assessImageQuality,
  choosePreprocessPlan,
  type CaptureSource,
} from '@/services/ocr/imageQuality';
import { applyPreprocessPlan } from '@/services/ocrPreprocess';
import { scoreOcrResult } from '@/utils/receipt';

export type { OcrBox, OcrBlock, OcrDocument, OcrElement, OcrLine, OcrResult } from '@/services/ocr/types';
export type { CaptureSource } from '@/services/ocr/imageQuality';
export { getActiveOcrEngine, getTextRecognizer } from '@/services/ocr/engine';
export type { TextRecognizer } from '@/services/ocr/textRecognizer';
export { getOcrEnginePreference, setOcrEnginePreference } from '@/services/ocr/enginePreference';

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

/**
 * One recognizer pass. No preprocess — callers apply a quality plan first.
 */
export async function recognizeTextOnImage(uri: string, label = 'pass'): Promise<OcrDocument | null> {
  if (Platform.OS === 'web' || !uri) return null;
  try {
    const engine = getActiveOcrEngine();
    const result = await getTextRecognizer().recognize(uri);
    if (__DEV__) {
      console.log(`[ocr] ${label} ${engine} raw`, {
        engine,
        uri,
        hasText: Boolean(result.text?.trim()),
        textLength: result.text?.length ?? 0,
        blockCount: result.blocks?.length ?? 0,
      });
    }
    logOcrDump(label, result, { uri });
    return result;
  } catch (error) {
    console.warn('[ocr] recognition unavailable', error);
    return null;
  }
}

/**
 * Quality gate → at most one preprocess → one OCR pass.
 */
export async function recognizeReceiptImage(
  uri: string,
  source: CaptureSource = 'unknown'
): Promise<OcrDocument | null> {
  if (Platform.OS === 'web' || !uri) return null;
  if (__DEV__) console.log('[ocr] start', { uri, source });

  const quality = await assessImageQuality(uri, source);
  const plan = choosePreprocessPlan(quality);
  const prepared = await applyPreprocessPlan(uri, plan);
  if (__DEV__) {
    console.log('[ocr] preprocess', {
      original: uri,
      enhanced: prepared,
      changed: prepared !== uri,
      plan: plan.reason,
      width: quality.width,
      height: quality.height,
    });
  }

  const result = await recognizeTextOnImage(
    prepared,
    plan.reason === 'none' ? 'pass:original' : `pass:${plan.reason}`
  );
  logOcrDump('chosen', result, { reason: `single-pass ${plan.reason}` });
  return result;
}
