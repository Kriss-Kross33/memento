import { Image, Platform } from 'react-native';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Skia } from '@shopify/react-native-skia';
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

const applyTone = async (
  uri: string,
  tone: { contrast: number; brightness: number }
): Promise<string> => {
  try {
    const data = await Skia.Data.fromURI(uri);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return uri;
    const width = image.width();
    const height = image.height();
    const surface = Skia.Surface.MakeOffscreen(width, height);
    if (!surface) return uri;
    const contrast = tone.contrast;
    const brightness = tone.brightness * 255;
    const offset = (1 - contrast) * 0.5 * 255 + brightness;
    const paint = Skia.Paint();
    paint.setColorFilter(
      Skia.ColorFilter.MakeMatrix([
        contrast, 0, 0, 0, offset,
        0, contrast, 0, 0, offset,
        0, 0, contrast, 0, offset,
        0, 0, 0, 1, 0,
      ])
    );
    surface.getCanvas().drawImage(image, 0, 0, paint);
    const encoded = surface.makeImageSnapshot().encodeToBytes();
    if (!encoded) return uri;
    const path = `${FileSystem.cacheDirectory}ocr-tone-${Date.now().toString(36)}.jpg`;
    const bytes = encoded instanceof Uint8Array ? encoded : new Uint8Array(encoded);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    await FileSystem.writeAsStringAsync(path, globalThis.btoa(binary), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return path;
  } catch (error) {
    console.warn('[ocr] tone adjust skipped', error);
    return uri;
  }
};

/**
 * Applies a quality-derived resize / rotate / tone plan (and HEIC→JPEG if needed).
 */
export async function applyPreprocessPlan(uri: string, plan: PreprocessPlan): Promise<string> {
  if (Platform.OS === 'web' || !uri) return uri;

  try {
    const actions: Action[] = [];
    if (plan.resizeToWidth) actions.push({ resize: { width: plan.resizeToWidth } });
    if (plan.resizeToHeight) actions.push({ resize: { height: plan.resizeToHeight } });
    if (plan.rotateDegrees && Math.abs(plan.rotateDegrees) >= 1.5) {
      actions.push({ rotate: plan.rotateDegrees });
    }

    const shouldConvert = isHeic(uri);
    let next = uri;
    if (actions.length > 0 || shouldConvert) {
      if (__DEV__) {
        console.log('[ocr] enhance', {
          resize: actions.find((action) => 'resize' in action) ?? null,
          rotate: plan.rotateDegrees ?? null,
          convertHeic: shouldConvert,
          reason: plan.reason,
        });
      }
      const enhanced = await manipulateAsync(next, actions, { compress: 1, format: SaveFormat.JPEG });
      next = enhanced.uri || next;
    } else if (__DEV__) {
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

    if (plan.tone) {
      next = await applyTone(next, plan.tone);
    }
    return next;
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
