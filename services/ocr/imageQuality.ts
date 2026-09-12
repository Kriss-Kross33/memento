import { Image, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Skia } from '@shopify/react-native-skia';
import {
  analyzePixels,
  issuesFromMetrics,
  type PixelMetrics,
  type QualityIssue,
} from '@/services/ocr/pixelMetrics';

export type CaptureSource = 'scanner' | 'camera' | 'library' | 'unknown';

export type ImageQuality = {
  width: number;
  height: number;
  minSide: number;
  maxSide: number;
  fileBytes?: number;
  bytesPerPixel?: number;
  source: CaptureSource;
  brightness?: number;
  contrast?: number;
  sharpness?: number;
  glare?: number;
  coverage?: number;
  skew?: number;
  signedSkew?: number;
  perspective?: number;
  issues: QualityIssue[];
  advice: CaptureAdvice;
};

export type CaptureAdvice = 'ok' | 'retake-blur' | 'retake-glare' | 'retake-coverage' | 'use-scanner';

export type PreprocessPlan = {
  resizeToWidth?: number;
  resizeToHeight?: number;
  rotateDegrees?: number;
  tone?: { contrast: number; brightness: number };
  reason: 'none' | 'upscale-small' | 'downscale-large' | 'brighten' | 'contrast' | 'deskew';
  issues: QualityIssue[];
};

const SAMPLE_WIDTH = 160;

const getImageSize = (uri: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });

const adviceFromIssues = (issues: QualityIssue[]): CaptureAdvice => {
  if (issues.includes('blurry')) return 'retake-blur';
  if (issues.includes('glare')) return 'retake-glare';
  if (issues.includes('low-coverage')) return 'retake-coverage';
  if (issues.includes('skewed')) return 'use-scanner';
  return 'ok';
};

const sampleMetrics = async (uri: string): Promise<PixelMetrics | null> => {
  if (Platform.OS === 'web' || !uri) return null;
  try {
    const sampled = await manipulateAsync(uri, [{ resize: { width: SAMPLE_WIDTH } }], {
      compress: 1,
      format: SaveFormat.JPEG,
    });
    const data = await Skia.Data.fromURI(sampled.uri);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return null;
    const info = image.getImageInfo();
    const pixels = image.readPixels(0, 0, info);
    if (!pixels || pixels instanceof Float32Array) return null;
    return analyzePixels(pixels, info.width, info.height);
  } catch {
    return null;
  }
};

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
      issues: [],
      advice: 'ok',
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

  const metrics = await sampleMetrics(uri);
  const issues = issuesFromMetrics(metrics, { minSide: Math.min(width, height) });
  const pixelCount = width * height;
  return {
    width,
    height,
    minSide: Math.min(width, height),
    maxSide: Math.max(width, height),
    fileBytes,
    bytesPerPixel: fileBytes && pixelCount > 0 ? fileBytes / pixelCount : undefined,
    source,
    brightness: metrics?.brightness,
    contrast: metrics?.contrast,
    sharpness: metrics?.sharpness,
    glare: metrics?.glare,
    coverage: metrics?.coverage,
    skew: metrics?.skew,
    signedSkew: metrics?.signedSkew,
    perspective: metrics?.perspective,
    issues,
    advice: adviceFromIssues(issues),
  };
};

export const choosePreprocessPlan = (quality: ImageQuality): PreprocessPlan => {
  const issues = quality.issues;

  if (quality.minSide > 0 && quality.minSide < 640) {
    return quality.width <= quality.height
      ? { resizeToWidth: 1200, reason: 'upscale-small', issues }
      : { resizeToHeight: 1200, reason: 'upscale-small', issues };
  }

  if (quality.maxSide > 4000) {
    return quality.width >= quality.height
      ? { resizeToWidth: 4000, reason: 'downscale-large', issues }
      : { resizeToHeight: 4000, reason: 'downscale-large', issues };
  }

  if (issues.includes('dark')) {
    return { tone: { contrast: 1.08, brightness: 0.14 }, reason: 'brighten', issues };
  }
  if (issues.includes('low-contrast')) {
    return { tone: { contrast: 1.28, brightness: 0.02 }, reason: 'contrast', issues };
  }
  if (issues.includes('skewed') && (quality.skew ?? 0) >= 3 && (quality.skew ?? 0) <= 16) {
    return {
      rotateDegrees: Math.round((quality.signedSkew ?? 0) * 10) / 10,
      reason: 'deskew',
      issues,
    };
  }

  return { reason: 'none', issues };
};
