import { requireNativeModule } from 'expo-modules-core';
import type { RasterizeOptions } from './types';

type NativePdf = {
  isSupported(): boolean;
  rasterize(uri: string, maxPages: number, width: number): Promise<string[]>;
};

const loadNative = (): NativePdf | null => {
  try {
    return requireNativeModule<NativePdf>('MementoPdf');
  } catch {
    return null;
  }
};

export const isSupported = (): boolean => loadNative()?.isSupported() === true;

export const rasterize = async (uri: string, options: RasterizeOptions = {}): Promise<string[]> => {
  const native = loadNative();
  if (!native?.isSupported()) {
    throw new Error('pdf-raster-unsupported');
  }
  return native.rasterize(uri, options.maxPages ?? 12, options.width ?? 1600);
};
