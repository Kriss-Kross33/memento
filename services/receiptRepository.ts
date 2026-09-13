import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category, Receipt, ReceiptMedia } from '@/models/types';
import {
  getAsyncStorageDataSource,
  localDataSource,
  StoredMedia,
  StoredReceipt,
} from './localDataSource';
import { normalizeReceipt } from '@/mocks/receipts';
import { builtinCategories } from '@/services/categoryRepository';
import { matchPurchaseQuery } from '@/services/search/query';

/**
 * ReceiptRepository — the single persistence interface for receipts.
 *
 * UI → context → this repository → LocalDataSource. The UI never knows how
 * records are stored.
 */

export type NewReceipt = Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'> & { media?: ReceiptMedia };

/** Legacy prototype stores. Keys are kept on disk after migration as a backup. */
const LEGACY_KEYS = ['receiptsnap_receipts_v2', 'receipts_data'] as const;
const MIGRATION_FLAG = 'receiptsnap_migrated_v3';
const SEED_CLEAR_FLAG = 'receiptsnap_cleared_seed_v4';
const SQLITE_MIGRATION_FLAG = 'receiptsnap_migrated_sqlite_v1';
/** IDs used by the old first-run sample receipts. Real receipts use generated ids. */
const SEED_RECEIPT_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const newId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const toReceiptMedia = (record?: StoredMedia | null): ReceiptMedia | undefined =>
  record
    ? {
        id: record.id,
        uri: record.uri,
        thumbnailUri: record.thumbnailUri,
        type: record.type ?? 'image',
        status: record.status ?? 'ready',
        addedAt: record.addedAt,
        source: record.source,
        pageIndex: record.pageIndex,
        width: record.width,
        height: record.height,
      }
    : undefined;

const sortMedia = (records: StoredMedia[]): StoredMedia[] =>
  [...records].sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0));

const toStored = (receipt: Receipt): StoredReceipt => {
  const { media, sourceMedia, ...rest } = receipt;
  return { ...rest, mediaId: media?.id ?? sourceMedia?.[0]?.id };
};

const hydrate = (record: StoredReceipt, mediaRecords: StoredMedia[]): Receipt => {
  const pages = sortMedia(mediaRecords).map((item) => toReceiptMedia(item)!);
  return {
    ...record,
    media: pages[0],
    sourceMedia: pages.length > 0 ? pages : undefined,
  };
};

const migrateLegacyStore = async (): Promise<void> => {
  const flag = await AsyncStorage.getItem(MIGRATION_FLAG);
  if (flag) return;

  const existing = await localDataSource.getAllReceiptRecords();
  const source = getAsyncStorageDataSource();

  for (const key of LEGACY_KEYS) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>[];
      if (!Array.isArray(parsed)) continue;
      if (existing.length === 0 && parsed.length > 0) {
        for (const rawReceipt of parsed) {
          const receipt = normalizeReceipt(rawReceipt);
          if (receipt.media) {
            await source.saveMediaRecord({ ...receipt.media, receiptId: receipt.id });
          }
          await source.saveReceiptRecord(toStored(receipt));
        }
      }
      break;
    } catch (error) {
      console.warn('[receiptRepository] legacy migration failed for', key, error);
    }
  }

  await AsyncStorage.setItem(MIGRATION_FLAG, '1');
};

const clearSeedReceipts = async (): Promise<void> => {
  const flag = await AsyncStorage.getItem(SEED_CLEAR_FLAG);
  if (flag) return;

  for (const id of SEED_RECEIPT_IDS) {
    const mediaRecords = await localDataSource.getMediaForReceipt(id);
    for (const media of mediaRecords) {
      await localDataSource.deleteMediaRecord(media.id);
    }
    await localDataSource.deleteReceiptRecord(id);
  }

  await AsyncStorage.setItem(SEED_CLEAR_FLAG, '1');
};

const seedBuiltinCategories = async (): Promise<void> => {
  const existing = await localDataSource.getAllCategories();
  const have = new Set(existing.map((c) => c.name));
  for (const category of builtinCategories) {
    if (!have.has(category.name)) {
      await localDataSource.saveCategory(category);
    }
  }
};

