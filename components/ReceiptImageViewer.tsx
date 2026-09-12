import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Receipt } from '@/mocks/receipts';

interface ReceiptImageViewerProps {
  receipt: Receipt | null;
  visible: boolean;
  onClose: () => void;
}

/** Full-screen document viewer for a receipt's managed photo. */
export default function ReceiptImageViewer({ receipt, visible, onClose }: ReceiptImageViewerProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      accessibilityLabel={receipt?.merchant ? `Receipt photo, ${receipt.merchant}` : 'Receipt photo'}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {receipt?.merchant.trim() || 'Receipt'}
          </Text>
          <TouchableOpacity
            style={styles.close}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close viewer"
            testID="close-image-viewer"
          >
            <X size={22} color={Colors.surface} />
          </TouchableOpacity>
        </View>
        {receipt?.media?.uri ? (
          <Image
            source={{ uri: receipt.media.uri }}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel="Receipt photo, full size"
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.surface,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  image: {
    flex: 1,
    margin: 16,
  },
});
