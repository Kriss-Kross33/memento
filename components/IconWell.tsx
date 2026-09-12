import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface IconWellProps {
  children: React.ReactNode;
  size?: number;
  radius?: number;
  background?: string;
  style?: ViewStyle;
}

/** Rounded-square icon container used consistently across rows and forms. */
export default function IconWell({ children, size = 40, radius = 10, background, style }: IconWellProps) {
  const Colors = useThemeColors();
  const wellBackground = background ?? Colors.surfaceSecondary;

  return (
    <View
      style={[
        styles.well,
        { width: size, height: size, borderRadius: radius, backgroundColor: wellBackground },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
