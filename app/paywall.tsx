import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Crown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { useSubscription } from '@/context/SubscriptionContext';
import Button from '@/components/Button';
import { PLAN_COPY, PRO_FEATURES, recommendedPlan } from '@/constants/monetization';
import type { PlanKind, StorePlan } from '@internal/purchases';
import { subscriptionConfig } from '@/services/subscription';

type PaywallReason = 'scans' | 'export' | 'categories' | 'feature';

const HEADLINES: Record<PaywallReason, { title: string; subtitle: string }> = {
  scans: {
    title: 'Keep scanning without limits',
    subtitle: 'Free includes 10 on-device scans each month. Pro unlocks unlimited reading — still private, still on this device.',
  },
  export: {
    title: 'Export polished PDF reports',
    subtitle: 'CSV export stays free. Pro adds print-ready PDFs and batch reports generated on your device.',
  },
  categories: {
    title: 'Organize the way you work',
    subtitle: 'Built-in categories stay free. Pro lets you add custom categories that stay on this device.',
  },
  feature: {
    title: 'Unlock Memento Pro',
    subtitle: 'Unlimited scans, advanced organization, and smarter exports. Receipts still never leave this device.',
  },
};

const reasonFrom = (value?: string): PaywallReason => {
  if (value === 'scans' || value === 'export' || value === 'categories' || value === 'feature') return value;
  return 'scans';
};

const planBadge = (kind: PlanKind, selected: boolean): string | null => {
  if (kind === 'yearly') return selected ? 'Best value' : 'Best value';
  if (kind === 'lifetime') return 'Pay once';
  return null;
};

