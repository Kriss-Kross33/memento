import { Image, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export type CaptureSource = 'scanner' | 'camera' | 'library' | 'unknown';

export type ImageQuality = {
  width: number;
  height: number;
  minSide: number;
  maxSide: number;
  fileBytes?: number;
  bytesPerPixel?: number;
  source: CaptureSource;
};

export type PreprocessPlan = {
  resizeToWidth?: number;
  resizeToHeight?: number;
  reason: 'none' | 'upscale-small' | 'downscale-large';
};

const getImageSize = (uri: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });

export const assessImageQuality = async (
  uri: string,
  source: CaptureSource = 'unknown'
): Promise<ImageQuality> => {
  if (!uri || Platform.OS === 'web') {
    return {
      width: 0,
      height: 0,
      minSide: 0,
      maxSide: 0,
      source,
    };
  }

  let width = 0;
  let height = 0;
  try {
    const size = await getImageSize(uri);
    width = size.width;
    height = size.height;
  } catch {
    width = 0;
    height = 0;
  }

  let fileBytes: number | undefined;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    fileBytes = info.exists && 'size' in info && typeof info.size === 'number' ? info.size : undefined;
  } catch {
    fileBytes = undefined;
  }

  const pixelCount = width * height;
  return {
    width,
    height,
    minSide: Math.min(width, height),
    maxSide: Math.max(width, height),
    fileBytes,
    bytesPerPixel: fileBytes && pixelCount > 0 ? fileBytes / pixelCount : undefined,
    source,
  };
};

export const choosePreprocessPlan = (quality: ImageQuality): PreprocessPlan => {
  if (quality.minSide > 0 && quality.minSide < 640) {
    if (quality.width <= quality.height) return { resizeToWidth: 1200, reason: 'upscale-small' };
    return { resizeToHeight: 1200, reason: 'upscale-small' };
  }

  if (quality.maxSide > 4000) {
    if (quality.width >= quality.height) return { resizeToWidth: 4000, reason: 'downscale-large' };
    return { resizeToHeight: 4000, reason: 'downscale-large' };
  }

  return { reason: 'none' };
};
