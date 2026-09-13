import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Receipt, ReceiptMedia, Category } from '@/models/types';
import { DEFAULT_CURRENCY, isCurrency, Currency } from '@/utils/currency';
import { receiptRepository } from '@/services/receiptRepository';
import { mediaRepository } from '@/services/mediaRepository';
import {
  importReceiptImage,
  deleteReceiptMedia,
  deleteAllReceiptMedia,
} from '@/services/receiptMedia';
import { builtinCategories, buildCustomCategory } from '@/services/categoryRepository';
import { previousMonth, receiptsInMonth, totalsByCurrency } from '@/utils/insights';

/**
 * ReceiptsProvider — the application layer above the repositories.
 *
 * Persistence lives entirely behind receiptRepository/mediaRepository
 * (per-record local store, SQLite-ready). Small settings remain in
 * AsyncStorage on purpose: they are a handful of key/values, not a
 * growing document store.
 */

/** Historical key — do not rename or existing installs lose settings. */
const SETTINGS_KEY = 'receiptsnap_settings';

interface Settings {
  defaultCurrency: Currency;
  hasOnboarded: boolean;
}

const DEFAULT_SETTINGS: Settings = { defaultCurrency: DEFAULT_CURRENCY, hasOnboarded: false };

export interface MediaSourceInput {
  uri: string;
  source: ReceiptMedia['source'];
  pageIndex?: number;
}

