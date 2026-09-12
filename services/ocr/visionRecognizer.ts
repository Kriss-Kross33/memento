import { Platform } from 'react-native';
import type { OcrDocument } from '@/services/ocr/types';
import type { TextRecognizer } from '@/services/ocr/textRecognizer';
import { mapVisionResult } from '@/services/ocr/visionMap';

const VISION_OPTIONS = {
  recognitionLevel: 'accurate' as const,
  recognitionLanguages: ['en-US'],
  usesLanguageCorrection: true,
};

const loadNative = () => {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('memento-vision') as typeof import('memento-vision');
  } catch {
    return null;
  }
};

export const visionRecognizer: TextRecognizer = {
  id: 'vision',
  isSupported() {
    if (Platform.OS !== 'ios') return false;
    const native = loadNative();
    return Boolean(native?.isSupported?.());
  },
  async recognize(uri: string): Promise<OcrDocument> {
    if (Platform.OS !== 'ios') {
      throw new Error('vision-ocr-unsupported');
    }
    const native = loadNative();
    if (!native?.isSupported?.()) {
      throw new Error('vision-ocr-unsupported');
    }
    if (__DEV__) console.log('[ocr][vision] start');
    const started = Date.now();
    const raw = await native.recognizeText(uri, VISION_OPTIONS);
    const document = mapVisionResult(raw);
    if (__DEV__) {
      console.log('[ocr][vision] recognition complete', {
        lines: document.lines.length,
        durationMs: Date.now() - started,
      });
    }
    return document;
  },
};
