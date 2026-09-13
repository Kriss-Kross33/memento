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
    if (!receipt.media?.uri) continue;
    const data = await readBase64(receipt.media.uri);
    if (!data) continue;
    images.push({
      id: receipt.media.id,
      receiptId: receipt.id,
      source: receipt.media.source,
      addedAt: receipt.media.addedAt,
      data,
    });
  }

  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    receipts: receipts.map(({ media, ...rest }) => rest),
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
    const image = (parsed.images ?? []).find((item) => item.receiptId === receipt.id);
    let media = undefined;
    if (image && Platform.OS !== 'web') {
      const temp = `${FileSystem.cacheDirectory ?? ''}restore-${image.id}.jpg`;
      await FileSystem.writeAsStringAsync(temp, image.data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      media = await importReceiptImage(temp, image.source);
      photos += 1;
    }
    await receiptRepository.create({
      ...receipt,
      media,
    });
  }

  return { receipts: parsed.receipts.length, photos };
};
