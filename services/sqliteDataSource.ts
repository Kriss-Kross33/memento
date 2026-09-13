import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Currency } from '@/utils/currency';
import {
  Category,
  OCRMetadata,
  ReceiptItem,
  ReceiptMedia,
  SyncStatus,
} from '@/models/types';
import {
  LocalDataSource,
  StoredMedia,
  StoredReceipt,
} from '@/services/localDataSource';

type ReceiptRow = {
  id: string;
  merchant: string;
  date: string;
  time: string | null;
  currency: string;
  total: number;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  receipt_number: string | null;
  payment_method: string | null;
  category_id: string | null;
  category: string;
  notes: string | null;
  warranty_until: string | null;
  return_window_days: number | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
  remote_id: string | null;
  last_synced_at: string | null;
};

type ItemRow = {
  id: string;
  receipt_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number | null;
};

type MediaRow = {
  id: string;
  receipt_id: string;
  type: string;
  local_path: string;
  thumbnail_path: string | null;
  status: string;
  source: string | null;
  created_at: string;
  page_index?: number | null;
  width?: number | null;
  height?: number | null;
};

type TaxRow = {
  id: string;
  receipt_id: string;
  name: string;
  rate: number | null;
  amount: number;
  confidence: number | null;
  source: string | null;
};

type DiscountRow = {
  id: string;
  receipt_id: string;
  name: string;
  amount: number;
  confidence: number | null;
  source: string | null;
  kind: string | null;
};

type OriginRow = {
  id: string;
  receipt_id: string;
  field: string;
  original_value: string;
  source: string;
  corrected_at: string | null;
};

type OcrRow = {
  id: string;
  receipt_id: string;
  processing_status: string;
  merchant_confidence: number | null;
  date_confidence: number | null;
  total_confidence: number | null;
  currency_confidence: number | null;
  category_confidence: number | null;
  items_confidence: number | null;
  overall_confidence: number | null;
  processed_at: string | null;
  document_type?: string | null;
  document_type_confidence?: number | null;
  suggested_merchant?: string | null;
  suggested_category?: string | null;
  review_hints?: string | null;
};

