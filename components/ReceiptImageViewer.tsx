import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Receipt } from '@/mocks/receipts';

interface ReceiptImageViewerProps {
  receipt: Receipt | null;
  visible: boolean;
  onClose: () => void;
  pageIndex?: number;
  onPageChange?: (index: number) => void;
}

/** Full-screen document viewer for a receipt's managed photo(s). */
export default function ReceiptImageViewer({
  receipt,
  visible,
  onClose,
  pageIndex = 0,
  onPageChange,
}: ReceiptImageViewerProps) {
  const pages = receipt?.sourceMedia?.length
    ? receipt.sourceMedia
    : receipt?.media
      ? [receipt.media]
      : [];
  const [index, setIndex] = useState(pageIndex);

  useEffect(() => {
    if (visible) setIndex(pageIndex);
  }, [visible, pageIndex]);

  const show = pages[Math.min(index, Math.max(pages.length - 1, 0))];

  const go = (next: number) => {
    if (next < 0 || next >= pages.length) return;
    setIndex(next);
    onPageChange?.(next);
  };

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
            {pages.length > 1 ? ` · ${index + 1}/${pages.length}` : ''}
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
        {show?.uri ? (
          <Image
            source={{ uri: show.uri }}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel="Receipt photo, full size"
          />
        ) : null}
        {pages.length > 1 ? (
          <View style={styles.nav}>
            <TouchableOpacity
              onPress={() => go(index - 1)}
              disabled={index === 0}
              accessibilityRole="button"
              accessibilityLabel="Previous page"
            >
              <ChevronLeft size={28} color={index === 0 ? 'rgba(255,255,255,0.3)' : Colors.surface} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => go(index + 1)}
              disabled={index === pages.length - 1}
              accessibilityRole="button"
              accessibilityLabel="Next page"
            >
              <ChevronRight
                size={28}
                color={index === pages.length - 1 ? 'rgba(255,255,255,0.3)' : Colors.surface}
              />
            </TouchableOpacity>
          </View>
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
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
});
