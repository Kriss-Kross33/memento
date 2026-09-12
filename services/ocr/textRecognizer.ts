import type { OcrDocument, OcrEngineId } from '@/services/ocr/types';

export interface TextRecognizer {
  id: OcrEngineId;
  isSupported(): boolean;
  recognize(uri: string): Promise<OcrDocument>;
}
