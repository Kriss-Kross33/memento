import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';

interface EmptyStateProps {
  title: string;
  message: string;
  /** Optional call to action rendered below the copy. */
  action?: React.ReactNode;
}

/** Minimal typographic empty state — no illustrations, no cards. */
export default function EmptyState({ title, message, action }: EmptyStateProps) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  action: {
    marginTop: 24,
    minWidth: 220,
  },
});
