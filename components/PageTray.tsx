import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { MAX_RECEIPT_PAGES } from '@/utils/receipt/limits';

export type TrayPage = {
  id: string;
  uri: string;
};

type Props = {
  pages: TrayPage[];
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  onMove?: (id: string, direction: -1 | 1) => void;
  onSelect?: (id: string, index: number) => void;
  maxPages?: number;
  dark?: boolean;
};

export default function PageTray({
  pages,
  onAdd,
  onRemove,
  onMove,
  onSelect,
  maxPages = MAX_RECEIPT_PAGES,
  dark = false,
}: Props) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors, dark), [Colors, dark]);

  return (
    <View style={styles.wrap} testID="page-tray">
      <Text style={styles.copy}>These pages will become one receipt.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {pages.map((page, index) => (
          <View key={page.id} style={styles.card}>
            <TouchableOpacity
              onPress={() => onSelect?.(page.id, index)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`View page ${index + 1}`}
            >
              <Image source={{ uri: page.uri }} style={styles.thumb} contentFit="cover" />
            </TouchableOpacity>
            <Text style={styles.index}>{index + 1}</Text>
            {onRemove ? (
              <TouchableOpacity
                style={styles.remove}
                onPress={() => onRemove(page.id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove page ${index + 1}`}
              >
                <X size={12} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
            {onMove ? (
              <View style={styles.moveRow}>
                <TouchableOpacity
                  onPress={() => onMove(page.id, -1)}
                  disabled={index === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Move page left"
                >
                  <ChevronLeft size={14} color={index === 0 ? Colors.textTertiary : Colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onMove(page.id, 1)}
                  disabled={index === pages.length - 1}
                  accessibilityRole="button"
                  accessibilityLabel="Move page right"
                >
                  <ChevronRight
                    size={14}
                    color={index === pages.length - 1 ? Colors.textTertiary : Colors.text}
                  />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}
        {onAdd && pages.length < maxPages ? (
          <TouchableOpacity
            style={styles.add}
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add page"
            testID="add-page-button"
          >
            <Plus size={18} color={dark ? '#FFFFFF' : Colors.primary} />
            <Text style={styles.addText}>Add page</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    wrap: {
      gap: 8,
    },
    copy: {
      fontSize: 12,
      color: dark ? 'rgba(255,255,255,0.7)' : Colors.textSecondary,
      paddingHorizontal: 4,
    },
    row: {
      alignItems: 'center',
      gap: 10,
      paddingVertical: 4,
    },
    card: {
      width: 72,
      height: 96,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: dark ? 'rgba(255,255,255,0.08)' : Colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: dark ? 'rgba(255,255,255,0.12)' : Colors.border,
    },
    thumb: {
      width: '100%',
      height: '100%',
    },
    index: {
      position: 'absolute',
      left: 6,
      bottom: 6,
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    remove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    moveRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
      backgroundColor: 'rgba(255,255,255,0.75)',
    },
    add: {
      width: 72,
      height: 96,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: dark ? 'rgba(255,255,255,0.35)' : Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    addText: {
      fontSize: 11,
      fontWeight: '600',
      color: dark ? '#FFFFFF' : Colors.primary,
      textAlign: 'center',
    },
  });
