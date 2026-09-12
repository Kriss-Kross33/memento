import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet, View, Platform } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { getCategory } from '@/mocks/receipts';
import CategoryIcon from '@/components/CategoryIcon';
import { useReceipts } from '@/context/ReceiptsContext';

interface CategoryFieldProps {
  value: string;
  onChange: (category: string) => void;
  testID?: string;
}

/** Expandable category field revealing a wrap grid of category chips. */
export default function CategoryField({ value, onChange, testID }: CategoryFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const Colors = useThemeColors();
  const { categories: allCategories } = useReceipts();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const selected = allCategories.find((c) => c.name === value) ?? getCategory(value);

  return (
    <View>
      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.selectionAsync();
          setExpanded(!expanded);
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Category, ${value}`}
        testID={testID}
      >
        <View style={styles.iconSlot}>
          {selected && <CategoryIcon icon={selected.icon} color={selected.color} size={18} />}
        </View>
        <View style={styles.content}>
          <Text style={styles.label}>Category</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
        <ChevronDown
          size={16}
          color={Colors.textTertiary}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.grid}>
          {allCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.option, value === cat.name && styles.optionSelected]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                onChange(cat.name);
                setExpanded(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: value === cat.name }}
            >
              <CategoryIcon icon={cat.icon} color={cat.color} size={16} />
              <Text
                style={[styles.optionText, value === cat.name && styles.optionTextSelected]}
                numberOfLines={1}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 68,
  },
  iconSlot: {
    width: 18,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: Colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
    backgroundColor: Colors.surfaceSecondary,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 36,
  },
  optionSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryMuted,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  optionTextSelected: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
});
