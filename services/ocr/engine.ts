import { Platform } from 'react-native';
import type { OcrDocument, OcrEngineId } from '@/services/ocr/types';
import type { TextRecognizer } from '@/services/ocr/textRecognizer';
import { mlkitRecognizer } from '@/services/ocr/mlkitRecognizer';
import { visionRecognizer } from '@/services/ocr/visionRecognizer';
import { resolveOcrEngine } from '@/services/ocr/enginePreference';

const unsupportedRecognizer: TextRecognizer = {
  id: 'mlkit',
  isSupported() {
    return false;
  },
  async recognize(): Promise<OcrDocument> {
    throw new Error('ocr-unsupported');
  },
};

export const getTextRecognizer = (): TextRecognizer => {
  const engine = resolveOcrEngine(Platform.OS);
  if (engine === 'vision') return visionRecognizer;
  if (engine === 'mlkit') return mlkitRecognizer;
  return unsupportedRecognizer;
};

export const getActiveOcrEngine = (): OcrEngineId | 'unsupported' => resolveOcrEngine(Platform.OS);
