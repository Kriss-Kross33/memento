import { Image, Platform } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/** Only enlarge tiny thermal shots. Document-scanner crops (~800px+) stay as-is. */
const MIN_SIDE = 640;
const TARGET_SIDE = 1200;
const MAX_SIDE = 4000;

const getImageSize = (uri: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });

const isHeic = (uri: string): boolean => /\.heic($|\?)/i.test(uri);

/**
 * Prepares a receipt photo for OCR. Skips resize when the crop is already
 * large enough — interpolating a sharp scan makes ML Kit worse.
 */
export async function enhanceReceiptImage(uri: string): Promise<string> {
  if (Platform.OS === 'web' || !uri) return uri;

  try {
    let width = 0;
    let height = 0;
    try {
      const size = await getImageSize(uri);
      width = size.width;
      height = size.height;
    } catch {
      const probe = await manipulateAsync(uri, [], { compress: 1, format: SaveFormat.JPEG });
      width = probe.width;
      height = probe.height;
    }

    const minSide = Math.min(width, height);
    const maxSide = Math.max(width, height);
    const actions: { resize: { width?: number; height?: number } }[] = [];

    if (minSide > 0 && minSide < MIN_SIDE) {
      if (width <= height) {
        actions.push({ resize: { width: TARGET_SIDE } });
      } else {
        actions.push({ resize: { height: TARGET_SIDE } });
      }
    } else if (maxSide > MAX_SIDE) {
      if (width >= height) {
        actions.push({ resize: { width: MAX_SIDE } });
      } else {
        actions.push({ resize: { height: MAX_SIDE } });
      }
    }

    const shouldConvert = isHeic(uri);
    if (actions.length === 0 && !shouldConvert) {
      if (__DEV__) {
        console.log('[ocr] enhance skipped (use original)', {
          width,
          height,
          minSide,
          maxSide,
        });
      }
      return uri;
    }

    if (__DEV__) {
      console.log('[ocr] enhance', {
        width,
        height,
        minSide,
        maxSide,
        resize: actions[0]?.resize ?? null,
        convertHeic: shouldConvert,
      });
    }

    const enhanced = await manipulateAsync(uri, actions, { compress: 1, format: SaveFormat.JPEG });
    return enhanced.uri || uri;
  } catch (error) {
    console.warn('[ocr] image enhance skipped', error);
    return uri;
  }
}
