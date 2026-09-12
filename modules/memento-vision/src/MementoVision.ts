import { requireNativeModule } from 'expo-modules-core';
import type {
  VisionOcrResult,
  VisionRecognizeOptions,
} from './types';

export type {
  VisionBlock,
  VisionBox,
  VisionCandidate,
  VisionElement,
  VisionLine,
  VisionOcrResult,
  VisionRecognitionLevel,
  VisionRecognizeOptions,
} from './types';

type NativeVision = {
  isSupported(): boolean;
  recognizeText(uri: string, options?: VisionRecognizeOptions): Promise<VisionOcrResult>;
};

const loadNative = (): NativeVision | null => {
  try {
    return requireNativeModule<NativeVision>('MementoVision');
  } catch {
    return null;
  }
};

export const isSupported = (): boolean => loadNative()?.isSupported() === true;

export const recognizeText = async (
  uri: string,
  options: VisionRecognizeOptions = {}
): Promise<VisionOcrResult> => {
  const native = loadNative();
  if (!native?.isSupported()) {
    throw new Error('vision-ocr-unsupported');
  }
  return native.recognizeText(uri, options);
};
