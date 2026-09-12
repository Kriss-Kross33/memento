import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  testID,
}: ButtonProps) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const containerStyle = [
    styles.container,
    styles[`container_${variant}`],
    styles[`container_${size}`],
    disabled ? styles.disabled : undefined,
    style,
  ];

  const textStyle: TextStyle[] = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'primary' ? '#FFFFFF' : Colors.primary} 
        />
      ) : (
        <>
          {icon}
          <Text style={textStyle}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
  },
  container_primary: {
    backgroundColor: Colors.primary,
  },
  container_secondary: {
    backgroundColor: Colors.surfaceSecondary,
  },
  container_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  container_ghost: {
    backgroundColor: 'transparent',
  },
  container_sm: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  container_md: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  container_lg: {
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600' as const,
  },
  text_primary: {
    color: '#FFFFFF',
  },
  text_secondary: {
    color: Colors.text,
  },
  text_outline: {
    color: Colors.text,
  },
  text_ghost: {
    color: Colors.primary,
  },
  text_sm: {
    fontSize: 14,
  },
  text_md: {
    fontSize: 16,
  },
  text_lg: {
    fontSize: 18,
  },
});
