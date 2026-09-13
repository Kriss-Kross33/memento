import { Platform } from 'react-native';
import { MAX_PDF_PAGES, PDF_RASTER_WIDTH } from '@/utils/receipt/limits';

export type RasterizePdfResult = {
  uris: string[];
  truncated: boolean;
  error?: 'unsupported' | 'too-many-pages' | 'raster-failed';
};

type NativePdf = {
  isSupported(): boolean;
  rasterize(uri: string, maxPages: number, width: number): Promise<string[]>;
};

const loadNative = (): NativePdf | null => {
  if (Platform.OS === 'web') return null;
  try {
    const { requireNativeModule } = require('expo-modules-core') as {
      requireNativeModule: <T>(name: string) => T;
    };
    return requireNativeModule<NativePdf>('MementoPdf');
  } catch {
    return null;
  }
};

export const isPdfRasterSupported = (): boolean => loadNative()?.isSupported() === true;

/**
 * Rasterize a local PDF into page images. Keep successful pages if one fails.
 * Selectable-text extraction is an extension point, not implemented here.
 */
export const rasterizePdfPages = async (uri: string): Promise<RasterizePdfResult> => {
  const native = loadNative();
  if (!native?.isSupported()) {
    return { uris: [], truncated: false, error: 'unsupported' };
  }
  try {
    const uris = await native.rasterize(uri, MAX_PDF_PAGES, PDF_RASTER_WIDTH);
    const pages = (uris ?? []).filter(Boolean).slice(0, MAX_PDF_PAGES);
    if (pages.length === 0) return { uris: [], truncated: false, error: 'raster-failed' };
    return { uris: pages, truncated: (uris?.length ?? 0) > MAX_PDF_PAGES };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/too many pages|max pages/i.test(message)) {
      return { uris: [], truncated: true, error: 'too-many-pages' };
    }
    return { uris: [], truncated: false, error: 'raster-failed' };
  }
};
