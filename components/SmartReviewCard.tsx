import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, AlertTriangle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import type { ReviewField, ReviewRequirement, ReviewState } from '@/utils/receipt/types';

const FIELD_LABEL: Record<ReviewField, string> = {
  merchant: 'Merchant',
  date: 'Date',
  amount: 'Total',
  currency: 'Currency',
  category: 'Category',
  items: 'Items',
};

type ReviewValues = Partial<Record<ReviewField, string>>;

type Props = {
  state: ReviewState;
  headline: string;
  subtitle: string;
  requirements: ReviewRequirement[];
  values: ReviewValues;
  onSelectField?: (field: ReviewField) => void;
};

export default function SmartReviewCard({
  state,
  headline,
  subtitle,
  requirements,
  values,
  onSelectField,
}: Props) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const uncertain = new Set(requirements.map((requirement) => requirement.field));
  const rows: ReviewField[] =
    state === 'high'
      ? []
      : (['merchant', 'date', 'amount', 'category', 'items'] as ReviewField[]).filter(
          (field) => values[field] != null || uncertain.has(field)
        );

  return (
    <View style={[styles.card, state === 'low' && styles.cardWarn, state === 'high' && styles.cardReady]}>
      <Text style={styles.title} testID="smart-review-title">
        {headline}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {rows.length > 0 ? (
        <View style={styles.list}>
          {rows.map((field) => {
            const isUncertain = uncertain.has(field);
            const requirement = requirements.find((item) => item.field === field);
            return (
              <TouchableOpacity
                key={field}
                style={[styles.row, isUncertain && styles.rowWarn]}
                onPress={() => onSelectField?.(field)}
                disabled={!isUncertain}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${FIELD_LABEL[field]} ${isUncertain ? 'needs a check' : 'looks good'}`}
                testID={`review-field-${field}`}
              >
                <View style={[styles.icon, isUncertain ? styles.iconWarn : styles.iconOk]}>
                  {isUncertain ? (
                    <AlertTriangle size={14} color={Colors.warning} strokeWidth={2.4} />
                  ) : (
                    <Check size={14} color={Colors.success} strokeWidth={3} />
                  )}
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.fieldLabel}>{FIELD_LABEL[field]}</Text>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {values[field] || requirement?.reason || 'Needs a closer look'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 16,
      marginTop: 20,
      padding: 14,
      backgroundColor: Colors.surfaceSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    cardReady: {
      backgroundColor: Colors.successLight,
      borderColor: 'transparent',
    },
    cardWarn: {
      backgroundColor: Colors.warningLight,
      borderColor: 'transparent',
    },
    title: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: Colors.text,
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textSecondary,
      marginTop: 4,
    },
    list: {
      marginTop: 12,
      gap: 6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    rowWarn: {
      backgroundColor: Colors.surface,
    },
    icon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconOk: {
      backgroundColor: Colors.successLight,
    },
    iconWarn: {
      backgroundColor: Colors.warningLight,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: Colors.textSecondary,
    },
    fieldValue: {
      fontSize: 14,
      color: Colors.text,
      marginTop: 1,
    },
  });