type TagRow = { id: string; name: string };
type CategoryRow = { id: string; name: string; icon: string; color: string; is_builtin: number };

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY NOT NULL,
  merchant TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  time TEXT,
  currency TEXT NOT NULL,
  total REAL NOT NULL DEFAULT 0,
  subtotal REAL,
  tax REAL,
  discount REAL,
  receipt_number TEXT,
  payment_method TEXT,
  category_id TEXT,
  category TEXT NOT NULL DEFAULT 'Other',
  notes TEXT,
  warranty_until TEXT,
  return_window_days INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  remote_id TEXT,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id TEXT PRIMARY KEY NOT NULL,
  receipt_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  total REAL,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receipt_media (
  id TEXT PRIMARY KEY NOT NULL,
  receipt_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'image',
  local_path TEXT NOT NULL,
  thumbnail_path TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  source TEXT,
  created_at TEXT NOT NULL,
  page_index INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receipt_taxes (
  id TEXT PRIMARY KEY NOT NULL,
  receipt_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rate REAL,
  amount REAL NOT NULL,
  confidence REAL,
  source TEXT,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receipt_discounts (
  id TEXT PRIMARY KEY NOT NULL,
  receipt_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  confidence REAL,
  source TEXT,
  kind TEXT,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receipt_field_origins (
  id TEXT PRIMARY KEY NOT NULL,
  receipt_id TEXT NOT NULL,
  field TEXT NOT NULL,
  original_value TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  corrected_at TEXT,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ocr_metadata (
  id TEXT PRIMARY KEY NOT NULL,
  receipt_id TEXT NOT NULL UNIQUE,
  processing_status TEXT NOT NULL,
  merchant_confidence REAL,
  date_confidence REAL,
  total_confidence REAL,
  currency_confidence REAL,
  category_confidence REAL,
  items_confidence REAL,
  overall_confidence REAL,
  processed_at TEXT,
  document_type TEXT,
  document_type_confidence REAL,
  suggested_merchant TEXT,
  suggested_category TEXT,
  review_hints TEXT,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS warranties (
  id TEXT PRIMARY KEY NOT NULL,
  receipt_id TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  expiry_date TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS return_policies (
  id TEXT PRIMARY KEY NOT NULL,
  receipt_id TEXT NOT NULL,
  return_window_days INTEGER NOT NULL,
  expiry_date TEXT,
  notes TEXT,
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS receipt_tags (
  receipt_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (receipt_id, tag_id),
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON receipts(merchant);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_warranty_until ON receipts(warranty_until);
CREATE INDEX IF NOT EXISTS idx_receipts_return_window_days ON receipts(return_window_days);
CREATE INDEX IF NOT EXISTS idx_items_receipt ON receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_media_receipt ON receipt_media(receipt_id);
CREATE INDEX IF NOT EXISTS idx_media_page ON receipt_media(receipt_id, page_index);
`;

const optStr = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const optNum = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const parseReviewHints = (value: unknown): OCRMetadata['reviewHints'] => {
  if (typeof value !== 'string' || !value) return undefined;
  try {
    const parsed = JSON.parse(value) as OCRMetadata['reviewHints'];
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const itemFromRow = (row: ItemRow): ReceiptItem => ({
  id: row.id,
  label: row.name,
  quantity: row.quantity,
  unitPrice: row.unit_price,
  total: optNum(row.total) ?? row.quantity * row.unit_price,
});

const mediaFromRow = (row: MediaRow): StoredMedia => ({
  id: row.id,
  receiptId: row.receipt_id,
  uri: row.local_path,
  thumbnailUri: optStr(row.thumbnail_path),
  type: 'image',
  status: (row.status as ReceiptMedia['status']) ?? 'ready',
  addedAt: row.created_at,
  source:
    row.source === 'library' || row.source === 'file' || row.source === 'share' || row.source === 'pdf'
      ? row.source
      : 'camera',
  pageIndex: optNum(row.page_index) ?? 0,
  width: optNum(row.width),
  height: optNum(row.height),
});

const ocrFromRow = (row: OcrRow): OCRMetadata => ({
  id: row.id,
  receiptId: row.receipt_id,
  processingStatus: row.processing_status as OCRMetadata['processingStatus'],
  merchantConfidence: optNum(row.merchant_confidence),
  dateConfidence: optNum(row.date_confidence),
  totalConfidence: optNum(row.total_confidence),
  currencyConfidence: optNum(row.currency_confidence),
  categoryConfidence: optNum(row.category_confidence),
  itemsConfidence: optNum(row.items_confidence),
  overallConfidence: optNum(row.overall_confidence),
  processedAt: optStr(row.processed_at),
  documentType: optStr(row.document_type),
  documentTypeConfidence: optNum(row.document_type_confidence),
  suggestedMerchant: optStr(row.suggested_merchant),
  suggestedCategory: optStr(row.suggested_category),
  reviewHints: parseReviewHints(row.review_hints),
});

const receiptFromRow = (
  row: ReceiptRow,
  extras: { items?: ReceiptItem[]; tags?: string[]; ocr?: OCRMetadata }
): StoredReceipt => ({
  id: row.id,
  merchant: row.merchant,
  date: row.date,
  time: optStr(row.time),
  amount: row.total,
  subtotal: optNum(row.subtotal),
  tax: optNum(row.tax),
  discount: optNum(row.discount),
  currency: row.currency as Currency,
  category: row.category,
  categoryId: optStr(row.category_id),
  notes: optStr(row.notes),
  receiptNumber: optStr(row.receipt_number),
  paymentMethod: optStr(row.payment_method),
  warrantyUntil: optStr(row.warranty_until),
  returnWindowDays: optNum(row.return_window_days),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  syncStatus: (row.sync_status as SyncStatus) ?? 'LOCAL_ONLY',
  remoteId: row.remote_id,
  lastSyncedAt: optStr(row.last_synced_at),
  items: extras.items,
  tags: extras.tags,
  ocr: extras.ocr,
});

export class SqliteDataSource implements LocalDataSource {
  private queue: Promise<void> = Promise.resolve();

  private constructor(private db: SQLiteDatabase) {}

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private bind(params?: unknown[]): (string | number | null | Uint8Array)[] {
    return (params ?? []).map((value) => {
      if (value === undefined || value === null) return null;
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      if (typeof value === 'string') return value;
      if (value instanceof Uint8Array) return value;
      return String(value);
    });
  }

  private runAsync(sql: string, params?: unknown[]) {
    return this.enqueue(() => this.db.runAsync(sql, this.bind(params)));
  }

  private getAllAsync<T>(sql: string, params?: unknown[]) {
    return this.enqueue(() => this.db.getAllAsync<T>(sql, this.bind(params)));
  }

  private getFirstAsync<T>(sql: string, params?: unknown[]) {
    return this.enqueue(() => this.db.getFirstAsync<T>(sql, this.bind(params)));
  }

  static async open(): Promise<SqliteDataSource> {
    const SQLite = await import('expo-sqlite');
    const db = await SQLite.openDatabaseAsync('receiptsnap.db'); // historical filename — do not rename
    await db.execAsync(SCHEMA);
    await db.execAsync('PRAGMA foreign_keys = ON;');
    for (const column of ['category_confidence', 'items_confidence', 'overall_confidence', 'document_type_confidence']) {
      try {
        await db.execAsync(`ALTER TABLE ocr_metadata ADD COLUMN ${column} REAL`);
      } catch {
        // Column already exists on upgraded databases.
      }
    }
    for (const column of ['document_type', 'suggested_merchant', 'suggested_category', 'review_hints']) {
      try {
        await db.execAsync(`ALTER TABLE ocr_metadata ADD COLUMN ${column} TEXT`);
      } catch {
        // Column already exists on upgraded databases.
      }
    }
    for (const column of ['page_index INTEGER', 'width INTEGER', 'height INTEGER']) {
      try {
        await db.execAsync(`ALTER TABLE receipt_media ADD COLUMN ${column}`);
      } catch {
        // Column already exists on upgraded databases.
      }
    }
    for (const column of ['duration TEXT', 'provider TEXT', 'terms TEXT', 'source TEXT']) {
      try {
        await db.execAsync(`ALTER TABLE warranties ADD COLUMN ${column}`);
      } catch {
        // Column already exists on upgraded databases.
      }
    }
    try {
      await db.execAsync('ALTER TABLE warranties ADD COLUMN confidence REAL');
    } catch {
      // Column already exists on upgraded databases.
    }
    for (const column of ['start_date TEXT', 'deadline TEXT', 'policy_text TEXT', 'source TEXT']) {
      try {
        await db.execAsync(`ALTER TABLE return_policies ADD COLUMN ${column}`);
      } catch {
        // Column already exists on upgraded databases.
      }
    }
    try {
      await db.execAsync('ALTER TABLE return_policies ADD COLUMN confidence REAL');
    } catch {
      // Column already exists on upgraded databases.
    }
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS receipt_taxes (
        id TEXT PRIMARY KEY NOT NULL,
        receipt_id TEXT NOT NULL,
        name TEXT NOT NULL,
        rate REAL,
        amount REAL NOT NULL,
        confidence REAL,
        source TEXT,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS receipt_discounts (
        id TEXT PRIMARY KEY NOT NULL,
        receipt_id TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        confidence REAL,
        source TEXT,
        kind TEXT,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS receipt_field_origins (
        id TEXT PRIMARY KEY NOT NULL,
        receipt_id TEXT NOT NULL,
        field TEXT NOT NULL,
        original_value TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL,
        corrected_at TEXT,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON receipts(receipt_number);
      CREATE INDEX IF NOT EXISTS idx_receipts_warranty_until ON receipts(warranty_until);
      CREATE INDEX IF NOT EXISTS idx_receipts_return_window_days ON receipts(return_window_days);
      CREATE INDEX IF NOT EXISTS idx_media_page ON receipt_media(receipt_id, page_index);
    `);
    return new SqliteDataSource(db);
  }

  private async hydrate(rows: ReceiptRow[]): Promise<StoredReceipt[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');

    const itemRows = await this.getAllAsync<ItemRow>(
      `SELECT * FROM receipt_items WHERE receipt_id IN (${placeholders})`,
      ids
    );
    const tagRows = await this.getAllAsync<{ receipt_id: string; name: string }>(
      `SELECT rt.receipt_id, t.name FROM receipt_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.receipt_id IN (${placeholders})`,
      ids
    );
    const ocrRows = await this.getAllAsync<OcrRow>(
      `SELECT * FROM ocr_metadata WHERE receipt_id IN (${placeholders})`,
      ids
    );
    const mediaRows = await this.getAllAsync<MediaRow>(
      `SELECT * FROM receipt_media WHERE receipt_id IN (${placeholders}) ORDER BY page_index ASC, created_at ASC`,
      ids
    );
    const taxRows = await this.getAllAsync<TaxRow>(
      `SELECT * FROM receipt_taxes WHERE receipt_id IN (${placeholders})`,
      ids
    );
    const discountRows = await this.getAllAsync<DiscountRow>(
      `SELECT * FROM receipt_discounts WHERE receipt_id IN (${placeholders})`,
      ids
    );
    const originRows = await this.getAllAsync<OriginRow>(
      `SELECT * FROM receipt_field_origins WHERE receipt_id IN (${placeholders})`,
      ids
    );

    const itemsByReceipt = new Map<string, ReceiptItem[]>();
    for (const row of itemRows) {
      const list = itemsByReceipt.get(row.receipt_id) ?? [];
      list.push(itemFromRow(row));
      itemsByReceipt.set(row.receipt_id, list);
    }
    const tagsByReceipt = new Map<string, string[]>();
    for (const row of tagRows) {
      const list = tagsByReceipt.get(row.receipt_id) ?? [];
      list.push(row.name);
      tagsByReceipt.set(row.receipt_id, list);
    }
    const ocrByReceipt = new Map(ocrRows.map((row) => [row.receipt_id, ocrFromRow(row)]));
    const mediaByReceipt = new Map<string, MediaRow[]>();
    for (const row of mediaRows) {
      const list = mediaByReceipt.get(row.receipt_id) ?? [];
      list.push(row);
      mediaByReceipt.set(row.receipt_id, list);
    }
    const taxesByReceipt = new Map<string, TaxRow[]>();
    for (const row of taxRows) {
      const list = taxesByReceipt.get(row.receipt_id) ?? [];
      list.push(row);
      taxesByReceipt.set(row.receipt_id, list);
    }
    const discountsByReceipt = new Map<string, DiscountRow[]>();
    for (const row of discountRows) {
      const list = discountsByReceipt.get(row.receipt_id) ?? [];
      list.push(row);
      discountsByReceipt.set(row.receipt_id, list);
    }
    const originsByReceipt = new Map<string, OriginRow[]>();
    for (const row of originRows) {
      const list = originsByReceipt.get(row.receipt_id) ?? [];
      list.push(row);
      originsByReceipt.set(row.receipt_id, list);
    }

    return rows.map((row) => {
      const mediaList = mediaByReceipt.get(row.id) ?? [];
      return {
        ...receiptFromRow(row, {
          items: itemsByReceipt.get(row.id),
          tags: tagsByReceipt.get(row.id),
          ocr: ocrByReceipt.get(row.id),
        }),
        mediaId: mediaList[0]?.id,
        taxes: taxesByReceipt.get(row.id)?.map((tax) => ({
          name: tax.name,
          rate: optNum(tax.rate),
          amount: tax.amount,
          confidence: optNum(tax.confidence) ?? 0.7,
          source: tax.source ?? 'stored',
        })),
        discounts: discountsByReceipt.get(row.id)?.map((discount) => ({
          name: discount.name,
          amount: discount.amount,
          confidence: optNum(discount.confidence) ?? 0.7,
          source: discount.source ?? 'stored',
          kind: (['discount', 'coupon', 'promotion', 'loyalty', 'store_credit'].includes(discount.kind ?? '')
            ? discount.kind
            : 'discount') as NonNullable<StoredReceipt['discounts']>[number]['kind'],
        })),
        fieldOrigins: originsByReceipt.get(row.id)?.map((origin) => ({
          field: origin.field,
          originalValue: origin.original_value,
          source: origin.source === 'user' ? ('user' as const) : ('ocr' as const),
          correctedAt: optStr(origin.corrected_at),
        })),
      };
    });
  }

  async getReceiptRecord(id: string): Promise<StoredReceipt | null> {
    const row = await this.getFirstAsync<ReceiptRow>('SELECT * FROM receipts WHERE id = ?', [id]);
    if (!row) return null;
    const [hydrated] = await this.hydrate([row]);
    return hydrated ?? null;
  }

  async getAllReceiptRecords(): Promise<StoredReceipt[]> {
    const rows = await this.getAllAsync<ReceiptRow>(
      'SELECT * FROM receipts ORDER BY created_at DESC'
    );
    return this.hydrate(rows);
  }

  async saveReceiptRecord(record: StoredReceipt): Promise<void> {
    await this.runAsync(
        `INSERT INTO receipts (
          id, merchant, date, time, currency, total, subtotal, tax, discount,
          receipt_number, payment_method, category_id, category, notes,
          warranty_until, return_window_days, created_at, updated_at,
          sync_status, remote_id, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          merchant = excluded.merchant,
          date = excluded.date,
          time = excluded.time,
          currency = excluded.currency,
          total = excluded.total,
          subtotal = excluded.subtotal,
          tax = excluded.tax,
          discount = excluded.discount,
          receipt_number = excluded.receipt_number,
          payment_method = excluded.payment_method,
          category_id = excluded.category_id,
          category = excluded.category,
          notes = excluded.notes,
          warranty_until = excluded.warranty_until,
          return_window_days = excluded.return_window_days,
          updated_at = excluded.updated_at,
          sync_status = excluded.sync_status,
          remote_id = excluded.remote_id,
          last_synced_at = excluded.last_synced_at`,
        [
          record.id,
          record.merchant,
          record.date,
          record.time ?? null,
          record.currency,
          record.amount,
          record.subtotal ?? null,
          record.tax ?? null,
          record.discount ?? null,
          record.receiptNumber ?? null,
          record.paymentMethod ?? null,
          record.categoryId ?? null,
          record.category,
          record.notes ?? null,
          record.warrantyUntil ?? null,
          record.returnWindowDays ?? null,
          record.createdAt,
          record.updatedAt,
          record.syncStatus ?? 'LOCAL_ONLY',
          record.remoteId ?? null,
          record.lastSyncedAt ?? null,
        ]
      );

      await this.runAsync('DELETE FROM receipt_items WHERE receipt_id = ?', [record.id]);
      for (const [index, item] of (record.items ?? []).entries()) {
        const total = item.total ?? item.quantity * item.unitPrice;
        await this.runAsync(
          `INSERT INTO receipt_items (id, receipt_id, name, quantity, unit_price, total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [item.id || `${record.id}_item_${index}`, record.id, item.label, item.quantity, item.unitPrice, total]
        );
      }

      await this.runAsync('DELETE FROM receipt_tags WHERE receipt_id = ?', [record.id]);
      for (const name of record.tags ?? []) {
        const tagName = name.trim().replace(/^#/, '');
        if (!tagName) continue;
        const existing = await this.getFirstAsync<TagRow>(
          'SELECT * FROM tags WHERE lower(name) = lower(?)',
          [tagName]
        );
        const tagId = existing?.id ?? `tag_${tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        if (!existing) {
          await this.runAsync('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)', [
            tagId,
            tagName,
          ]);
        }
        await this.runAsync(
          'INSERT OR IGNORE INTO receipt_tags (receipt_id, tag_id) VALUES (?, ?)',
          [record.id, existing?.id ?? tagId]
        );
      }

      await this.runAsync('DELETE FROM ocr_metadata WHERE receipt_id = ?', [record.id]);
      if (record.ocr) {
        await this.runAsync(
          `INSERT INTO ocr_metadata (
            id, receipt_id, processing_status, merchant_confidence, date_confidence,
            total_confidence, currency_confidence, category_confidence, items_confidence,
            overall_confidence, processed_at, document_type, document_type_confidence,
            suggested_merchant, suggested_category, review_hints
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.ocr.id || `ocr_${record.id}`,
            record.id,
            record.ocr.processingStatus,
            record.ocr.merchantConfidence ?? null,
            record.ocr.dateConfidence ?? null,
            record.ocr.totalConfidence ?? null,
            record.ocr.currencyConfidence ?? null,
            record.ocr.categoryConfidence ?? null,
            record.ocr.itemsConfidence ?? null,
            record.ocr.overallConfidence ?? null,
            record.ocr.processedAt ?? null,
            record.ocr.documentType ?? null,
            record.ocr.documentTypeConfidence ?? null,
            record.ocr.suggestedMerchant ?? null,
            record.ocr.suggestedCategory ?? null,
            record.ocr.reviewHints ? JSON.stringify(record.ocr.reviewHints) : null,
          ]
        );
      }

      await this.runAsync('DELETE FROM warranties WHERE receipt_id = ?', [record.id]);
      if (record.warrantyUntil) {
        await this.runAsync(
          `INSERT INTO warranties (id, receipt_id, product_name, start_date, expiry_date)
           VALUES (?, ?, ?, ?, ?)`,
          [`war_${record.id}`, record.id, record.merchant, record.date, record.warrantyUntil]
        );
      }

      await this.runAsync('DELETE FROM return_policies WHERE receipt_id = ?', [record.id]);
      if (record.returnWindowDays) {
        const expiry = new Date(record.date);
        expiry.setDate(expiry.getDate() + record.returnWindowDays);
        await this.runAsync(
          `INSERT INTO return_policies (id, receipt_id, return_window_days, expiry_date, start_date, deadline)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            `ret_${record.id}`,
            record.id,
            record.returnWindowDays,
            expiry.toISOString().split('T')[0],
            record.date,
            expiry.toISOString().split('T')[0],
          ]
        );
      }

      await this.runAsync('DELETE FROM receipt_taxes WHERE receipt_id = ?', [record.id]);
      for (const [index, tax] of (record.taxes ?? []).entries()) {
        await this.runAsync(
          `INSERT INTO receipt_taxes (id, receipt_id, name, rate, amount, confidence, source)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            `${record.id}_tax_${index}`,
            record.id,
            tax.name,
            tax.rate ?? null,
            tax.amount,
            tax.confidence ?? null,
            tax.source ?? null,
          ]
        );
      }

      await this.runAsync('DELETE FROM receipt_discounts WHERE receipt_id = ?', [record.id]);
      for (const [index, discount] of (record.discounts ?? []).entries()) {
        await this.runAsync(
          `INSERT INTO receipt_discounts (id, receipt_id, name, amount, confidence, source, kind)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            `${record.id}_disc_${index}`,
            record.id,
            discount.name,
            discount.amount,
            discount.confidence ?? null,
            discount.source ?? null,
            discount.kind,
          ]
        );
      }

      await this.runAsync('DELETE FROM receipt_field_origins WHERE receipt_id = ?', [record.id]);
      for (const origin of record.fieldOrigins ?? []) {
        await this.runAsync(
          `INSERT INTO receipt_field_origins (id, receipt_id, field, original_value, source, corrected_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            `${record.id}_origin_${origin.field}`,
            record.id,
            origin.field,
            origin.originalValue,
            origin.source,
            origin.correctedAt ?? null,
          ]
        );
      }
  }

  async deleteReceiptRecord(id: string): Promise<void> {
    const receiptId = String(id);
    // Delete children first. CASCADE on Android/expo-sqlite can NPE inside prepareAsync.
    await this.runAsync('DELETE FROM receipt_tags WHERE receipt_id = ?', [receiptId]);
    await this.runAsync('DELETE FROM receipt_items WHERE receipt_id = ?', [receiptId]);
    await this.runAsync('DELETE FROM ocr_metadata WHERE receipt_id = ?', [receiptId]);
    await this.runAsync('DELETE FROM warranties WHERE receipt_id = ?', [receiptId]);
    await this.runAsync('DELETE FROM return_policies WHERE receipt_id = ?', [receiptId]);
    await this.runAsync('DELETE FROM receipt_taxes WHERE receipt_id = ?', [receiptId]);
    await this.runAsync('DELETE FROM receipt_discounts WHERE receipt_id = ?', [receiptId]);
    await this.runAsync('DELETE FROM receipt_field_origins WHERE receipt_id = ?', [receiptId]);
    await this.runAsync('DELETE FROM receipt_media WHERE receipt_id = ?', [receiptId]);
    await this.runAsync('DELETE FROM receipts WHERE id = ?', [receiptId]);
  }

  async clearReceiptRecords(): Promise<void> {
    await this.runAsync('DELETE FROM receipt_tags');
    await this.runAsync('DELETE FROM receipt_items');
    await this.runAsync('DELETE FROM ocr_metadata');
    await this.runAsync('DELETE FROM warranties');
    await this.runAsync('DELETE FROM return_policies');
    await this.runAsync('DELETE FROM receipt_taxes');
    await this.runAsync('DELETE FROM receipt_discounts');
    await this.runAsync('DELETE FROM receipt_field_origins');
    await this.runAsync('DELETE FROM receipts');
  }

  async getMediaRecord(id: string): Promise<StoredMedia | null> {
    const row = await this.getFirstAsync<MediaRow>(
      'SELECT * FROM receipt_media WHERE id = ?',
      [id]
    );
    return row ? mediaFromRow(row) : null;
  }

  async getMediaForReceipt(receiptId: string): Promise<StoredMedia[]> {
    const rows = await this.getAllAsync<MediaRow>(
      'SELECT * FROM receipt_media WHERE receipt_id = ? ORDER BY page_index ASC, created_at ASC',
      [receiptId]
    );
    return rows.map(mediaFromRow);
  }

  async getAllMediaRecords(): Promise<StoredMedia[]> {
    const rows = await this.getAllAsync<MediaRow>('SELECT * FROM receipt_media');
    return rows.map(mediaFromRow);
  }

  async saveMediaRecord(record: StoredMedia): Promise<void> {
    await this.runAsync(
      `INSERT INTO receipt_media (
        id, receipt_id, type, local_path, thumbnail_path, status, source, created_at, page_index, width, height
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        receipt_id = excluded.receipt_id,
        local_path = excluded.local_path,
        thumbnail_path = excluded.thumbnail_path,
        status = excluded.status,
        source = excluded.source,
        page_index = excluded.page_index,
        width = excluded.width,
        height = excluded.height`,
      [
        record.id,
        record.receiptId,
        record.type ?? 'image',
        record.uri,
        record.thumbnailUri ?? null,
        record.status ?? 'ready',
        record.source,
        record.addedAt,
        record.pageIndex ?? 0,
        record.width ?? null,
        record.height ?? null,
      ]
    );
  }

  async deleteMediaRecord(id: string): Promise<void> {
    await this.runAsync('DELETE FROM receipt_media WHERE id = ?', [id]);
  }

  async clearMediaRecords(): Promise<void> {
    await this.runAsync('DELETE FROM receipt_media');
  }

  async getAllCategories(): Promise<Category[]> {
    const rows = await this.getAllAsync<CategoryRow>(
      'SELECT * FROM categories ORDER BY is_builtin DESC, name ASC'
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      builtin: row.is_builtin === 1,
    }));
  }

  async saveCategory(category: Category): Promise<void> {
    await this.runAsync(
      `INSERT INTO categories (id, name, icon, color, is_builtin)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon, color = excluded.color`,
      [category.id, category.name, category.icon, category.color, category.builtin ? 1 : 0]
    );
  }

  async deleteCategory(id: string): Promise<void> {
    await this.runAsync('DELETE FROM categories WHERE id = ? AND is_builtin = 0', [id]);
  }

  async getAllTags(): Promise<string[]> {
    const rows = await this.getAllAsync<TagRow>('SELECT name FROM tags ORDER BY name ASC');
    return rows.map((row) => row.name);
  }
}

export async function tryOpenSqliteDataSource(): Promise<SqliteDataSource | null> {
  if (Platform.OS === 'web') {
    // Web SQLite is optional; AsyncStorage remains a valid local store there.
    try {
      return await SqliteDataSource.open();
    } catch (error) {
      console.warn('[sqlite] web database unavailable, using AsyncStorage', error);
      return null;
    }
  }
  try {
    return await SqliteDataSource.open();
  } catch (error) {
    console.warn('[sqlite] failed to open database', error);
    return null;
  }
}
