import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';

interface ErrorStateProps {
  title: string;
  message: string;
  /** e.g. a "Try Again" button. */
  action?: React.ReactNode;
}

/** Specific, short, actionable error presentation. */
export default function ErrorState({ title, message, action }: ErrorStateProps) {
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
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  action: {
    marginTop: 20,
    minWidth: 180,
  },
});
