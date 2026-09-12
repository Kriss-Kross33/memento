import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import Button from '@/components/Button';
import {
  ReceiptFilters,
  DEFAULT_FILTERS,
  DateRange,
  SortOrder,
} from '@/utils/receiptFilters';
import { currencies, Currency } from '@/utils/currency';

interface FilterSheetProps {
  visible: boolean;
  value: ReceiptFilters;
  onApply: (filters: ReceiptFilters) => void;
  onClose: () => void;
}

const DATE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'year', label: 'This year' },
];

const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'amount_high', label: 'Largest' },
  { key: 'amount_low', label: 'Smallest' },
];

/** Native-feeling bottom sheet for the Library's advanced filters. */
export default function FilterSheet({ visible, value, onApply, onClose }: FilterSheetProps) {
  const [draft, setDraft] = useState<ReceiptFilters>(value);
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  /** Local chip — closes over the themed styles. */
  function Chip({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) {
    return (
      <TouchableOpacity
        style={[styles.chip, selected && styles.chipSelected]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  useEffect(() => {
    if (visible) {
      setDraft(value);
    }
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.scrim}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.grabber} />
              <Text style={styles.title}>Filters</Text>

              <Text style={styles.label}>Sort by</Text>
              <View style={styles.chipRow}>
                {SORT_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.key}
                    label={opt.label}
                    selected={draft.sort === opt.key}
                    onPress={() => setDraft((d) => ({ ...d, sort: opt.key }))}
                  />
                ))}
              </View>

              <Text style={styles.label}>Date range</Text>
              <View style={styles.chipRow}>
                {DATE_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.key}
                    label={opt.label}
                    selected={draft.dateRange === opt.key}
                    onPress={() => setDraft((d) => ({ ...d, dateRange: opt.key }))}
                  />
                ))}
              </View>

              <Text style={styles.label}>Amount</Text>
              <View style={styles.amountRow}>
                <TextInput
                  style={styles.amountInput}
                  value={draft.minAmount}
                  onChangeText={(text) => setDraft((d) => ({ ...d, minAmount: text }))}
                  placeholder="Min"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Minimum amount"
                />
                <Text style={styles.amountDash}>–</Text>
                <TextInput
                  style={styles.amountInput}
                  value={draft.maxAmount}
                  onChangeText={(text) => setDraft((d) => ({ ...d, maxAmount: text }))}
                  placeholder="Max"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Maximum amount"
                />
              </View>

              <Text style={styles.label}>Merchant</Text>
              <TextInput
                style={styles.amountInput}
                value={draft.merchant}
                onChangeText={(text) => setDraft((d) => ({ ...d, merchant: text }))}
                placeholder="Merchant name"
                placeholderTextColor={Colors.textTertiary}
                autoCorrect={false}
                accessibilityLabel="Merchant"
              />

              <Text style={[styles.label, { marginTop: 20 }]}>Tag</Text>
              <TextInput
                style={styles.amountInput}
                value={draft.tag}
                onChangeText={(text) => setDraft((d) => ({ ...d, tag: text }))}
                placeholder="business, tax, travel"
                placeholderTextColor={Colors.textTertiary}
                autoCorrect={false}
                autoCapitalize="none"
                accessibilityLabel="Tag"
              />

              <Text style={[styles.label, { marginTop: 20 }]}>Currency</Text>
              <View style={styles.chipRow}>
                <Chip
                  label="Any"
                  selected={draft.currency === 'any'}
                  onPress={() => setDraft((d) => ({ ...d, currency: 'any' }))}
                />
                {currencies.map((c: { code: Currency; symbol: string }) => (
                  <Chip
                    key={c.code}
                    label={c.code}
                    selected={draft.currency === c.code}
                    onPress={() => setDraft((d) => ({ ...d, currency: c.code }))}
                  />
                ))}
              </View>

              <View style={styles.footer}>
                <Button
                  title="Reset"
                  variant="ghost"
                  onPress={() => onApply(DEFAULT_FILTERS)}
                  style={styles.resetButton}
                  testID="filters-reset"
                />
                <Button
                  title="Apply Filters"
                  onPress={() => onApply(draft)}
                  style={styles.applyButton}
                  testID="filters-apply"
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(24,24,27,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryMuted,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  amountInput: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.text,
  },
  amountDash: {
    fontSize: 16,
    color: Colors.textTertiary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  resetButton: {
    flex: 1,
  },
  applyButton: {
    flex: 2,
  },
});
