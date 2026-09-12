import React, { useMemo } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { Receipt, formatDate } from '@/mocks/receipts';
import { formatMoney } from '@/utils/currency';
import ReceiptThumbnail from '@/components/ReceiptThumbnail';

interface ReceiptRowProps {
  receipt: Receipt;
  onPress: () => void;
  showChevron?: boolean;
}

/** Full-bleed list row: thumbnail + merchant + meta, amount on the right. */
export default function ReceiptRow({ receipt, onPress, showChevron = true }: ReceiptRowProps) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const merchant = receipt.merchant.trim() || 'Unknown merchant';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.6}
      testID={`receipt-card-${receipt.id}`}
      accessibilityLabel={`${merchant}, ${formatMoney(receipt.amount, receipt.currency)}, ${formatDate(receipt.date)}`}
      accessibilityRole="button"
    >
      <ReceiptThumbnail media={receipt.media} size={52} />
      <View style={styles.content}>
        <Text style={[styles.merchant, !receipt.merchant.trim() && styles.merchantEmpty]} numberOfLines={1}>
          {merchant}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {receipt.category} · {formatDate(receipt.date)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{formatMoney(receipt.amount, receipt.currency)}</Text>
        {showChevron && <ChevronRight size={16} color={Colors.textTertiary} />}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 76,
  },
  content: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  merchant: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  merchantEmpty: {
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
});
