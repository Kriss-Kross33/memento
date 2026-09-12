import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { useReceipts } from '@/context/ReceiptsContext';
import {
  computeMonthlyInsights,
  currencyTrend,
  pickDisplayCurrency,
  receiptsInMonth,
  sortCurrencyTotals,
  totalsByCurrency,
  weeklySpend,
} from '@/utils/insights';
import { formatMoney, type Currency } from '@/utils/currency';
import { formatDate } from '@/mocks/receipts';
import { CHART_PALETTE } from '@/components/charts/palette';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';

/**
 * Local spending insights for the current month.
 * Charts and lists always use one currency so dollars are never added to cedis.
 */
export default function InsightsScreen() {
  const { receipts, defaultCurrency } = useReceipts();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [currencyOverride, setCurrencyOverride] = useState<Currency | null>(null);

  const now = new Date();
  const monthReceipts = useMemo(() => receiptsInMonth(receipts, now), [receipts]);
  const currencyTotals = useMemo(
    () => sortCurrencyTotals(totalsByCurrency(monthReceipts), defaultCurrency),
    [monthReceipts, defaultCurrency]
  );
  const selectedCurrency =
    (currencyOverride && currencyTotals.some((entry) => entry.currency === currencyOverride)
      ? currencyOverride
      : pickDisplayCurrency(currencyTotals, defaultCurrency)) ?? defaultCurrency;
  const insights = useMemo(
    () => computeMonthlyInsights(receipts, now, selectedCurrency),
    [receipts, selectedCurrency]
  );
  const weekBars = useMemo(
    () => weeklySpend(receipts, selectedCurrency, now),
    [receipts, selectedCurrency]
  );
  const donutSlices = useMemo(
    () =>
      insights.topCategories.map((category, index) => ({
        label: category.name,
        value: category.total,
        color: index === 0 ? Colors.primary : CHART_PALETTE[index % CHART_PALETTE.length],
      })),
    [insights.topCategories, Colors.primary]
  );
  const trend = currencyTrend(receipts, selectedCurrency, now);
  const isMixedCurrency = currencyTotals.length > 1;

  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString(
    'en-US',
    { month: 'long' }
  );
  const showTrend = trend.previous > 0 && trend.percent !== 0;
  const trendUp = trend.percent > 0;

  if (monthReceipts.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="No receipts this month"
          message="Scan a receipt and your month's spending will show up here — computed on your device."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{monthLabel.toUpperCase()}</Text>
        <Text style={styles.total}>{formatMoney(insights.total, selectedCurrency)}</Text>
        {showTrend ? (
          <View style={[styles.trendPill, trendUp ? styles.trendPillUp : styles.trendPillDown]}>
            {trendUp ? (
              <TrendingUp size={14} color={Colors.expense} />
            ) : (
              <TrendingDown size={14} color={Colors.income} />
            )}
            <Text style={[styles.trendText, trendUp ? styles.trendUp : styles.trendDown]}>
              {Math.abs(trend.percent).toFixed(1)}% vs {lastMonthName}
            </Text>
          </View>
        ) : (
          <Text style={styles.quiet}>This currency, this month</Text>
        )}

        {isMixedCurrency ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {currencyTotals.map((entry) => (
              <Chip
                key={entry.currency}
                label={`${entry.currency}  ${formatMoney(entry.total, entry.currency)}`}
                selected={entry.currency === selectedCurrency}
                onPress={() => setCurrencyOverride(entry.currency)}
              />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.statGrid}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{insights.count}</Text>
            <Text style={styles.statLabel}>{insights.count === 1 ? 'Receipt' : 'Receipts'}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue} numberOfLines={1}>
              {formatMoney(insights.average, selectedCurrency)}
            </Text>
            <Text style={styles.statLabel}>Average</Text>
          </View>
        </View>

        {isMixedCurrency ? (
          <Text style={styles.mixedNote}>
            Currencies stay separate. Everything below is {selectedCurrency} only.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Over the month</Text>
          <Text style={styles.cardMeta}>Weekly · {selectedCurrency}</Text>
        </View>
        <BarChart bars={weekBars} currency={selectedCurrency} />
      </View>

      {donutSlices.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Where it went</Text>
            <Text style={styles.cardMeta}>By category</Text>
          </View>
          <DonutChart slices={donutSlices} currency={selectedCurrency} />
          <View style={styles.rule} />
          <View style={styles.categoryList}>
            {insights.topCategories.map((cat, index) => {
              const color = donutSlices[index]?.color ?? Colors.primary;
              return (
                <View key={cat.name} style={styles.categoryRow}>
                  <View style={styles.categoryTop}>
                    <View style={[styles.swatch, { backgroundColor: color }]} />
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {cat.name}
                    </Text>
                    <Text style={styles.categoryAmount}>
                      {formatMoney(cat.total, selectedCurrency)}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.max(cat.share * 100, 2)}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Merchants</Text>
          <Text style={styles.cardMeta}>This month</Text>
        </View>
        {insights.topMerchants.map((merchant, index) => (
          <View
            key={merchant.name}
            style={[styles.listRow, index < insights.topMerchants.length - 1 && styles.listRowBorder]}
          >
            <View style={styles.listInfo}>
              <Text style={styles.listName} numberOfLines={1}>
                {merchant.name}
              </Text>
              <Text style={styles.listMeta}>
                {merchant.count} {merchant.count === 1 ? 'receipt' : 'receipts'}
              </Text>
            </View>
            <Text style={styles.listAmount}>{formatMoney(merchant.total, selectedCurrency)}</Text>
          </View>
        ))}

        {insights.largest ? (
          <>
            <View style={styles.rule} />
            <Text style={styles.subhead}>Largest receipt</Text>
            <View style={styles.highlight}>
              <View style={styles.listInfo}>
                <Text style={styles.listName} numberOfLines={1}>
                  {insights.largest.merchant.trim() || 'Unknown merchant'}
                </Text>
                <Text style={styles.listMeta}>{formatDate(insights.largest.date)}</Text>
              </View>
              <Text style={styles.listAmount}>
                {formatMoney(insights.largest.amount, insights.largest.currency)}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      <Text style={styles.footnote}>
        Computed on your device from your receipts. Nothing is uploaded or shared.
      </Text>
    </ScrollView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
      gap: 14,
    },
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      padding: 16,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
      letterSpacing: 0.7,
      marginBottom: 6,
    },
    total: {
      fontSize: 36,
      fontWeight: '700',
      color: Colors.text,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    quiet: {
      fontSize: 13,
      color: Colors.textTertiary,
      marginTop: 8,
    },
    trendPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    trendPillUp: {
      backgroundColor: Colors.expenseLight,
    },
    trendPillDown: {
      backgroundColor: Colors.incomeLight,
    },
    trendText: {
      fontSize: 13,
      fontWeight: '600',
    },
    trendUp: {
      color: Colors.expense,
    },
    trendDown: {
      color: Colors.income,
    },
    chips: {
      gap: 8,
      marginTop: 14,
    },
    statGrid: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    statTile: {
      flex: 1,
      backgroundColor: Colors.surfaceSecondary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.text,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    mixedNote: {
      fontSize: 12,
      color: Colors.textTertiary,
      lineHeight: 17,
      marginTop: 12,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.text,
    },
    cardMeta: {
      fontSize: 12,
      color: Colors.textTertiary,
      fontVariant: ['tabular-nums'],
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
      marginVertical: 16,
    },
    categoryList: {
      gap: 14,
    },
    categoryRow: {},
    categoryTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
      gap: 8,
    },
    swatch: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    categoryName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: Colors.text,
    },
    categoryAmount: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.text,
      fontVariant: ['tabular-nums'],
    },
    barTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.borderLight,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 3,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    listRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    listInfo: {
      flex: 1,
      marginRight: 12,
    },
    listName: {
      fontSize: 15,
      fontWeight: '500',
      color: Colors.text,
    },
    listMeta: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    listAmount: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.text,
      fontVariant: ['tabular-nums'],
    },
    subhead: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.textSecondary,
      letterSpacing: 0.4,
      marginBottom: 10,
      textTransform: 'uppercase',
    },
    highlight: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surfaceSecondary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    footnote: {
      fontSize: 12,
      color: Colors.textTertiary,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: 12,
      marginTop: 8,
    },
  });
