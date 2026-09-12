import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import {
  Trash2,
  Check,
  FileText,
  ImagePlus,
  ImageOff,
  X,
  Plus,
  CalendarClock,
  Hash,
  ArrowLeft,
  ScanText,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { useReceipts } from '@/context/ReceiptsContext';
import { ReceiptItem, formatFullDate } from '@/mocks/receipts';
import { currencySymbol, Currency, currencies, formatMoney } from '@/utils/currency';
import { isMediaAvailable } from '@/services/receiptMedia';
import CategoryField from '@/components/CategoryField';
import DatePickerField, { toISODate } from '@/components/DatePickerField';
import SectionHeader from '@/components/SectionHeader';
import Button from '@/components/Button';
import ReceiptImageViewer from '@/components/ReceiptImageViewer';
import { shareCsv, sharePdf } from '@/utils/exportShare';
import { readReceipt } from '@/services/ocr/pipeline';
import { buildOcrMetadata } from '@/services/ocrMetadata';
import { recordUserCorrections } from '@/services/intelligence/store';
import { isLowFieldConfidence, isLowItemConfidence, reviewSummaryFromOcr } from '@/utils/receipt/confidence';
import SmartReviewCard from '@/components/SmartReviewCard';
import { useSubscription } from '@/context/SubscriptionContext';
import type { ReviewField } from '@/utils/receipt/types';

const looksLikeBrokenItems = (list: ReceiptItem[], total: number): boolean => {
  if (list.some((item) => /^(at|vat|tax|%|%?\s*at)$/i.test(item.label.trim()))) return true;
  const sum = list.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  return list.length > 0 && total > 0 && Math.abs(sum - total) > 1 && list.length <= 3;
};

const WARRANTY_OPTIONS = [
  { months: null, label: 'None' },
  { months: 6, label: '6 mo' },
  { months: 12, label: '12 mo' },
  { months: 24, label: '24 mo' },
] as const;

const RETURN_OPTIONS = [
  { days: null, label: 'None' },
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

const addMonths = (iso: string, months: number): string => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
};

const monthsBetween = (fromIso: string, toIso: string): number | null => {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return months > 0 ? months : null;
};

export default function ReceiptDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; scanned?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const scanned = Array.isArray(params.scanned) ? params.scanned[0] : params.scanned;
  const router = useRouter();
  const { getReceipt, updateReceipt, deleteReceipt, attachMedia } = useReceipts();
  const { hasPro, requestScan, consumeScan } = useSubscription();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const receipt = getReceipt(id || '');

  const [merchant, setMerchant] = useState(receipt?.merchant || '');
  const [amount, setAmount] = useState(receipt?.amount?.toString() || '0');
  const [category, setCategory] = useState(receipt?.category || 'Other');
  const [notes, setNotes] = useState(receipt?.notes || '');
  const [date, setDate] = useState(receipt?.date || toISODate(new Date()));
  const [currency, setCurrency] = useState<Currency>(receipt?.currency ?? 'GHS');
  const [items, setItems] = useState<ReceiptItem[]>(receipt?.items ?? []);
  const [warrantyUntil, setWarrantyUntil] = useState<string | undefined>(receipt?.warrantyUntil);
  const [returnWindowDays, setReturnWindowDays] = useState<number | undefined>(
    receipt?.returnWindowDays
  );
  const [tags, setTags] = useState<string[]>(receipt?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [mediaOk, setMediaOk] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRereading, setIsRereading] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [focusField, setFocusField] = useState<ReviewField | null>(null);
  const rereadAttempted = useRef(false);

  const lineTotalOf = (item: ReceiptItem): number =>
    Math.round((item.total ?? item.quantity * item.unitPrice) * 100) / 100;

  useEffect(() => {
    if (receipt) {
      setMerchant(receipt.merchant);
      setAmount(receipt.amount.toString());
      setCategory(receipt.category);
      setNotes(receipt.notes || '');
      setDate(receipt.date);
      setCurrency(receipt.currency);
      setItems(receipt.items ?? []);
      setWarrantyUntil(receipt.warrantyUntil);
      setReturnWindowDays(receipt.returnWindowDays);
      setTags(receipt.tags ?? []);
    }
  }, [receipt]);

  useEffect(() => {
    let cancelled = false;
    setMediaOk(true);
    isMediaAvailable(receipt?.media).then((ok) => {
      if (!cancelled) setMediaOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [receipt?.media?.uri]);

  useEffect(() => {
    if (!receipt) return;
    const changed =
      merchant !== receipt.merchant ||
      parseFloat(amount) !== receipt.amount ||
      category !== receipt.category ||
      notes !== (receipt.notes || '') ||
      date !== receipt.date ||
      currency !== receipt.currency ||
      (warrantyUntil ?? '') !== (receipt.warrantyUntil ?? '') ||
      (returnWindowDays ?? 0) !== (receipt.returnWindowDays ?? 0) ||
      JSON.stringify(tags) !== JSON.stringify(receipt.tags ?? []) ||
      JSON.stringify(items) !== JSON.stringify(receipt.items ?? []);
    setHasChanges(changed);
  }, [merchant, amount, category, notes, date, currency, items, warrantyUntil, returnWindowDays, tags, receipt]);

  const dismiss = useCallback(() => {
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    router.replace('/(tabs)/library');
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (viewerVisible) {
          setViewerVisible(false);
          return true;
        }
        dismiss();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [dismiss, viewerVisible])
  );

  const handleSave = () => {
    if (!id) return;

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const nextItems = items.filter((i) => i.label.trim() || i.unitPrice > 0);
    updateReceipt(id, {
      merchant,
      amount: parseFloat(amount) || 0,
      category,
      notes,
      date,
      currency,
      items: nextItems,
      subtotal: nextItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
      tags,
      warrantyUntil,
      returnWindowDays,
    });
    void recordUserCorrections({
      scannedMerchant: receipt?.ocr?.suggestedMerchant,
      savedMerchant: merchant,
      scannedCategory: receipt?.ocr?.suggestedCategory,
      savedCategory: category,
      currency,
    });
    dismiss();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Receipt',
      'This permanently removes the receipt, its line items, and the photo stored in Memento. Photos in your library are not touched. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Receipt',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            if (!id) return;
            void deleteReceipt(id)
              .then(() => dismiss())
              .catch((error) => {
                console.warn('[receipt] delete failed', error);
                Alert.alert(
                  "Receipt couldn't be deleted",
                  'Try again. The receipt is still on this device.',
                  [{ text: 'OK' }]
                );
              });
          },
        },
      ]
    );
  };

  const importImage = useCallback(async () => {
    if (!id || isImporting) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets[0]) return;
      setIsImporting(true);
      await attachMedia(id, { uri: result.assets[0].uri, source: 'library' });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert(
        "Receipt image couldn't be processed",
        'The photo could not be copied into Memento. Try again.',
        [{ text: 'Try Again', onPress: () => void importImage() }, { text: 'Cancel', style: 'cancel' }]
      );
    } finally {
      setIsImporting(false);
    }
  }, [id, attachMedia, isImporting]);

  const rereadFromPhoto = useCallback(async (countUsage = false) => {
    const uri = receipt?.media?.uri;
    if (!uri || isRereading) return;
    if (countUsage) {
      const allowed = await requestScan();
      if (!allowed) {
        router.push('/paywall?reason=scans');
        return;
      }
    }
    setIsRereading(true);
    try {
      const mediaSource = receipt.media?.source;
      const ocrSource = mediaSource === 'camera' || mediaSource === 'library' ? mediaSource : 'unknown';
      const { document, parsed } = await readReceipt(uri, { date, currency }, ocrSource);
      if (!document) {
        Alert.alert(
          "Receipt couldn't be read",
          'The photo is still saved. Try again, or edit the items yourself.',
          [{ text: 'OK' }]
        );
        return;
      }
      const nextMerchant = parsed.merchant.value || merchant;
      const nextDate = parsed.date.value || date;
      const nextAmount = parsed.amount.value > 0 ? parsed.amount.value : parseFloat(amount) || 0;
      const nextCategory = parsed.category.value || category;
      const nextCurrency =
        parsed.currency.confidence >= 0.8 ? parsed.currency.value || currency : currency;
      const nextNotes = parsed.notes?.value && !notes.trim() ? parsed.notes.value : notes;
      const nextItems = parsed.items.value;
      const nextOcr = buildOcrMetadata(parsed, true);
      setMerchant(nextMerchant);
      setDate(nextDate);
      setAmount(String(nextAmount));
      setCategory(nextCategory);
      setCurrency(nextCurrency);
      setNotes(nextNotes);
      setItems(nextItems);
      if (id) {
        await updateReceipt(id, {
          merchant: nextMerchant,
          date: nextDate,
          amount: nextAmount,
          currency: nextCurrency,
          category: nextCategory,
          notes: nextNotes,
          items: nextItems,
          subtotal: nextItems.reduce((sum, item) => sum + (item.total ?? item.quantity * item.unitPrice), 0),
          ocr: nextOcr,
        });
      }
      if (countUsage) await consumeScan();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.warn('[receipt] reread failed', error);
      Alert.alert(
        "Receipt couldn't be read",
        'The photo is still saved. Try again, or edit the items yourself.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRereading(false);
    }
  }, [
    receipt?.media?.uri,
    receipt?.media?.source,
    isRereading,
    date,
    currency,
    notes,
    merchant,
    amount,
    category,
    id,
    updateReceipt,
    requestScan,
    consumeScan,
    router,
  ]);

  useEffect(() => {
    if (rereadAttempted.current || isRereading) return;
    if (scanned !== '1' && scanned !== 'true') return;
    if (!receipt?.media?.uri) return;
    if (!looksLikeBrokenItems(receipt.items ?? [], receipt.amount)) return;
    rereadAttempted.current = true;
    void rereadFromPhoto();
  }, [scanned, receipt, isRereading, rereadFromPhoto]);

  const updateItem = (itemId: string, updates: Partial<ReceiptItem>) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i)));
  };

  const removeItem = (itemId: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const addItem = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setItems((prev) => [
      ...prev,
      { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, label: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const commitTag = () => {
    const next = tagDraft.trim().replace(/^#/, '');
    if (!next) return;
    if (!tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
      setTags((prev) => [...prev, next]);
    }
    setTagDraft('');
  };

  if (!receipt) {
    return (
      <View style={styles.container}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Receipt not found</Text>
        </View>
      </View>
    );
  }

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const hasMedia = Boolean(receipt.media);
  const imageUnavailable = hasMedia && !mediaOk;
  const isNewReceipt = receipt.merchant === '' && receipt.amount === 0;
  const fromScan = scanned === '1' || scanned === 'true';
  const detected = fromScan || receipt.ocr?.processingStatus === 'done';
  const review = reviewSummaryFromOcr(receipt.ocr, {
    merchant,
    amount: parseFloat(amount) || 0,
    itemCount: items.length,
    date,
    category,
    currency,
  });
  const merchantNeedsCheck = detected && isLowFieldConfidence(receipt.ocr?.merchantConfidence);
  const amountNeedsCheck = detected && isLowFieldConfidence(receipt.ocr?.totalConfidence);
  const dateNeedsCheck = detected && isLowFieldConfidence(receipt.ocr?.dateConfidence);
  const categoryNeedsCheck = detected && isLowFieldConfidence(receipt.ocr?.categoryConfidence);
  const itemsNeedCheck = detected && isLowFieldConfidence(receipt.ocr?.itemsConfidence);
  const uncertainItems = items.filter((item) => isLowItemConfidence(item.confidence));
  const canSave = fromScan || hasChanges;
  const headerTitle =
    fromScan || (isNewReceipt && hasMedia)
      ? 'Review Receipt'
      : isNewReceipt
        ? 'New Receipt'
        : 'Receipt Details';
  const warrantyMonths = warrantyUntil ? monthsBetween(date, warrantyUntil) : null;
  const warrantyDisplay = warrantyUntil
    ? `Until ${new Date(warrantyUntil).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    : undefined;
  const selectedWarranty =
    warrantyMonths === null ? null : WARRANTY_OPTIONS.find((o) => o.months === warrantyMonths) ?? null;

  // Return window status — computed locally, shown as a quiet deadline.
  const returnExpiry = returnWindowDays ? addDays(date, returnWindowDays) : null;
  const daysLeft = returnExpiry
    ? Math.ceil((new Date(returnExpiry).getTime() - Date.now()) / DAY_MS)
    : null;
  const returnDisplay = returnExpiry
    ? `Until ${new Date(returnExpiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` +
      (daysLeft !== null && daysLeft >= 0
        ? daysLeft === 0
          ? ' · Expires today'
          : daysLeft === 1
            ? ' · Expires tomorrow'
            : ` · Expires in ${daysLeft} days`
        : ' · Expired')
    : null;
  const selectedReturn =
    RETURN_OPTIONS.find((o) => o.days === (returnWindowDays ?? null)) ?? null;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle,
          headerBackVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={dismiss}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleDelete}
                style={styles.headerButton}
                accessibilityRole="button"
                accessibilityLabel="Delete receipt"
              >
                <Trash2 size={20} color={Colors.error} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[styles.headerButton, !canSave && styles.headerButtonDisabled]}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityLabel={fromScan ? "Confirm receipt" : "Save changes"}
                accessibilityState={{ disabled: !canSave }}
              >
                <Check size={22} color={canSave ? Colors.primary : Colors.textTertiary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Receipt image — the document itself comes first */}
        {hasMedia && mediaOk ? (
          <TouchableOpacity
            style={styles.imageHero}
            activeOpacity={0.9}
            onPress={() => setViewerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="View receipt photo full size"
            testID="receipt-image"
          >
            <Image
              source={{ uri: receipt.media?.uri }}
              style={styles.imageHeroImage}
              contentFit="cover"
              transition={150}
              accessibilityLabel={`Receipt photo, ${merchant.trim() || 'unfiled'}`}
            />
            <Text style={styles.imageHeroHint}>Tap to view</Text>
          </TouchableOpacity>
        ) : imageUnavailable ? (
          <View style={styles.imageUnavailable}>
            <ImageOff size={22} color={Colors.textTertiary} />
            <Text style={styles.imageUnavailableTitle}>Receipt image unavailable</Text>
            <Text style={styles.imageUnavailableText}>Your receipt details are still available.</Text>
            <Button
              title="Replace Image"
              onPress={() => void importImage()}
              variant="outline"
              size="sm"
              loading={isImporting}
              style={styles.replaceButton}
              testID="replace-image-button"
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addPhoto}
            activeOpacity={0.8}
            onPress={() => void importImage()}
            disabled={isImporting}
            accessibilityRole="button"
            accessibilityLabel="Add receipt photo from library"
            testID="add-photo-button"
          >
            <ImagePlus size={20} color={Colors.textSecondary} />
            <Text style={styles.addPhotoTitle}>Add Photo</Text>
            <Text style={styles.addPhotoText}>Attach the receipt from your photo library. A private copy is saved here.</Text>
          </TouchableOpacity>
        )}

        {detected && fromScan ? (
          <SmartReviewCard
            state={review.state}
            headline={review.headline}
            subtitle={review.subtitle}
            requirements={review.requirements}
            values={{
              merchant: merchant || undefined,
              date: formatFullDate(date),
              amount: formatMoney(parseFloat(amount) || 0, currency),
              category,
              items:
                uncertainItems.length > 0
                  ? uncertainItems
                      .slice(0, 2)
                      .map((item) => `${item.quantity} × ${item.label || 'uncertain text'}`)
                      .join(' · ')
                  : items.length > 0
                    ? `${items.length} ${items.length === 1 ? 'item' : 'items'}`
                    : undefined,
            }}
            explanations={receipt.ocr?.reviewHints}
            onSelectField={setFocusField}
          />
        ) : null}

        {/* Merchant + total */}
        <View style={styles.amountSection}>
          <View style={styles.amountRow}>
            <Text style={styles.currencySymbol}>{currencySymbol(currency)}</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textTertiary}
              testID="amount-input"
              autoFocus={isNewReceipt}
              accessibilityLabel="Total amount"
            />
          </View>
          {amountNeedsCheck ? <Text style={styles.fieldHint}>Check this total</Text> : null}
          <TextInput
            style={styles.merchantInput}
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Merchant name"
            placeholderTextColor={Colors.textTertiary}
            testID="merchant-input"
            accessibilityLabel="Merchant name"
          />
          {merchantNeedsCheck || focusField === 'merchant' ? <Text style={styles.fieldHint}>Check this merchant</Text> : null}
          <Text style={styles.dateLine}>{formatFullDate(date)}</Text>
        </View>

        {/* Details */}
        <View style={styles.form}>
          <DatePickerField value={date} onChange={setDate} testID="date-field" />
          {dateNeedsCheck || focusField === 'date' ? <Text style={[styles.fieldHint, styles.fieldHintPad]}>Check this date</Text> : null}
          <View style={styles.divider} />
          <CategoryField value={category} onChange={setCategory} testID="category-field" />
          {categoryNeedsCheck || focusField === 'category' ? <Text style={[styles.fieldHint, styles.fieldHintPad]}>Check this category</Text> : null}
          <View style={styles.divider} />
          <View style={styles.currencyRow}>
            <View style={styles.currencyIconSlot}>
              <Hash size={18} color={Colors.textSecondary} />
            </View>
            <View style={styles.currencyContent}>
              <Text style={styles.fieldLabel}>Tags</Text>
              <View style={styles.chipRow}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.chip, styles.chipSelected]}
                    onPress={() => setTags((prev) => prev.filter((item) => item !== tag))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove tag ${tag}`}
                  >
                    <Text style={[styles.chipText, styles.chipTextSelected]}>#{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.tagInput}
                value={tagDraft}
                onChangeText={setTagDraft}
                onSubmitEditing={commitTag}
                placeholder="Add a tag"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel="Add tag"
              />
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.currencyRow}>
            <View style={styles.currencyIconSlot}>
              <Text style={styles.currencyIconText}>{currencySymbol(currency)}</Text>
            </View>
            <View style={styles.currencyContent}>
              <Text style={styles.fieldLabel}>Currency</Text>
              <View style={styles.chipRow}>
                {currencies.map((c) => (
                  <TouchableOpacity
                    key={c.code}
                    style={[styles.chip, currency === c.code && styles.chipSelected]}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setCurrency(c.code);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: currency === c.code }}
                    accessibilityLabel={`${c.label}, ${c.code}`}
                    testID={`currency-${c.code}`}
                  >
                    <Text style={[styles.chipText, currency === c.code && styles.chipTextSelected]}>
                      {c.symbol} {c.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.currencyRow}>
            <View style={styles.currencyIconSlot}>
              <Text style={styles.currencyIconText}>⌛</Text>
            </View>
            <View style={styles.currencyContent}>
              <Text style={styles.fieldLabel}>Warranty</Text>
              <View style={styles.chipRow}>
                {WARRANTY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.chip, selectedWarranty?.months === opt.months && styles.chipSelected]}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setWarrantyUntil(opt.months === null ? undefined : addMonths(date, opt.months));
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: warrantyMonths === opt.months }}
                  >
                    <Text style={[styles.chipText, selectedWarranty?.months === opt.months && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {warrantyDisplay ? <Text style={styles.warrantyMeta}>{warrantyDisplay}</Text> : null}
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.currencyRow}>
            <View style={styles.currencyIconSlot}>
              <CalendarClock size={18} color={Colors.textSecondary} />
            </View>
            <View style={styles.currencyContent}>
              <Text style={styles.fieldLabel}>Return window</Text>
              <View style={styles.chipRow}>
                {RETURN_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.chip, selectedReturn?.days === opt.days && styles.chipSelected]}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setReturnWindowDays(opt.days === null ? undefined : opt.days);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: (returnWindowDays ?? null) === opt.days }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedReturn?.days === opt.days && styles.chipTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {returnDisplay ? <Text style={styles.warrantyMeta}>{returnDisplay}</Text> : null}
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.notesRow}>
            <FileText size={18} color={Colors.textSecondary} />
            <View style={styles.currencyContent}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes (optional)"
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={3}
                testID="notes-input"
                accessibilityLabel="Notes"
              />
            </View>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.itemsSection}>
          <SectionHeader
            title="Items"
            meta={items.length > 0 ? `${items.length} ${items.length === 1 ? 'item' : 'items'}` : 'Optional'}
          />
          {items.length > 0 && (
            <View style={styles.form}>
              {items.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={[styles.itemRow, (isLowItemConfidence(item.confidence) || (item.confidence == null && itemsNeedCheck)) && styles.itemRowWarn]}>
                    <TextInput
                      style={styles.itemLabel}
                      value={item.label}
                      onChangeText={(text) => updateItem(item.id, { label: text })}
                      placeholder="Description"
                      placeholderTextColor={Colors.textTertiary}
                      accessibilityLabel="Item description"
                    />
                    <TextInput
                      style={styles.itemQty}
                      value={String(item.quantity)}
                      onChangeText={(text) => {
                        const quantity = parseInt(text, 10) || 0;
                        updateItem(item.id, {
                          quantity,
                          total: Math.round(quantity * item.unitPrice * 100) / 100,
                        });
                      }}
                      keyboardType="number-pad"
                      accessibilityLabel="Item quantity"
                    />
                    <TextInput
                      style={styles.itemPrice}
                      value={
                        editingPriceId === item.id
                          ? priceDraft
                          : lineTotalOf(item)
                            ? lineTotalOf(item).toFixed(2)
                            : ''
                      }
                      onFocus={() => {
                        setEditingPriceId(item.id);
                        setPriceDraft(lineTotalOf(item) ? lineTotalOf(item).toFixed(2) : '');
                      }}
                      onBlur={() => setEditingPriceId(null)}
                      onChangeText={(text) => {
                        setPriceDraft(text);
                        const nextTotal = parseFloat(text) || 0;
                        const qty = item.quantity || 1;
                        updateItem(item.id, {
                          total: nextTotal,
                          unitPrice: Math.round((nextTotal / qty) * 100) / 100,
                        });
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={Colors.textTertiary}
                      accessibilityLabel="Item line total"
                    />
                    <TouchableOpacity
                      style={styles.itemRemove}
                      onPress={() => removeItem(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.label || 'item'}`}
                    >
                      <X size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              ))}
              <View style={styles.breakdown}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Subtotal</Text>
                  <Text style={styles.breakdownValue}>{formatMoney(subtotal, currency)}</Text>
                </View>
                <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                  <Text style={styles.breakdownLabel}>Total</Text>
                  <Text style={styles.breakdownTotalValue}>{formatMoney(parseFloat(amount) || 0, currency)}</Text>
                </View>
              </View>
            </View>
          )}
          <TouchableOpacity
            style={styles.addItem}
            onPress={addItem}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add line item"
            testID="add-item-button"
          >
            <Plus size={16} color={Colors.primary} />
            <Text style={styles.addItemText}>Add item</Text>
          </TouchableOpacity>
          {hasMedia && mediaOk ? (
            <TouchableOpacity
              style={styles.rereadItems}
              onPress={() => void rereadFromPhoto(true)}
              disabled={isRereading}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Read items from the receipt photo again"
              testID="reread-items-button"
            >
              {isRereading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <ScanText size={16} color={Colors.primary} />
              )}
              <Text style={styles.addItemText}>
                {isRereading ? 'Reading items…' : 'Read items from photo'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.exportRow}>
          <TouchableOpacity
            onPress={() => void shareCsv([receipt], `receipt-${receipt.merchant || 'receipt'}.csv`)}
            accessibilityRole="button"
            accessibilityLabel="Export this receipt as CSV"
          >
            <Text style={styles.exportLink}>Export CSV</Text>
          </TouchableOpacity>
          <Text style={styles.exportDot}>·</Text>
          <TouchableOpacity
            onPress={() => {
              if (!hasPro) {
                router.push('/paywall?reason=export');
                return;
              }
              void sharePdf([receipt], receipt.merchant || 'Receipt');
            }}
            accessibilityRole="button"
            accessibilityLabel="Export this receipt as PDF"
          >
            <Text style={styles.exportLink}>Export PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Guidance */}
        <Text style={styles.tipText}>
          {fromScan
            ? 'Details were read from the photo on your device. Check they look right before saving.'
            : hasMedia
              ? 'The photo is kept as your proof of purchase. Complete the details above before filing.'
              : 'Add the merchant, total, and category to finish filing this receipt.'}
        </Text>

        <TouchableOpacity
          style={styles.deleteAction}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete receipt"
          testID="delete-receipt-button"
        >
          <Trash2 size={16} color={Colors.error} />
          <Text style={styles.deleteActionText}>Delete Receipt</Text>
        </TouchableOpacity>
      </ScrollView>

      <ReceiptImageViewer receipt={receipt} visible={viewerVisible} onClose={() => setViewerVisible(false)} />
    </>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  imageHero: {
    marginHorizontal: 16,
    marginTop: 8,
    height: 216,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSecondary,
  },
  imageHeroImage: {
    width: '100%',
    height: '100%',
  },
  imageHeroHint: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.surface,
    backgroundColor: 'rgba(0,0,0,0.45)',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  imageUnavailable: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  imageUnavailableTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 12,
  },
  imageUnavailableText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  replaceButton: {
    minWidth: 180,
  },
  addPhoto: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  addPhotoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 10,
  },
  addPhotoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '600' as const,
    color: Colors.text,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 44,
    fontWeight: '700' as const,
    color: Colors.text,
    minWidth: 120,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  merchantInput: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 8,
    padding: 0,
    minWidth: 200,
  },
  dateLine: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 6,
  },
  form: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 68,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  currencyIconSlot: {
    width: 18,
    alignItems: 'center',
    paddingTop: 2,
  },
  currencyIconText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  currencyContent: {
    flex: 1,
    marginLeft: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSecondary,
    minHeight: 36,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryMuted,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  chipTextSelected: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  tagInput: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.text,
    padding: 0,
    minHeight: 24,
  },
  detectBanner: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 14,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
  },
  detectBannerWarn: {
    backgroundColor: Colors.warningLight,
  },
  fieldHint: {
    fontSize: 12,
    color: Colors.warning,
    marginTop: 4,
  },
  fieldHintPad: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  detectBannerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  detectBannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  exportLink: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  exportDot: {
    color: Colors.textTertiary,
  },
  warrantyMeta: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 8,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  notesInput: {
    fontSize: 16,
    color: Colors.text,
    padding: 0,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  itemsSection: {
    marginTop: 28,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  itemRowWarn: {
    backgroundColor: Colors.warningLight,
    borderRadius: 8,
  },
  itemLabel: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
    minWidth: 0,
  },
  itemQty: {
    width: 44,
    fontSize: 15,
    color: Colors.text,
    textAlign: 'center',
    paddingVertical: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
    fontVariant: ['tabular-nums'],
  },
  itemPrice: {
    width: 76,
    fontSize: 15,
    color: Colors.text,
    textAlign: 'right',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 8,
    fontVariant: ['tabular-nums'],
  },
  itemRemove: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  breakdownTotal: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  breakdownTotalValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  addItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    minHeight: 44,
  },
  addItemText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  rereadItems: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
    minHeight: 44,
  },
  tipText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 28,
    marginHorizontal: 32,
  },
  deleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
  },
  deleteActionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
  },
});
