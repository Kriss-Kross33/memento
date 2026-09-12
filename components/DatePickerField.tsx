import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Calendar, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import FormRow from '@/components/FormRow';

interface DatePickerFieldProps {
  value: string;
  onChange: (date: string) => void;
  days?: number;
  testID?: string;
}

export const toISODate = (d: Date): string => d.toISOString().split('T')[0];

/** Expandable date field with a horizontal strip of the last N days. */
export default function DatePickerField({ value, onChange, days = 60, testID }: DatePickerFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const options: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    options.push(toISODate(d));
  }

  const display = new Date(value).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

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
        accessibilityLabel={`Date, ${display}`}
        testID={testID}
      >
        <Calendar size={18} color={Colors.textSecondary} />
        <View style={styles.content}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value} numberOfLines={1}>{display}</Text>
        </View>
        <ChevronDown
          size={16}
          color={Colors.textTertiary}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.strip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripContent}
          >
            {options.map((dateOption) => {
              const isSelected = dateOption === value;
              const d = new Date(dateOption);
              const isToday = dateOption === toISODate(new Date());
              return (
                <TouchableOpacity
                  key={dateOption}
                  style={[styles.day, isSelected && styles.daySelected]}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    onChange(dateOption);
                    setExpanded(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.dayWeek, isSelected && styles.dayTextSelected]}>
                    {isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayNumber, isSelected && styles.dayTextSelected]}>
                    {d.getDate()}
                  </Text>
                  <Text style={[styles.dayMonth, isSelected && styles.dayTextSelected]}>
                    {d.toLocaleDateString('en-US', { month: 'short' })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
  strip: {
    paddingVertical: 10,
    paddingLeft: 68,
    backgroundColor: Colors.surfaceSecondary,
  },
  stripContent: {
    paddingRight: 16,
    gap: 8,
  },
  day: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    minWidth: 60,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  daySelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayWeek: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  dayMonth: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dayTextSelected: {
    color: Colors.surface,
  },
});
