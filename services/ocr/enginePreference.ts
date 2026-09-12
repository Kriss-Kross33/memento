import type { OcrEngineId, OcrEnginePreference } from '@/services/ocr/types';

let preference: OcrEnginePreference = 'auto';

export const selectOcrEngine = (
  platform: string,
  nextPreference: OcrEnginePreference = 'auto'
): OcrEngineId | 'unsupported' => {
  if (platform === 'web') return 'unsupported';
  if (nextPreference === 'vision' || nextPreference === 'mlkit') return nextPreference;
  if (platform === 'ios') return 'vision';
  if (platform === 'android') return 'mlkit';
  return 'unsupported';
};

export const getOcrEnginePreference = (): OcrEnginePreference => preference;

export const setOcrEnginePreference = (next: OcrEnginePreference): void => {
  preference = next;
};

export const resolveOcrEngine = (platform: string): OcrEngineId | 'unsupported' =>
  selectOcrEngine(platform, preference);
