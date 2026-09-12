import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ReceiptMedia } from '@/models/types';

/**
 * Managed receipt media storage.
 *
 * Receipt images are always copied into Memento's private document
 * directory. We never reference the user's original Photos/Gallery URI, so
 * deleting the original photo can never break a saved receipt.
 */

const MEDIA_DIR = `${FileSystem.documentDirectory ?? ''}receipt-media`;
const THUMB_DIR = `${MEDIA_DIR}/thumbs`;

const isNative = Platform.OS !== 'web';
const isManagedUri = (uri: string) => uri.startsWith(MEDIA_DIR);

const ensureDir = async (dir: string): Promise<void> => {
  if (!isNative) return;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
};

const newMediaId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const createThumbnail = async (sourceUri: string, id: string): Promise<string | undefined> => {
  if (!isNative) return undefined;
  try {
    await ensureDir(THUMB_DIR);
    const dest = `${THUMB_DIR}/${id}.jpg`;
    const thumb = await manipulateAsync(sourceUri, [{ resize: { width: 320 } }], {
      compress: 0.7,
      format: SaveFormat.JPEG,
    });
    await FileSystem.copyAsync({ from: thumb.uri, to: dest });
    return dest;
  } catch (error) {
    console.warn('[receiptMedia] thumbnail generation failed', error);
    return undefined;
  }
};

/**
 * Creates a managed copy of an image and stores it as the receipt's media.
 * The original file (camera cache or photo library) is left untouched.
 */
export const importReceiptImage = async (
  sourceUri: string,
  source: ReceiptMedia['source']
): Promise<ReceiptMedia> => {
  const id = newMediaId();
  const media: ReceiptMedia = {
    id,
    uri: sourceUri,
    type: 'image',
    status: 'ready',
    addedAt: new Date().toISOString(),
    source,
  };

  if (!isNative) {
    return media;
  }

  await ensureDir(MEDIA_DIR);
  const dest = `${MEDIA_DIR}/${id}.jpg`;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
  } catch (copyError) {
    try {
      const base64 = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(dest, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (writeError) {
      console.warn('[receiptMedia] copy failed', copyError, writeError);
      throw copyError;
    }
  }
  media.uri = dest;
  media.thumbnailUri = await createThumbnail(dest, id);
  return media;
};

const deleteIfManaged = async (uri?: string): Promise<void> => {
  if (!uri || !isNative || !isManagedUri(uri)) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (error) {
    console.warn('[receiptMedia] failed to delete managed image', error);
  }
};

/**
 * Deletes Memento-managed files for a receipt's media. Original photos in
 * the user's gallery are never touched. Safe to call repeatedly.
 */
export const deleteReceiptMedia = async (media?: ReceiptMedia | null): Promise<void> => {
  if (!media) return;
  await deleteIfManaged(media.uri);
  await deleteIfManaged(media.thumbnailUri);
};

/** Deletes every managed media file (used by Clear All Data). */
export const deleteAllReceiptMedia = async (): Promise<void> => {
  if (!isNative) return;
  try {
    const info = await FileSystem.getInfoAsync(MEDIA_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(MEDIA_DIR, { idempotent: true });
    }
  } catch (error) {
    console.warn('[receiptMedia] failed to clear media directory', error);
  }
};

/**
 * Verifies a managed image is still readable. If the file went missing, the
 * receipt stays intact and the UI shows a graceful unavailable state.
 */
export const isMediaAvailable = async (media?: ReceiptMedia | null): Promise<boolean> => {
  if (!media || !media.uri) return false;
  if (!isNative) return true;
  if (!isManagedUri(media.uri)) return true;
  try {
    const info = await FileSystem.getInfoAsync(media.uri);
    return info.exists;
  } catch {
    return false;
  }
};
