import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pie, PolarChart } from 'victory-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { formatMoney, type Currency } from '@/utils/currency';

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  slices: DonutSlice[];
  currency: Currency;
  size?: number;
};

export default function DonutChart({ slices, currency, size = 168 }: Props) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const data = slices
    .filter((slice) => slice.value > 0)
    .map((slice) => ({ label: slice.label, value: slice.value, color: slice.color }));
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  if (data.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <PolarChart data={data} labelKey="label" valueKey="value" colorKey="color">
          <Pie.Chart innerRadius="64%" />
        </PolarChart>
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.centerValue}>{formatMoney(total, currency)}</Text>
          <Text style={styles.centerLabel}>This currency</Text>
        </View>
      </View>
      <View style={styles.legend}>
        {data.map((slice) => (
          <View key={slice.label} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: slice.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={styles.legendValue}>
              {Math.round((total > 0 ? slice.value / total : 0) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 0,
    },
    center: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    centerValue: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.text,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    centerLabel: {
      fontSize: 11,
      color: Colors.textTertiary,
      marginTop: 2,
    },
    legend: {
      flex: 1,
      gap: 8,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    swatch: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendLabel: {
      flex: 1,
      fontSize: 13,
      color: Colors.text,
    },
    legendValue: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
  });
