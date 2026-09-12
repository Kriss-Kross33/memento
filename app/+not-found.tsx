import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { FileQuestion } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';

export default function NotFoundScreen() {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <FileQuestion size={64} color={Colors.textTertiary} />
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.subtitle}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home</Text>
        </Link>
      </View>
    </>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 24,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  link: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
});
