import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { TrendingDown, TrendingUp, Camera, Grid3X3, BarChart3, FileDown } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { consumeFreshEntrance } from '@/utils/freshEntrance';
import { useReceipts } from '@/context/ReceiptsContext';
import { formatMoney } from '@/utils/currency';
import { urgentProtection } from '@/utils/protection';
import ReceiptRow from '@/components/ReceiptRow';
import SectionHeader from '@/components/SectionHeader';
import EmptyState from '@/components/EmptyState';

const RECENT_LIMIT = 5;

export default function HomeScreen() {
  const router = useRouter();
  const { receipts, monthlyTotal, lastMonthTotal, percentChange, isLoading } = useReceipts();
  const [refreshing, setRefreshing] = React.useState(false);
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  // Staggered entrance — played once, right after onboarding finishes.
  const playEntrance = useRef(consumeFreshEntrance()).current;
  const entrance = useRef<Animated.Value[]>(
    Array.from({ length: 8 }, () => new Animated.Value(playEntrance ? 0 : 1))
  ).current;

  useEffect(() => {
    if (!playEntrance) return;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        entrance.forEach((v) => v.setValue(1));
        return;
      }
      Animated.stagger(
        70,
        entrance.map((v) =>
          Animated.timing(v, {
            toValue: 1,
            duration: 460,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ).start();
    });
    return () => {
      cancelled = true;
    };
  }, [playEntrance, entrance]);

  const entranceStyle = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  });

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long' });

  // Trend is only meaningful with data from the previous month.
  const showTrend = lastMonthTotal > 0 && percentChange !== 0;
  const trendUp = percentChange > 0;
  const recentReceipts = receipts.slice(0, RECENT_LIMIT);
  const isEmpty = !isLoading && receipts.length === 0;
  const reminder = urgentProtection(receipts)[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      <Animated.View style={[styles.hero, entranceStyle(entrance[0])]}>
        <Text style={styles.monthLabel}>{monthLabel.toUpperCase()}</Text>
        <Text style={styles.total} testID="monthly-total">
          {formatMoney(monthlyTotal)}
        </Text>
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
      </Animated.View>

      {reminder ? (
        <TouchableOpacity
          style={styles.reminder}
          onPress={() => router.push('/protection')}
          accessibilityRole="button"
          accessibilityLabel={reminder.label}
        >
          <Text style={styles.reminderText}>
            {reminder.merchant}: {reminder.label}
          </Text>
        </TouchableOpacity>
      ) : null}

      <Animated.View style={[styles.actions, entranceStyle(entrance[1])]}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => router.push('/(tabs)/scan')}
          activeOpacity={0.9}
          testID="scan-button"
          accessibilityRole="button"
          accessibilityLabel="Scan receipt"
        >
          <Camera size={20} color={Colors.surface} strokeWidth={2.5} />
          <Text style={styles.primaryActionText}>Scan Receipt</Text>
        </TouchableOpacity>
        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => router.push('/categories')}
            activeOpacity={0.7}
            testID="categories-button"
            accessibilityRole="button"
            accessibilityLabel="Categories"
          >
            <Grid3X3 size={18} color={Colors.textSecondary} />
            <Text style={styles.secondaryActionText}>Categories</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => router.push('/insights')}
            activeOpacity={0.7}
            testID="insights-button"
            accessibilityRole="button"
            accessibilityLabel="Insights"
          >
            <BarChart3 size={18} color={Colors.textSecondary} />
            <Text style={styles.secondaryActionText}>Insights</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => router.push('/export')}
            activeOpacity={0.7}
            testID="export-button"
            accessibilityRole="button"
            accessibilityLabel="Export"
          >
            <FileDown size={18} color={Colors.textSecondary} />
            <Text style={styles.secondaryActionText}>Export</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {isEmpty ? (
        <Animated.View style={entranceStyle(entrance[2])}>
          <EmptyState
            title="No receipts yet"
            message="Scan your first receipt to start building your private receipt library."
            action={
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => router.push('/(tabs)/scan')}
                activeOpacity={0.9}
                accessibilityRole="button"
              >
                <Camera size={18} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.emptyActionText}>Scan Receipt</Text>
              </TouchableOpacity>
            }
          />
        </Animated.View>
      ) : (
        <Animated.View style={[styles.recentSection, entranceStyle(entrance[2])]}>
          <SectionHeader
            title="Recent Receipts"
            meta={`${receipts.length} total`}
            actionLabel="See all"
            onAction={() => router.push('/(tabs)/library')}
          />
          <View style={styles.list}>
            {recentReceipts.map((receipt, i) => (
              <Animated.View key={receipt.id} style={entranceStyle(entrance[3 + i])}>
                <ReceiptRow
                  receipt={receipt}
                  onPress={() => router.push(`/receipt/${receipt.id}`, { withAnchor: true })}
                />
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      )}
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
    marginBottom: 24,
  },
  reminder: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 10,
  },
  reminderText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
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
  actions: {
    marginHorizontal: 16,
    marginBottom: 28,
    gap: 10,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    minHeight: 52,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  recentSection: {
    marginBottom: 8,
  },
  list: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  emptyActionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
