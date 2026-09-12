import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Bar, CartesianChart } from 'victory-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { formatMoneyShort, type Currency } from '@/utils/currency';
import type { PeriodBar } from '@/utils/insights';

type Props = {
  bars: PeriodBar[];
  currency: Currency;
};

export default function BarChart({ bars, currency }: Props) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const max = Math.max(...bars.map((bar) => bar.total), 0);
  const data = bars.map((bar) => ({ label: bar.label, total: bar.total }));

  return (
    <View style={styles.wrap}>
      <View style={styles.chart}>
        <CartesianChart
          data={data}
          xKey="label"
          yKeys={['total']}
          domain={{ y: [0, max > 0 ? max * 1.15 : 1] }}
          domainPadding={{ left: 28, right: 28, top: 12 }}
          padding={{ left: 4, right: 4, top: 8, bottom: 4 }}
          frame={{ lineColor: 'transparent' }}
          xAxis={{
            lineColor: Colors.borderLight,
            labelColor: 'transparent',
            tickCount: 4,
          }}
          yAxis={[
            {
              lineColor: Colors.borderLight,
              labelColor: 'transparent',
              tickCount: 3,
            },
          ]}
        >
          {({ points, chartBounds }) => (
            <Bar
              points={points.total}
              chartBounds={chartBounds}
              color={Colors.primary}
              innerPadding={0.32}
              roundedCorners={{ topLeft: 6, topRight: 6 }}
            />
          )}
        </CartesianChart>
      </View>
      <View style={styles.labels}>
        {bars.map((bar) => (
          <View key={bar.label} style={styles.labelCol}>
            <Text style={styles.value} numberOfLines={1}>
              {bar.total > 0 ? formatMoneyShort(bar.total, currency) : '—'}
            </Text>
            <Text style={styles.label}>{bar.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 0,
    },
    chart: {
      height: 168,
    },
    labels: {
      flexDirection: 'row',
      marginTop: 8,
    },
    labelCol: {
      flex: 1,
      alignItems: 'center',
    },
    value: {
      fontSize: 11,
      fontWeight: '600',
      color: Colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    label: {
      fontSize: 12,
      color: Colors.textTertiary,
      marginTop: 2,
    },
  });
