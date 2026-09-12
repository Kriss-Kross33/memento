import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import IconWell from '@/components/IconWell';

interface FormRowProps {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

/**
 * Form field shell: leading icon well, small gray label, content underneath.
 * Used by every editable field so spacing and alignment stay identical.
 */
export default function FormRow({ icon, label, children }: FormRowProps) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.row}>
      {icon ? <IconWell size={40} background="transparent">{icon}</IconWell> : null}
      <View style={[styles.content, !icon && styles.contentFull]}>
        <Text style={styles.label}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  contentFull: {
    marginLeft: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
});
