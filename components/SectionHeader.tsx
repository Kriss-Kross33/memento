import React, { useMemo } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';

interface SectionHeaderProps {
  title: string;
  /** Right-aligned meta text (e.g. "12 receipts"). */
  meta?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function SectionHeader({ title, meta, actionLabel, onAction }: SectionHeaderProps) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  meta: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  action: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
    marginLeft: 'auto',
  },
});
