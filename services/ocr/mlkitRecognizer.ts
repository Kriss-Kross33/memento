import type { OcrDocument } from '@/services/ocr/types';
import { normalizeOcrResult } from '@/services/ocr/normalize';
import type { TextRecognizer } from '@/services/ocr/textRecognizer';

export const mlkitRecognizer: TextRecognizer = {
  id: 'mlkit',
  isSupported() {
    return true;
  },
  async recognize(uri: string): Promise<OcrDocument> {
    const { isSupported, recognizeText } = await import('expo-mlkit-ocr');
    if (typeof isSupported === 'function' && !isSupported()) {
      throw new Error('mlkit-ocr-not-supported');
    }
    return normalizeOcrResult((await recognizeText(uri)) ?? { text: '', blocks: [] });
  },
};
