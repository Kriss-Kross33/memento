import type { TextRecognizer } from '@/services/ocr/textRecognizer';
import { mlkitRecognizer } from '@/services/ocr/textRecognizer';

/**
 * Platform-neutral OCR entry. The parser only consumes OcrDocument.
 * Android uses ML Kit today. A future iOS Vision recognizer can be
 * swapped here without touching receipt extraction.
 */
export const getTextRecognizer = (): TextRecognizer => mlkitRecognizer;
