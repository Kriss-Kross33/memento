import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Shield } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { useReceipts } from '@/context/ReceiptsContext';
import EmptyState from '@/components/EmptyState';
import { protectionItemsFor } from '@/utils/protection';

export default function ProtectionScreen() {
  const router = useRouter();
  const { receipts } = useReceipts();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const items = useMemo(() => protectionItemsFor(receipts), [receipts]);

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="No protection dates yet"
          message="Add a warranty or return window on a receipt to track it here."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Return windows and warranties stored on this device. Reminders are shown here — notifications
        can wait until a later version.
      </Text>
      {items.map((item) => (
        <TouchableOpacity
          key={`${item.kind}-${item.receiptId}`}
          style={styles.row}
          onPress={() => router.push(`/receipt/${item.receiptId}`)}
          accessibilityRole="button"
          accessibilityLabel={`${item.merchant}, ${item.label}`}
        >
          <View style={styles.icon}>
            <Shield size={16} color={item.daysLeft <= 7 && item.daysLeft >= 0 ? Colors.primary : Colors.textSecondary} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.merchant}>{item.merchant}</Text>
            <Text style={[styles.meta, item.daysLeft <= 3 && item.daysLeft >= 0 && styles.urgent]}>
              {item.label}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
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
      paddingBottom: 32,
    },
    intro: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: Colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.borderLight,
    },
    icon: {
      width: 32,
      alignItems: 'center',
    },
    copy: {
      flex: 1,
      marginLeft: 8,
    },
    merchant: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: Colors.text,
    },
    meta: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 3,
    },
    urgent: {
      color: Colors.primary,
      fontWeight: '600' as const,
    },
  });