const migrateAsyncStorageIntoSqlite = async (): Promise<void> => {
  const flag = await AsyncStorage.getItem(SQLITE_MIGRATION_FLAG);
  if (flag) return;

  const asyncSource = getAsyncStorageDataSource();
  const [receipts, media, categories] = await Promise.all([
    asyncSource.getAllReceiptRecords(),
    asyncSource.getAllMediaRecords(),
    asyncSource.getAllCategories(),
  ]);

  for (const category of categories) {
    await localDataSource.saveCategory(category);
  }
  for (const receipt of receipts) {
    await localDataSource.saveReceiptRecord(receipt);
  }
  for (const mediaRecord of media) {
    await localDataSource.saveMediaRecord(mediaRecord);
  }

  await AsyncStorage.setItem(SQLITE_MIGRATION_FLAG, '1');
};

const initializeStore = async (): Promise<void> => {
  await migrateLegacyStore();
  try {
    const { tryOpenSqliteDataSource } = await import('./sqliteDataSource');
    const sqlite = await tryOpenSqliteDataSource();
    if (sqlite) {
      localDataSource.inner = sqlite;
      await migrateAsyncStorageIntoSqlite();
    }
  } catch (error) {
    console.warn('[receiptRepository] SQLite unavailable, using AsyncStorage', error);
  }
  await seedBuiltinCategories();
  await clearSeedReceipts();
};

let readyPromise: Promise<void> | null = null;

/** Idempotent initialization: open SQLite, migrate, then drop sample receipts. */
export const ensureReceiptStoreReady = (): Promise<void> => {
  if (!readyPromise) {
    readyPromise = initializeStore();
  }
  return readyPromise;
};

const buildReceipt = (input: NewReceipt, id: string): Receipt => {
  const items = (input.items ?? []).map((item) => ({
    ...item,
    id: item.id || newId(),
    total: item.total ?? item.quantity * item.unitPrice,
  }));
  const subtotal =
    input.subtotal ??
    (items.length > 0 ? items.reduce((sum, item) => sum + (item.total ?? 0), 0) : undefined);
  return {
    ...input,
    id,
    items: items.length > 0 ? items : input.items,
    subtotal,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: input.syncStatus ?? 'LOCAL_ONLY',
    ocr: input.ocr ? { ...input.ocr, receiptId: id } : undefined,
  };
};

const matchesQuery = (receipt: Receipt, rawQuery: string): boolean =>
  matchPurchaseQuery(receipt, { text: rawQuery.trim() || undefined });

