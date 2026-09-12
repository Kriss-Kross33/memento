import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';

interface SettingsRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showArrow?: boolean;
  toggle?: {
    value: boolean;
    onValueChange: (value: boolean) => void;
  };
  testID?: string;
}

export default function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showArrow = true,
  toggle,
  testID,
}: SettingsRowProps) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      testID={testID}
    >
      <View style={styles.iconContainer}>{icon}</View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          trackColor={{ false: Colors.border, true: Colors.primaryMuted }}
          thumbColor={toggle.value ? Colors.primary : Colors.surface}
        />
      ) : rightElement ? (
        rightElement
      ) : showArrow && onPress ? (
        <ChevronRight size={20} color={Colors.textTertiary} />
      ) : null}
    </Container>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
