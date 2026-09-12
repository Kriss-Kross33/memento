import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { useReceipts } from '@/context/ReceiptsContext';
import { readReceipt, type ReadReceiptResult } from '@/services/ocr/pipeline';
import { toISODate } from '@/components/DatePickerField';
import Button from '@/components/Button';

const formatPct = (value?: number): string =>
  typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';

export default function OcrLabScreen() {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { defaultCurrency } = useReceipts();
  const [uri, setUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [result, setResult] = useState<ReadReceiptResult | null>(null);
  const [busy, setBusy] = useState(false);

  if (!__DEV__) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>OCR Lab is only available in development builds.</Text>
      </View>
    );
  }

  const pickPhoto = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: false,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setUri(asset.uri);
    setImageSize({
      width: Math.max(asset.width ?? 1, 1),
      height: Math.max(asset.height ?? 1, 1),
    });
    setResult(null);
    setBusy(true);
    try {
      const next = await readReceipt(
        asset.uri,
        { date: toISODate(new Date()), currency: defaultCurrency },
        'library'
      );
      setResult(next);
      if (next.document) {
        setImageSize({
          width: Math.max(next.document.width, 1),
          height: Math.max(next.document.height, 1),
        });
      }
    } catch (error) {
      console.warn('[ocr-lab] read failed', error);
      Alert.alert('OCR failed', 'The photo could not be read on this device.');
    } finally {
      setBusy(false);
    }
  };

  const exportJson = async () => {
    if (!result) return;
    const payload = {
      quality: result.quality,
      plan: result.plan,
      retries: result.retries,
      parsed: result.parsed,
      document: result.document,
    };
    const path = `${FileSystem.cacheDirectory}ocr-lab-${Date.now().toString(36)}.json`;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2));
    if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(path, { mimeType: 'application/json', UTI: 'public.json' });
      return;
    }
    Alert.alert('Exported', path);
  };

  const parsed = result?.parsed;
  const lines = result?.document?.lines ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lede}>
        Run the receipt pipeline on a photo. Boxes are OCR lines; scores come from the parser, not ML
        Kit.
      </Text>
      <Button title={uri ? 'Choose another photo' : 'Choose a receipt photo'} onPress={() => void pickPhoto()} />

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.busyText}>Reading receipt…</Text>
        </View>
      ) : null}

      {uri ? (
        <View style={styles.previewWrap}>
          <Image
            source={{ uri }}
            style={[styles.preview, { aspectRatio: imageSize.width / imageSize.height }]}
            contentFit="contain"
          />
          {lines.map((line, index) => {
            const box = line.boundingBox;
            return (
              <View
                key={`${index}-${line.text}`}
                pointerEvents="none"
                style={[
                  styles.box,
                  {
                    left: `${(box.x / imageSize.width) * 100}%`,
                    top: `${(box.y / imageSize.height) * 100}%`,
                    width: `${(box.width / imageSize.width) * 100}%`,
                    height: `${(box.height / imageSize.height) * 100}%`,
                  },
                ]}
              />
            );
          })}
        </View>
      ) : null}

      {parsed ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Parsed fields</Text>
          <Field label="Merchant" value={parsed.merchant.value} confidence={parsed.merchant.confidence} styles={styles} />
          <Field label="Date" value={parsed.date.value} confidence={parsed.date.confidence} styles={styles} />
          <Field label="Total" value={String(parsed.amount.value)} confidence={parsed.amount.confidence} styles={styles} />
          <Field label="Currency" value={parsed.currency.value} confidence={parsed.currency.confidence} styles={styles} />
          <Field label="Category" value={parsed.category.value} confidence={parsed.category.confidence} styles={styles} />
          <Field
            label="Overall"
            value={formatPct(parsed.overallConfidence)}
            confidence={parsed.overallConfidence}
            styles={styles}
          />
          <Text style={styles.meta}>
            Plan {result?.plan.reason} · retries {result?.retries ?? 0} · {lines.length} lines
          </Text>
        </View>
      ) : null}

      {parsed?.items.value.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items</Text>
          {parsed.items.value.map((item) => (
            <Text key={item.id} style={styles.itemLine}>
              {item.quantity} × {item.label} · {item.total ?? item.unitPrice} ({formatPct(item.confidence)})
            </Text>
          ))}
        </View>
      ) : null}

      {result ? (
        <TouchableOpacity style={styles.export} onPress={() => void exportJson()}>
          <Text style={styles.exportText}>Export OCR JSON</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  confidence,
  styles,
}: {
  label: string;
  value: string;
  confidence: number;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
      <Text style={styles.fieldConf}>{formatPct(confidence)}</Text>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { padding: 16, paddingBottom: 40, gap: 16 },
    lede: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
    busy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    busyText: { fontSize: 14, color: Colors.textSecondary },
    previewWrap: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surfaceSecondary,
    },
    preview: { width: '100%' },
    box: {
      position: 'absolute',
      borderWidth: 1,
      borderColor: 'rgba(13,148,136,0.85)',
      backgroundColor: 'rgba(13,148,136,0.12)',
    },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: 14,
      gap: 8,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
    field: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fieldLabel: { width: 88, fontSize: 13, color: Colors.textSecondary },
    fieldValue: { flex: 1, fontSize: 14, color: Colors.text },
    fieldConf: { width: 44, textAlign: 'right', fontSize: 12, color: Colors.textTertiary },
    meta: { fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
    itemLine: { fontSize: 13, color: Colors.text, lineHeight: 20 },
    export: { alignItems: 'center', paddingVertical: 12 },
    exportText: { fontSize: 15, fontWeight: '500', color: Colors.primary },
  });