export default function PaywallScreen() {
  const params = useLocalSearchParams<{ reason?: string }>();
  const reason = reasonFrom(Array.isArray(params.reason) ? params.reason[0] : params.reason);
  const copy = HEADLINES[reason];
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { offering, purchase, restore, isBusy, hasPro } = useSubscription();
  const [selectedKind, setSelectedKind] = useState<PlanKind>(recommendedPlan(offering).kind);

  const selected = offering.plans.find((plan) => plan.kind === selectedKind) ?? offering.plans[0];

  const close = () => {
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    router.back();
  };

  const handleSelect = (plan: StorePlan) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setSelectedKind(plan.kind);
  };

  const handlePurchase = async () => {
    if (!selected) return;
    if (hasPro) {
      close();
      return;
    }
    if (!subscriptionConfig.enabled || !selected.raw) {
      Alert.alert(
        'Purchases are not connected yet',
        'Add RevenueCat API keys to enable App Store and Play Store billing. Your receipts stay on this device.'
      );
      return;
    }
    try {
      const next = await purchase(selected);
      if (next.hasPro) {
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        close();
      }
    } catch (error) {
      const { isUserCancelledError } = await import('@/services/subscription');
      if (isUserCancelledError(error)) return;
      Alert.alert('Purchase could not be completed', 'Try again, or restore purchases if you already bought Pro.');
    }
  };

  const handleRestore = async () => {
    try {
      const next = await restore();
      if (next.hasPro) {
        Alert.alert('Purchases restored', next.isLifetime ? 'Memento Pro Lifetime is active.' : 'Memento Pro is active.');
        close();
        return;
      }
      Alert.alert('No purchases found', 'Nothing to restore on this App Store or Play Store account.');
    } catch {
      Alert.alert('Restore failed', 'Try again in a moment.');
    }
  };

  const ctaLabel = (): string => {
    if (!selected) return 'Continue';
    if (selected.hasIntroOffer) {
      return selected.introPriceString
        ? `Start for ${selected.introPriceString}`
        : 'Start introductory offer';
    }
    if (selected.kind === 'lifetime') return `Get Lifetime · ${selected.priceString}`;
    return `Continue · ${selected.priceString}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="paywall-screen">
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Crown size={14} color={Colors.primary} />
          <Text style={styles.badgeText}>Memento Pro</Text>
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
      </View>

      <View style={styles.features}>
        {PRO_FEATURES.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Check size={16} color={Colors.primary} strokeWidth={2.6} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <View style={styles.plans}>
        {offering.plans.map((plan) => {
          const selectedPlan = plan.kind === selected?.kind;
          const badge = planBadge(plan.kind, selectedPlan);
          return (
            <TouchableOpacity
              key={plan.kind}
              style={[styles.plan, selectedPlan && styles.planSelected]}
              onPress={() => handleSelect(plan)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedPlan }}
              testID={`plan-${plan.kind}`}
            >
              <View style={styles.planTop}>
                <Text style={[styles.planTitle, selectedPlan && styles.planTitleSelected]}>
                  {PLAN_COPY[plan.kind].title}
                </Text>
                {badge ? (
                  <View style={[styles.planBadge, plan.kind === 'yearly' && styles.planBadgeFeatured]}>
                    <Text style={[styles.planBadgeText, plan.kind === 'yearly' && styles.planBadgeTextFeatured]}>
                      {badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.planPrice}>
                {plan.priceString}
                <Text style={styles.planCadence}> {PLAN_COPY[plan.kind].cadence}</Text>
              </Text>
              {plan.hasIntroOffer ? (
                <Text style={styles.planIntro}>
                  {plan.introPriceString ? `${plan.introPriceString} introductory offer` : 'Introductory offer available'}
                  {plan.introPeriod ? ` · ${plan.introPeriod}` : ''}
                </Text>
              ) : (
                <Text style={styles.planNote}>{PLAN_COPY[plan.kind].valueNote}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Button title={ctaLabel()} onPress={() => void handlePurchase()} loading={isBusy} size="lg" testID="paywall-cta" />

      <TouchableOpacity onPress={() => void handleRestore()} style={styles.restore} testID="restore-purchases">
        <Text style={styles.restoreText}>Restore purchases</Text>
      </TouchableOpacity>

      <Text style={styles.footnote}>
        Lifetime includes current Pro features. It does not include future cloud backup. Receipt OCR stays on this
        device.
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
    },
    hero: {
      marginBottom: 20,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      backgroundColor: Colors.primaryMuted,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      marginBottom: 14,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: Colors.primary,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 30,
      fontWeight: '700' as const,
      color: Colors.text,
      letterSpacing: -0.6,
      lineHeight: 36,
    },
    subtitle: {
      marginTop: 10,
      fontSize: 15,
      lineHeight: 22,
      color: Colors.textSecondary,
    },
    features: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginBottom: 18,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 8,
    },
    featureText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: Colors.text,
    },
    plans: {
      gap: 10,
      marginBottom: 18,
    },
    plan: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: Colors.border,
      padding: 14,
    },
    planSelected: {
      borderColor: Colors.primary,
      backgroundColor: Colors.surface,
    },
    planTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    planTitle: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: Colors.text,
    },
    planTitleSelected: {
      color: Colors.primary,
    },
    planBadge: {
      backgroundColor: Colors.surfaceSecondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    planBadgeFeatured: {
      backgroundColor: Colors.primaryMuted,
    },
    planBadgeText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: Colors.textSecondary,
    },
    planBadgeTextFeatured: {
      color: Colors.primary,
    },
    planPrice: {
      fontSize: 22,
      fontWeight: '700' as const,
      color: Colors.text,
    },
    planCadence: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: Colors.textSecondary,
    },
    planNote: {
      marginTop: 6,
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    planIntro: {
      marginTop: 6,
      fontSize: 13,
      color: Colors.primary,
      fontWeight: '600' as const,
    },
    restore: {
      alignSelf: 'center',
      paddingVertical: 16,
    },
    restoreText: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: Colors.primary,
    },
    footnote: {
      fontSize: 12,
      lineHeight: 17,
      color: Colors.textTertiary,
      textAlign: 'center',
    },
  });
