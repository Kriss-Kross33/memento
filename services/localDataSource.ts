import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category, Receipt, ReceiptMedia } from '@/models/types';

/**
 * Local data source abstraction.
 *
 * UI and repositories never talk to SQLite or AsyncStorage directly.
 * Native builds use SQLite; web (and SQLite failure) fall back to
 * per-record AsyncStorage documents.
 */

/** Persisted receipt document. Media is normalized into its own record. */
export interface StoredReceipt extends Omit<Receipt, 'media'> {
  mediaId?: string;
}

/** Persisted media record. `uri` is always a Memento-managed path. */
export interface StoredMedia extends ReceiptMedia {
  receiptId: string;
}

export interface LocalDataSource {
  getReceiptRecord(id: string): Promise<StoredReceipt | null>;
  getAllReceiptRecords(): Promise<StoredReceipt[]>;
  saveReceiptRecord(record: StoredReceipt): Promise<void>;
  deleteReceiptRecord(id: string): Promise<void>;
  clearReceiptRecords(): Promise<void>;

  getMediaRecord(id: string): Promise<StoredMedia | null>;
  getMediaForReceipt(receiptId: string): Promise<StoredMedia[]>;
  getAllMediaRecords(): Promise<StoredMedia[]>;
  saveMediaRecord(record: StoredMedia): Promise<void>;
  deleteMediaRecord(id: string): Promise<void>;
  clearMediaRecords(): Promise<void>;

  getAllCategories(): Promise<Category[]>;
  saveCategory(category: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  getAllTags(): Promise<string[]>;
}

/** Historical AsyncStorage prefixes — do not rename or existing installs lose data. */
const receiptKey = (id: string) => `receiptsnap_receipt_${id}`;
const mediaKey = (id: string) => `receiptsnap_media_${id}`;
const RECEIPT_INDEX_KEY = 'receiptsnap_receipt_index';
const MEDIA_INDEX_KEY = 'receiptsnap_media_index';
const CUSTOM_CATEGORIES_KEY = 'receiptsnap_custom_categories';

const parseJson = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    console.warn('[localDataSource] failed to read', key, error);
    return null;
  }
};

const readIndex = async (key: string): Promise<string[]> => {
  const ids = await parseJson<string[]>(key);
  return Array.isArray(ids) ? ids : [];
};

const writeIndex = async (key: string, ids: string[]): Promise<void> => {
  await AsyncStorage.setItem(key, JSON.stringify(ids));
};

/**
 * Per-record AsyncStorage implementation. Used on web and as a fallback
 * if SQLite cannot open.
 */
export class AsyncStorageReceiptDataSource implements LocalDataSource {
  async getReceiptRecord(id: string): Promise<StoredReceipt | null> {
    return parseJson<StoredReceipt>(receiptKey(id));
  }

  async getAllReceiptRecords(): Promise<StoredReceipt[]> {
    const ids = await readIndex(RECEIPT_INDEX_KEY);
    const records = await Promise.all(ids.map((id) => this.getReceiptRecord(id)));
    return records.filter((r): r is StoredReceipt => r !== null);
  }

  async saveReceiptRecord(record: StoredReceipt): Promise<void> {
    const ids = await readIndex(RECEIPT_INDEX_KEY);
    await AsyncStorage.setItem(receiptKey(record.id), JSON.stringify(record));
    if (!ids.includes(record.id)) {
      await writeIndex(RECEIPT_INDEX_KEY, [record.id, ...ids]);
    }
  }

  async deleteReceiptRecord(id: string): Promise<void> {
    const ids = await readIndex(RECEIPT_INDEX_KEY);
    await AsyncStorage.removeItem(receiptKey(id));
    if (ids.includes(id)) {
      await writeIndex(RECEIPT_INDEX_KEY, ids.filter((x) => x !== id));
    }
  }

  async clearReceiptRecords(): Promise<void> {
    const ids = await readIndex(RECEIPT_INDEX_KEY);
    await Promise.all(ids.map((id) => AsyncStorage.removeItem(receiptKey(id))));
    await AsyncStorage.removeItem(RECEIPT_INDEX_KEY);
  }

  async getMediaRecord(id: string): Promise<StoredMedia | null> {
    return parseJson<StoredMedia>(mediaKey(id));
  }

