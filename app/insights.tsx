import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { useReceipts } from '@/context/ReceiptsContext';
import { computeMonthlyInsights, totalsByCurrency } from '@/utils/insights';
import { formatMoney } from '@/utils/currency';
import { formatDate } from '@/mocks/receipts';
import SectionHeader from '@/components/SectionHeader';
import EmptyState from '@/components/EmptyState';

/**
 * Lightweight, local-only spending insights for the current month.
 * Typography-led on purpose — a chart only appears where a bar genuinely
 * communicates a share of spend.
 */
export default function InsightsScreen() {
  const { receipts, percentChange, lastMonthTotal } = useReceipts();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const now = new Date();
  const monthReceipts = useMemo(
    () =>
      receipts.filter((r) => {
        const d = new Date(r.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [receipts]
  );
  const insights = useMemo(() => computeMonthlyInsights(receipts, now), [receipts, now]);
  const currencyTotals = useMemo(() => totalsByCurrency(monthReceipts), [monthReceipts]);
  const isMixedCurrency = currencyTotals.length > 1;

  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString(
    'en-US',
    { month: 'long' }
  );
  const showTrend = lastMonthTotal > 0 && percentChange !== 0;
  const trendUp = percentChange > 0;

  if (insights.count === 0) {
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
      <View style={styles.hero}>
        <Text style={styles.monthLabel}>{monthLabel.toUpperCase()}</Text>
        <Text style={styles.total}>{formatMoney(insights.total)}</Text>
        {showTrend ? (
          <View style={styles.trendRow}>
            {trendUp ? (
              <TrendingUp size={15} color={Colors.expense} />
            ) : (
              <TrendingDown size={15} color={Colors.income} />
            )}
            <Text style={[styles.trendText, trendUp ? styles.trendUp : styles.trendDown]}>
              {Math.abs(percentChange).toFixed(1)}% vs {lastMonthName}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{insights.count}</Text>
          <Text style={styles.statLabel}>
            {insights.count === 1 ? 'Receipt' : 'Receipts'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatMoney(insights.average)}</Text>
          <Text style={styles.statLabel}>Average receipt</Text>
        </View>
      </View>

      {isMixedCurrency && (
        <Text style={styles.mixedNote}>
          Mixed currencies this month —{' '}
          {currencyTotals.map((t) => `${formatMoney(t.total, t.currency)} ${t.currency}`).join(' + ')}
          . The total above combines them for a quick read.
        </Text>
      )}

      <View style={styles.section}>
        <SectionHeader title="Where it went" meta="By category" />
        <View style={styles.categoryList}>
          {insights.topCategories.map((cat) => (
            <View key={cat.name} style={styles.categoryRow}>
              <View style={styles.categoryTop}>
                <Text style={styles.categoryName} numberOfLines={1}>
                  {cat.name}
                </Text>
                <Text style={styles.categoryAmount}>{formatMoney(cat.total)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(cat.share * 100, 2)}%` }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Top merchants" meta="This month" />
        <View style={styles.plainList}>
          {insights.topMerchants.map((m) => (
            <View key={m.name} style={styles.merchantRow}>
              <View style={styles.merchantInfo}>
                <Text style={styles.merchantName} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={styles.merchantMeta}>
                  {m.count} {m.count === 1 ? 'receipt' : 'receipts'}
                </Text>
              </View>
              <Text style={styles.merchantAmount}>{formatMoney(m.total)}</Text>
            </View>
          ))}
        </View>
      </View>

      {insights.largest && (
        <View style={styles.section}>
          <SectionHeader title="Largest receipt" meta="This month" />
          <View style={styles.plainList}>
            <View style={styles.merchantRow}>
              <View style={styles.merchantInfo}>
                <Text style={styles.merchantName} numberOfLines={1}>
                  {insights.largest.merchant.trim() || 'Unknown merchant'}
                </Text>
                <Text style={styles.merchantMeta}>{formatDate(insights.largest.date)}</Text>
              </View>
              <Text style={styles.merchantAmount}>
                {formatMoney(insights.largest.amount, insights.largest.currency)}
              </Text>
            </View>
          </View>
        </View>
      )}

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
    paddingBottom: 32,
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 20,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  total: {
    fontSize: 40,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 5,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  trendUp: {
    color: Colors.expense,
  },
  trendDown: {
    color: Colors.income,
  },
  statRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  stat: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  mixedNote: {
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 18,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  section: {
    marginTop: 24,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  categoryRow: {},
  categoryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  categoryName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    marginRight: 12,
  },
  categoryAmount: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  plainList: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  merchantInfo: {
    flex: 1,
    marginRight: 12,
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  merchantMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  merchantAmount: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 32,
  },
});
