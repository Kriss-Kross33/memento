import { Image, Platform } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  assessImageQuality,
  choosePreprocessPlan,
  type CaptureSource,
  type PreprocessPlan,
} from '@/services/ocr/imageQuality';

const getImageSize = (uri: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });

const isHeic = (uri: string): boolean => /\.heic($|\?)/i.test(uri);

/**
 * Applies a quality-derived resize plan (and HEIC→JPEG if needed).
 * Leaves already-sharp scanner crops alone.
 */
export async function applyPreprocessPlan(uri: string, plan: PreprocessPlan): Promise<string> {
  if (Platform.OS === 'web' || !uri) return uri;

  try {
    const actions: { resize: { width?: number; height?: number } }[] = [];
    if (plan.resizeToWidth) actions.push({ resize: { width: plan.resizeToWidth } });
    if (plan.resizeToHeight) actions.push({ resize: { height: plan.resizeToHeight } });

    const shouldConvert = isHeic(uri);
    if (actions.length === 0 && !shouldConvert) {
      if (__DEV__) {
        let width = 0;
        let height = 0;
        try {
          const size = await getImageSize(uri);
          width = size.width;
          height = size.height;
        } catch {
          /* keep zeros */
        }
        console.log('[ocr] enhance skipped (use original)', {
          width,
          height,
          minSide: Math.min(width, height),
          maxSide: Math.max(width, height),
          reason: plan.reason,
        });
      }
      return uri;
    }

    if (__DEV__) {
      console.log('[ocr] enhance', {
        resize: actions[0]?.resize ?? null,
        convertHeic: shouldConvert,
        reason: plan.reason,
      });
    }

    const enhanced = await manipulateAsync(uri, actions, { compress: 1, format: SaveFormat.JPEG });
    return enhanced.uri || uri;
  } catch (error) {
    console.warn('[ocr] image enhance skipped', error);
    return uri;
  }
}

/**
 * Prepares a receipt photo for OCR using the quality gate.
 */
export async function enhanceReceiptImage(
  uri: string,
  source: CaptureSource = 'unknown'
): Promise<string> {
  if (Platform.OS === 'web' || !uri) return uri;
  try {
    const quality = await assessImageQuality(uri, source);
    return applyPreprocessPlan(uri, choosePreprocessPlan(quality));
  } catch (error) {
    console.warn('[ocr] image enhance skipped', error);
    return uri;
  }
}
