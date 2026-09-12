import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import CategoryIcon from '@/components/CategoryIcon';
import { useReceipts } from '@/context/ReceiptsContext';

export default function CategoriesScreen() {
  const { receipts, categories, addCustomCategory, removeCustomCategory } = useReceipts();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [draft, setDraft] = useState('');

  const countFor = (name: string): number =>
    receipts.filter((r) => r.category === name).length;

  const handleAdd = async () => {
    const name = draft.trim();
    if (!name) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Category exists', 'Choose a different name.');
      return;
    }
    await addCustomCategory(name);
    setDraft('');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.description}>
        Categories help you organize receipts. Custom categories stay on this device.
      </Text>

      <View style={styles.list}>
        {categories.map((category, index) => {
          const count = countFor(category.name);
          return (
            <View key={category.id}>
              <View style={styles.categoryRow}>
                <CategoryIcon icon={category.icon} color={category.color} />
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                </View>
                <Text style={styles.categoryCount}>
                  {count} {count === 1 ? 'receipt' : 'receipts'}
                </Text>
                {!category.builtin && count === 0 ? (
                  <TouchableOpacity
                    onPress={() => void removeCustomCategory(category.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${category.name}`}
                  >
                    <Text style={styles.delete}>Delete</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {index < categories.length - 1 && <View style={styles.divider} />}
            </View>
          );
        })}
      </View>

      <View style={styles.addWrap}>
        <TextInput
          style={styles.addInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="New category name"
          placeholderTextColor={Colors.textTertiary}
          returnKeyType="done"
          onSubmitEditing={() => void handleAdd()}
          accessibilityLabel="New category name"
        />
        <TouchableOpacity
          style={[styles.addButton, !draft.trim() && styles.addButtonDisabled]}
          onPress={() => void handleAdd()}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Add category"
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      paddingVertical: 24,
    },
    description: {
      fontSize: 15,
      color: Colors.textSecondary,
      lineHeight: 22,
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    list: {
      backgroundColor: Colors.surface,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: Colors.borderLight,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 8,
    },
    categoryInfo: {
      flex: 1,
      marginLeft: 6,
    },
    categoryName: {
      fontSize: 16,
      fontWeight: '500' as const,
      color: Colors.text,
    },
    categoryCount: {
      fontSize: 13,
      color: Colors.textTertiary,
      fontVariant: ['tabular-nums'],
    },
    delete: {
      fontSize: 13,
      color: Colors.error,
      marginLeft: 8,
    },
    divider: {
      height: 1,
      backgroundColor: Colors.borderLight,
      marginLeft: 70,
    },
    addWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 20,
    },
    addInput: {
      flex: 1,
      height: 44,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 16,
      color: Colors.text,
      backgroundColor: Colors.surface,
    },
    addButton: {
      height: 44,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonDisabled: {
      opacity: 0.4,
    },
    addButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600' as const,
    },
  });