  async getMediaForReceipt(receiptId: string): Promise<StoredMedia[]> {
    const all = await this.getAllMediaRecords();
    return all.filter((m) => m.receiptId === receiptId);
  }

  async getAllMediaRecords(): Promise<StoredMedia[]> {
    const ids = await readIndex(MEDIA_INDEX_KEY);
    const records = await Promise.all(ids.map((id) => parseJson<StoredMedia>(mediaKey(id))));
    return records.filter((m): m is StoredMedia => m !== null);
  }

  async saveMediaRecord(record: StoredMedia): Promise<void> {
    const ids = await readIndex(MEDIA_INDEX_KEY);
    await AsyncStorage.setItem(mediaKey(record.id), JSON.stringify(record));
    if (!ids.includes(record.id)) {
      await writeIndex(MEDIA_INDEX_KEY, [...ids, record.id]);
    }
  }

  async deleteMediaRecord(id: string): Promise<void> {
    const ids = await readIndex(MEDIA_INDEX_KEY);
    await AsyncStorage.removeItem(mediaKey(id));
    if (ids.includes(id)) {
      await writeIndex(MEDIA_INDEX_KEY, ids.filter((x) => x !== id));
    }
  }

  async clearMediaRecords(): Promise<void> {
    const ids = await readIndex(MEDIA_INDEX_KEY);
    await Promise.all(ids.map((id) => AsyncStorage.removeItem(mediaKey(id))));
    await AsyncStorage.removeItem(MEDIA_INDEX_KEY);
  }

  async getAllCategories(): Promise<Category[]> {
    const stored = await parseJson<Category[]>(CUSTOM_CATEGORIES_KEY);
    return Array.isArray(stored) ? stored : [];
  }

  async saveCategory(category: Category): Promise<void> {
    const current = await this.getAllCategories();
    const next = current.some((c) => c.id === category.id)
      ? current.map((c) => (c.id === category.id ? category : c))
      : [...current, category];
    await AsyncStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(next));
  }

  async deleteCategory(id: string): Promise<void> {
    const current = await this.getAllCategories();
    await AsyncStorage.setItem(
      CUSTOM_CATEGORIES_KEY,
      JSON.stringify(current.filter((c) => c.id !== id))
    );
  }

  async getAllTags(): Promise<string[]> {
    const receipts = await this.getAllReceiptRecords();
    const names = new Set<string>();
    for (const receipt of receipts) {
      for (const tag of receipt.tags ?? []) {
        if (tag.trim()) names.add(tag.trim());
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }
}

class SwitchingDataSource implements LocalDataSource {
  inner: LocalDataSource = new AsyncStorageReceiptDataSource();

  getReceiptRecord(id: string) {
    return this.inner.getReceiptRecord(id);
  }
  getAllReceiptRecords() {
    return this.inner.getAllReceiptRecords();
  }
  saveReceiptRecord(record: StoredReceipt) {
    return this.inner.saveReceiptRecord(record);
  }
  deleteReceiptRecord(id: string) {
    return this.inner.deleteReceiptRecord(id);
  }
  clearReceiptRecords() {
    return this.inner.clearReceiptRecords();
  }
  getMediaRecord(id: string) {
    return this.inner.getMediaRecord(id);
  }
  getMediaForReceipt(receiptId: string) {
    return this.inner.getMediaForReceipt(receiptId);
  }
  getAllMediaRecords() {
    return this.inner.getAllMediaRecords();
  }
  saveMediaRecord(record: StoredMedia) {
    return this.inner.saveMediaRecord(record);
  }
  deleteMediaRecord(id: string) {
    return this.inner.deleteMediaRecord(id);
  }
  clearMediaRecords() {
    return this.inner.clearMediaRecords();
  }
  getAllCategories() {
    return this.inner.getAllCategories();
  }
  saveCategory(category: Category) {
    return this.inner.saveCategory(category);
  }
  deleteCategory(id: string) {
    return this.inner.deleteCategory(id);
  }
  getAllTags() {
    return this.inner.getAllTags();
  }
}

const asyncStorageSource = new AsyncStorageReceiptDataSource();

/** Singleton source used by repositories. */
export const localDataSource: SwitchingDataSource = new SwitchingDataSource();

export const getAsyncStorageDataSource = (): AsyncStorageReceiptDataSource => asyncStorageSource;
