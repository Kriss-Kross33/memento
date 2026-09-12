import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { formatMoney } from '@/utils/currency';
import type { CurrencyTotal } from '@/utils/insights';

type Props = {
  totals: CurrencyTotal[];
  testID?: string;
};

/** Month totals, one line per currency. Never sums dollars into cedis. */
export default function CurrencyTotals({ totals, testID }: Props) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  if (totals.length === 0) {
    return (
      <Text style={styles.primary} testID={testID}>
        {formatMoney(0)}
      </Text>
    );
  }

  return (
    <View testID={testID}>
      {totals.map((entry, index) => (
        <Text key={entry.currency} style={index === 0 ? styles.primary : styles.secondary}>
          {formatMoney(entry.total, entry.currency)}
        </Text>
      ))}
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    primary: {
      fontSize: 40,
      fontWeight: '700',
      color: Colors.text,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    secondary: {
      fontSize: 24,
      fontWeight: '700',
      color: Colors.text,
      letterSpacing: -0.4,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },
  });
