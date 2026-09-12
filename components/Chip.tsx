import React, { useMemo } from 'react';
import { Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/** Small selectable pill used for filters, currencies and quick values. */
export default function Chip({ label, selected = false, onPress, icon, disabled, style, testID }: ChipProps) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={testID}
    >
      {icon}
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 36,
  },
  chipSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryMuted,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  labelSelected: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
});
