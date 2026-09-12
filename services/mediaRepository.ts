import { ReceiptMedia } from '@/models/types';
import { localDataSource } from './localDataSource';
import {
  importReceiptImage,
  deleteReceiptMedia,
  deleteAllReceiptMedia,
  isMediaAvailable,
} from './receiptMedia';

/**
 * MediaRepository — receipt images as first-class records.
 *
 * Files live in ReceiptSnap-managed app storage (see receiptMedia.ts); the
 * repository owns the database records pointing at them. Receipt metadata is
 * independent from the image: deleting or losing a file never deletes the
 * receipt, and the UI degrades to "Receipt image unavailable".
 *
 * Thumbnails: expo-image downsamples at display time, so no pre-generated
 * thumbnail files are needed today. OCR preprocessing uses expo-image-manipulator
 * in services/ocrPreprocess.ts (dev-client / native build).
 */

export const mediaRepository = {
  /** Copies an image into managed storage and records it against a receipt. */
  async saveMedia(receiptId: string, sourceUri: string, source: ReceiptMedia['source']): Promise<ReceiptMedia> {
    const media = await importReceiptImage(sourceUri, source);
    await localDataSource.saveMediaRecord({ ...media, receiptId });
    return media;
  },

  /** Replaces a receipt's image: deletes the old record + managed file, saves the new one. */
  async replaceMedia(receiptId: string, previous: ReceiptMedia | undefined, sourceUri: string, source: ReceiptMedia['source']): Promise<ReceiptMedia> {
    const media = await importReceiptImage(sourceUri, source);
    await localDataSource.saveMediaRecord({ ...media, receiptId });
    if (previous) {
      await deleteReceiptMedia(previous);
      await localDataSource.deleteMediaRecord(previous.id);
    }
    return media;
  },

  /** Deletes the managed file and its record. Gallery originals are never touched. */
  async deleteMedia(media?: ReceiptMedia | null): Promise<void> {
    await deleteReceiptMedia(media);
    if (media) {
      await localDataSource.deleteMediaRecord(media.id);
    }
  },

  /** Deletes every managed file and media record (Clear All Data). */
  async deleteAllMedia(): Promise<void> {
    await deleteAllReceiptMedia();
    await localDataSource.clearMediaRecords();
  },

  /** True when the managed file is still readable. */
  isAvailable(media?: ReceiptMedia | null): Promise<boolean> {
    return isMediaAvailable(media);
  },
};
