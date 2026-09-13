import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Category, Receipt, ReceiptMedia } from '@/models/types';
import { localDataSource } from '@/services/localDataSource';
import { receiptRepository } from '@/services/receiptRepository';
import { importReceiptImage } from '@/services/receiptMedia';

const BACKUP_VERSION = 1;

interface BackupImage {
  id: string;
  receiptId: string;
  source: ReceiptMedia['source'];
  addedAt: string;
  data: string;
}

interface BackupPayload {
  version: number;
  exportedAt: string;
  receipts: Receipt[];
  categories: Category[];
  images: BackupImage[];
}

const readBase64 = async (uri: string): Promise<string | null> => {
  if (Platform.OS === 'web') return null;
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return null;
  }
};

export const buildBackupFilename = (date = new Date()): string =>
  `memento-backup-${date.toISOString().split('T')[0]}.json`;

export const createLocalBackup = async (): Promise<{ filename: string; uri: string; json: string }> => {
  const [receipts, categories] = await Promise.all([
    receiptRepository.getAll(),
    receiptRepository.getCategories(),
  ]);

  const images: BackupImage[] = [];
  for (const receipt of receipts) {
    const pages = receipt.sourceMedia?.length
      ? receipt.sourceMedia
      : receipt.media
        ? [receipt.media]
        : [];
    for (const media of pages) {
      if (!media.uri) continue;
      const data = await readBase64(media.uri);
      if (!data) continue;
      images.push({
        id: media.id,
        receiptId: receipt.id,
        source: media.source,
        addedAt: media.addedAt,
        data,
      });
    }
  }

  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    receipts: receipts.map(({ media, sourceMedia, ...rest }) => rest),
    categories: categories.filter((c) => !c.builtin),
    images,
  };

  const json = JSON.stringify(payload);
  const filename = buildBackupFilename();

  if (Platform.OS === 'web') {
    return { filename, uri: '', json };
  }

  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  const uri = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  return { filename, uri, json };
};

export const restoreLocalBackup = async (json: string): Promise<{ receipts: number; photos: number }> => {
  const parsed = JSON.parse(json) as BackupPayload;
  if (!parsed || parsed.version !== BACKUP_VERSION || !Array.isArray(parsed.receipts)) {
    throw new Error('invalid-backup');
  }

  for (const category of parsed.categories ?? []) {
    await localDataSource.saveCategory(category);
  }

  let photos = 0;
  for (const receipt of parsed.receipts) {
    const receiptImages = (parsed.images ?? []).filter((item) => item.receiptId === receipt.id);
    const sourceMedia: ReceiptMedia[] = [];
    if (Platform.OS !== 'web') {
      for (const [index, image] of receiptImages.entries()) {
        const temp = `${FileSystem.cacheDirectory ?? ''}restore-${image.id}.jpg`;
        await FileSystem.writeAsStringAsync(temp, image.data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        sourceMedia.push(await importReceiptImage(temp, image.source, { pageIndex: index }));
        photos += 1;
      }
    }
    await receiptRepository.create({
      ...receipt,
      media: sourceMedia[0],
      sourceMedia: sourceMedia.length > 0 ? sourceMedia : undefined,
    });
  }

  return { receipts: parsed.receipts.length, photos };
};
