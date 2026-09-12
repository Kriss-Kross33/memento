import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { X, Tag, FileText } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { useReceipts } from '@/context/ReceiptsContext';
import { currencySymbol, Currency } from '@/utils/currency';
import { toISODate } from '@/components/DatePickerField';
import DatePickerField from '@/components/DatePickerField';
import CategoryField from '@/components/CategoryField';
import Button from '@/components/Button';

export default function AddReceiptScreen() {
  const router = useRouter();
  const { addReceipt, defaultCurrency } = useReceipts();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);

  const isValid = merchant.trim().length > 0 && parseFloat(amount) > 0;

  const handleSave = () => {
    if (!isValid) return;

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    void (async () => {
      const newId = await addReceipt({
        merchant: merchant.trim(),
        date,
        amount: parseFloat(amount) || 0,
        category,
        currency,
        notes: notes.trim(),
      });
      router.replace(`/receipt/${newId}`, { withAnchor: true });
    })();
  };

  const handleCancel = () => {
    router.back();
  };

  const currencyOptions: Currency[] = ['GHS', 'USD', 'GBP', 'EUR'];

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerTitle: 'Add Receipt',
          headerTintColor: Colors.text,
          headerLeft: () => (
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => null,
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
                autoFocus
                accessibilityLabel="Total amount"
              />
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Tag size={18} color={Colors.textSecondary} />
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Merchant</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={merchant}
                  onChangeText={setMerchant}
                  placeholder="Enter merchant name"
                  placeholderTextColor={Colors.textTertiary}
                  testID="merchant-input"
                  accessibilityLabel="Merchant name"
                />
              </View>
            </View>

            <View style={styles.divider} />
            <DatePickerField value={date} onChange={setDate} days={30} testID="date-field" />
            <View style={styles.divider} />
            <CategoryField value={category} onChange={setCategory} testID="category-field" />
            <View style={styles.divider} />

            <View style={styles.field}>
              <Text style={styles.currencyBadge}>{currencySymbol(currency)}</Text>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Currency</Text>
                <View style={styles.chipRow}>
                  {currencyOptions.map((code) => (
                    <TouchableOpacity
                      key={code}
                      style={[styles.chip, currency === code && styles.chipSelected]}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                        setCurrency(code);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: currency === code }}
                      accessibilityLabel={code}
                      testID={`currency-${code}`}
                    >
                      <Text style={[styles.chipText, currency === code && styles.chipTextSelected]}>
                        {currencySymbol(code)} {code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.field}>
              <FileText size={18} color={Colors.textSecondary} />
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  style={[styles.fieldInput, styles.notesInput]}
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

          <View style={styles.actions}>
            <Button
              title="Save Receipt"
              onPress={handleSave}
              disabled={!isValid}
              testID="save-receipt-button"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  headerButton: {
    padding: 4,
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
  form: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fieldContent: {
    flex: 1,
    marginLeft: 22,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  fieldInput: {
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  currencyBadge: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    width: 18,
    textAlign: 'center',
    paddingTop: 2,
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
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 68,
  },
  actions: {
    marginTop: 24,
    marginHorizontal: 16,
  },
});
