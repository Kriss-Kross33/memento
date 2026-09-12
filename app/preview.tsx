import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CloudOff, Crown } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';

/**
 * Honest product previews for V2 features that need future infrastructure
 * (cloud backup, Pro tier). Clearly labelled "Coming soon" — no fake
 * functionality, no toggles that silently do nothing, no urgency patterns.
 */

type Topic = 'cloud' | 'pro';

interface TopicContent {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  points: string[];
  footnote: string;
}

const CONTENT: Record<Topic, TopicContent> = {
  cloud: {
    eyebrow: 'Cloud Backup',
    title: 'Coming soon',
    paragraphs: [
      'Memento is local-first. Your receipts live on your device, and every feature — scanning, search, insights, export — works fully offline.',
      'When Cloud Backup arrives, it will encrypt your receipts end-to-end and restore them to a new device. It will be optional: an account will unlock backup, never the app itself.',
      'Until then, your data stays entirely on this device. You can export a CSV anytime from Settings → Export Data.',
    ],
    points: [
      'End-to-end encrypted before anything leaves your device',
      'Optional account — never required for core features',
      'Restore receipts and photos to a new device',
      'Local database remains the source of truth; sync is an enhancement',
    ],
    footnote: 'Nothing is uploaded today. This screen describes planned functionality only.',
  },
  pro: {
    eyebrow: 'Memento Pro',
    title: 'Coming soon',
    paragraphs: [
      'Pro is a planned tier for people who manage receipts at scale — more storage power, smarter exports, and time-saving automation.',
      'Core Memento features will always be free: scanning, organizing, search, warranties, and CSV export all work offline with no account.',
    ],
    points: [
      'Unlimited on-device OCR scans',
      'PDF reports and advanced export',
      'Custom categories and organization',
      'Warranty and return tracking',
    ],
    footnote: 'Cloud backup is a future Pro+ feature and is not sold today.',
  },
};

export default function PreviewScreen() {
  const params = useLocalSearchParams<{ topic?: string }>();
  const router = useRouter();
  const topic: Topic = params.topic === 'pro' ? 'pro' : 'cloud';
  const content = CONTENT[topic];
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const Icon = topic === 'cloud' ? CloudOff : Crown;

  useEffect(() => {
    if (topic === 'pro') {
      router.replace('/paywall?reason=feature');
    }
  }, [router, topic]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.badge}>
        <Icon size={14} color={Colors.textSecondary} />
        <Text style={styles.badgeText}>{content.eyebrow}</Text>
      </View>
      <Text style={styles.title}>{content.title}</Text>

      {content.paragraphs.map((p, i) => (
        <Text key={i} style={styles.paragraph}>
          {p}
        </Text>
      ))}

      <View style={styles.pointsCard}>
        {content.points.map((point, i) => (
          <View key={i} style={styles.pointRow}>
            <Check size={16} color={Colors.primary} strokeWidth={2.5} />
            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footnote}>{content.footnote}</Text>
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
    paddingBottom: 32,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 23,
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  pointsCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
  },
  pointText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
  },
  footnote: {
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
});