export const [ReceiptsProvider, useReceipts] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<Category[]>(builtinCategories);
  const [tags, setTags] = useState<string[]>([]);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<Settings> => {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!stored) return DEFAULT_SETTINGS;
      try {
        const parsed = JSON.parse(stored) as Partial<Settings>;
        return {
          defaultCurrency: isCurrency(parsed.defaultCurrency)
            ? parsed.defaultCurrency
            : DEFAULT_CURRENCY,
          // Settings stored before onboarding shipped means an existing user —
          // they should never see the introduction again.
          hasOnboarded:
            typeof parsed.hasOnboarded === 'boolean' ? parsed.hasOnboarded : true,
        };
      } catch {
        return DEFAULT_SETTINGS;
      }
    },
  });

  const receiptsQuery = useQuery({
    queryKey: ['receipts'],
    queryFn: (): Promise<Receipt[]> => receiptRepository.getAll(),
  });

  useEffect(() => {
    if (receiptsQuery.data) {
      setReceipts(receiptsQuery.data);
      void receiptRepository.getCategories().then(setCategories);
      void receiptRepository.getTags().then(setTags);
    }
  }, [receiptsQuery.data]);

  /** Re-reads the local store into state after a repository mutation. */
  const refresh = useCallback(async () => {
    const fresh = await receiptRepository.getAll();
    const nextCategories = await receiptRepository.getCategories();
    const nextTags = await receiptRepository.getTags();
    setReceipts(fresh);
    setCategories(nextCategories);
    setTags(nextTags);
    queryClient.invalidateQueries({ queryKey: ['receipts'] });
  }, [queryClient]);

  const settingsMutation = useMutation({
    mutationFn: async (next: Settings) => {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  /**
   * Creates a receipt. When `mediaSource` is given, the image is copied into
   * Memento's managed storage before the record is saved.
   */
  const addReceipt = useCallback(
    async (
      receipt: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>,
      mediaSource?: MediaSourceInput
    ): Promise<string> => {
      let media = receipt.media;
      if (!media && mediaSource) {
        try {
          // Copy into app storage first so a scanner cache URI cannot expire
          // before the receipt row is written.
          media = await importReceiptImage(mediaSource.uri, mediaSource.source, {
            pageIndex: mediaSource.pageIndex,
          });
        } catch (error) {
          console.warn('[receipts] managed image import failed', error);
          media = undefined;
        }
      }

      const created = await receiptRepository.create({ ...receipt, media });
      void import('@/services/reminders').then(({ syncReceiptReminders }) =>
        syncReceiptReminders(created)
      );
      await refresh();
      return created.id;
    },
    [refresh]
  );

  const updateReceipt = useCallback(
    async (id: string, updates: Partial<Receipt>) => {
      const updated = await receiptRepository.update(id, updates);
      if (updated) {
        void import('@/services/reminders').then(({ syncReceiptReminders }) =>
          syncReceiptReminders(updated)
        );
      }
      await refresh();
    },
    [refresh]
  );

  /** Replaces (or adds) a receipt page with a fresh managed copy. */
  const attachMedia = useCallback(
    async (id: string, mediaSource: MediaSourceInput): Promise<void> => {
      const existing = await receiptRepository.get(id);
      const pageIndex = mediaSource.pageIndex ?? 0;
      const previous =
        existing?.sourceMedia?.find((item) => (item.pageIndex ?? 0) === pageIndex) ?? existing?.media;
      try {
        await mediaRepository.replaceMedia(
          id,
          previous,
          mediaSource.uri,
          mediaSource.source,
          pageIndex
        );
        await refresh();
      } catch (error) {
        console.warn('[receipts] managed image import failed', error);
        throw error;
      }
    },
    [refresh]
  );

  const addReceiptPage = useCallback(
    async (id: string, mediaSource: MediaSourceInput): Promise<void> => {
      const existing = await receiptRepository.get(id);
      const nextIndex = existing?.sourceMedia?.length ?? (existing?.media ? 1 : 0);
      await mediaRepository.saveMedia(id, mediaSource.uri, mediaSource.source, mediaSource.pageIndex ?? nextIndex);
      await refresh();
    },
    [refresh]
  );

  const removeReceiptPage = useCallback(
    async (id: string, mediaId: string): Promise<void> => {
      const existing = await receiptRepository.get(id);
      const page = existing?.sourceMedia?.find((item) => item.id === mediaId) ?? existing?.media;
      if (page?.id === mediaId || page) {
        await mediaRepository.deleteMedia(page);
      }
      await refresh();
    },
    [refresh]
  );

  /** Deletes the receipt record together with its managed media files. */
  const deleteReceipt = useCallback(
    async (id: string) => {
      const receiptId = Array.isArray(id) ? id[0] : id;
      const existing = await receiptRepository.get(receiptId);
      const pages = existing?.sourceMedia?.length
        ? existing.sourceMedia
        : existing?.media
          ? [existing.media]
          : [];
      for (const media of pages) {
        // File removal only — the user's original photos are never touched.
        await deleteReceiptMedia(media);
      }
      await receiptRepository.remove(receiptId);
      await refresh();
    },
    [refresh]
  );

  /** Removes every receipt, media record, and managed media file. */
  const clearAll = useCallback(async () => {
    await deleteAllReceiptMedia();
    await receiptRepository.clearAll();
    await refresh();
  }, [refresh]);

  const addCustomCategory = useCallback(
    async (name: string): Promise<Category> => {
      const category = buildCustomCategory(name);
      await receiptRepository.saveCategory(category);
      await refresh();
      return category;
    },
    [refresh]
  );

  const removeCustomCategory = useCallback(
    async (id: string) => {
      await receiptRepository.deleteCategory(id);
      await refresh();
    },
    [refresh]
  );

  const getReceipt = useCallback(
    (id: string) => {
      return receipts.find((r) => r.id === id);
    },
    [receipts]
  );

  const setDefaultCurrency = useCallback(
    (currency: Currency) => {
      settingsMutation.mutate({
        ...DEFAULT_SETTINGS,
        defaultCurrency: currency,
        hasOnboarded: settingsQuery.data?.hasOnboarded ?? false,
      });
    },
    [settingsMutation, settingsQuery.data?.hasOnboarded]
  );

  /** Marks the onboarding introduction as seen so the app opens straight into Home. */
  const completeOnboarding = useCallback(() => {
    settingsMutation.mutate({
      ...DEFAULT_SETTINGS,
      defaultCurrency: settingsQuery.data?.defaultCurrency ?? DEFAULT_CURRENCY,
      hasOnboarded: true,
    });
  }, [settingsMutation, settingsQuery.data]);

  const defaultCurrency = settingsQuery.data?.defaultCurrency ?? DEFAULT_CURRENCY;

  const monthlyTotals = useMemo(
    () => totalsByCurrency(receiptsInMonth(receipts)),
    [receipts]
  );

  const lastMonthTotals = useMemo(
    () => totalsByCurrency(receiptsInMonth(receipts, previousMonth())),
    [receipts]
  );

  /** Default-currency month total only — never mix dollars into cedis. */
  const monthlyTotal = useMemo(
    () => monthlyTotals.find((entry) => entry.currency === defaultCurrency)?.total ?? 0,
    [monthlyTotals, defaultCurrency]
  );

  const lastMonthTotal = useMemo(
    () => lastMonthTotals.find((entry) => entry.currency === defaultCurrency)?.total ?? 0,
    [lastMonthTotals, defaultCurrency]
  );

  const percentChange = useMemo(() => {
    if (lastMonthTotal === 0) return 0;
    return ((monthlyTotal - lastMonthTotal) / lastMonthTotal) * 100;
  }, [monthlyTotal, lastMonthTotal]);

  return {
    receipts,
    isLoading: receiptsQuery.isLoading,
    addReceipt,
    updateReceipt,
    deleteReceipt,
    attachMedia,
    addReceiptPage,
    removeReceiptPage,
    clearAll,
    getReceipt,
    categories,
    tags,
    addCustomCategory,
    removeCustomCategory,
    monthlyTotal,
    lastMonthTotal,
    monthlyTotals,
    lastMonthTotals,
    percentChange,
    defaultCurrency,
    setDefaultCurrency,
    hasOnboarded: settingsQuery.data?.hasOnboarded ?? false,
    isSettingsLoaded: !settingsQuery.isPending,
    completeOnboarding,
    reload: refresh,
  };
});