export const receiptRepository = {
  async getAll(): Promise<Receipt[]> {
    await ensureReceiptStoreReady();
    const records = await localDataSource.getAllReceiptRecords();
    const mediaRecords = await localDataSource.getAllMediaRecords();
    const mediaByReceipt = new Map<string, StoredMedia[]>();
    for (const media of mediaRecords) {
      const list = mediaByReceipt.get(media.receiptId) ?? [];
      list.push(media);
      mediaByReceipt.set(media.receiptId, list);
    }
    return records.map((r) => hydrate(r, mediaByReceipt.get(r.id) ?? []));
  },

  async get(id: string): Promise<Receipt | null> {
    await ensureReceiptStoreReady();
    const record = await localDataSource.getReceiptRecord(id);
    if (!record) return null;
    const mediaRecords = await localDataSource.getMediaForReceipt(id);
    return hydrate(record, mediaRecords);
  },

  async searchReceipts(query: string): Promise<Receipt[]> {
    const all = await this.getAll();
    return all.filter((receipt) => matchesQuery(receipt, query));
  },

  async getReceiptsByCategory(category: string): Promise<Receipt[]> {
    const all = await this.getAll();
    return all.filter((receipt) => receipt.category === category);
  },

  async getReceiptsByDateRange(from: string, to: string): Promise<Receipt[]> {
    const all = await this.getAll();
    return all.filter((receipt) => receipt.date >= from && receipt.date <= to);
  },

  async getMonthlySummary(reference = new Date()): Promise<{ count: number; total: number }> {
    const year = reference.getFullYear();
    const month = reference.getMonth();
    const all = await this.getAll();
    const monthReceipts = all.filter((receipt) => {
      const date = new Date(receipt.date);
      return date.getFullYear() === year && date.getMonth() === month;
    });
    return {
      count: monthReceipts.length,
      total: monthReceipts.reduce((sum, receipt) => sum + receipt.amount, 0),
    };
  },

  async create(input: NewReceipt): Promise<Receipt> {
    await ensureReceiptStoreReady();
    const id = newId();
    const receipt = buildReceipt(input, id);
    // Receipt row first — SQLite media/items have a foreign key to it.
    await localDataSource.saveReceiptRecord(toStored(receipt));
    const pages = input.sourceMedia?.length ? input.sourceMedia : input.media ? [input.media] : [];
    for (const [index, media] of pages.entries()) {
      await localDataSource.saveMediaRecord({
        ...media,
        receiptId: id,
        pageIndex: media.pageIndex ?? index,
      });
    }
    return { ...receipt, media: pages[0], sourceMedia: pages.length > 0 ? pages : undefined };
  },

  async update(id: string, updates: Partial<Receipt>): Promise<Receipt | null> {
    await ensureReceiptStoreReady();
    const record = await localDataSource.getReceiptRecord(id);
    if (!record) return null;

    if (updates.sourceMedia) {
      const existingMedia = await localDataSource.getMediaForReceipt(id);
      const nextIds = new Set(updates.sourceMedia.map((item) => item.id));
      for (const media of existingMedia) {
        if (!nextIds.has(media.id)) {
          await localDataSource.deleteMediaRecord(media.id);
        }
      }
      for (const [index, media] of updates.sourceMedia.entries()) {
        await localDataSource.saveMediaRecord({
          ...media,
          receiptId: id,
          pageIndex: media.pageIndex ?? index,
        });
      }
    } else if (updates.media && updates.media.id !== record.mediaId) {
      if (record.mediaId) {
        await localDataSource.deleteMediaRecord(record.mediaId);
      }
      await localDataSource.saveMediaRecord({ ...updates.media, receiptId: id, pageIndex: 0 });
    }

    const { media, sourceMedia, ...rest } = updates;
    const merged: StoredReceipt = {
      ...record,
      ...rest,
      ...(media ? { mediaId: media.id } : {}),
      ...(sourceMedia?.[0] ? { mediaId: sourceMedia[0].id } : {}),
      id,
      updatedAt: new Date().toISOString(),
    };
    await localDataSource.saveReceiptRecord(merged);

    const mediaRecords = await localDataSource.getMediaForReceipt(id);
    return hydrate(merged, mediaRecords);
  },

  async remove(id: string): Promise<void> {
    await ensureReceiptStoreReady();
    await localDataSource.deleteReceiptRecord(String(id));
  },

  async clearAll(): Promise<void> {
    await ensureReceiptStoreReady();
    await localDataSource.clearReceiptRecords();
    await localDataSource.clearMediaRecords();
  },

  async getCategories(): Promise<Category[]> {
    await ensureReceiptStoreReady();
    const stored = await localDataSource.getAllCategories();
    const byName = new Map(stored.map((c) => [c.name, c]));
    for (const builtin of builtinCategories) {
      if (!byName.has(builtin.name)) byName.set(builtin.name, builtin);
    }
    return Array.from(byName.values());
  },

  async saveCategory(category: Category): Promise<void> {
    await ensureReceiptStoreReady();
    await localDataSource.saveCategory(category);
  },

  async deleteCategory(id: string): Promise<void> {
    await ensureReceiptStoreReady();
    await localDataSource.deleteCategory(id);
  },

  async getTags(): Promise<string[]> {
    await ensureReceiptStoreReady();
    return localDataSource.getAllTags();
  },
};
