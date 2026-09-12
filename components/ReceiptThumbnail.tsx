import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { ImageOff, ReceiptText } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { ReceiptMedia } from '@/mocks/receipts';

interface ReceiptThumbnailProps {
  media?: ReceiptMedia;
  /** Square edge length in points. */
  size?: number;
  radius?: number;
}

/**
 * Small managed receipt preview for list rows. expo-image decodes at the
 * display size and caches aggressively, so full-resolution photos are never
 * pushed through list rows even with thousands of receipts.
 *
 * States: no image attached, image available, managed image unavailable.
 */
export default function ReceiptThumbnail({ media, size = 52, radius = 10 }: ReceiptThumbnailProps) {
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [media?.uri, media?.thumbnailUri]);

  const wellStyle = {
    width: size,
    height: size,
    borderRadius: radius,
  };

  if (media?.uri && !failed) {
    return (
      <View style={[styles.well, styles.photoWell, wellStyle]}>
        <Image
          source={{ uri: media.thumbnailUri || media.uri }}
          style={[styles.image, { borderRadius: radius }]}
          contentFit="cover"
          transition={120}
          recyclingKey={media.thumbnailUri || media.uri}
          accessibilityLabel="Receipt photo"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  if (media) {
    // Managed copy went missing — keep the row stable, never drop the receipt.
    return (
      <View style={[styles.well, wellStyle]} accessibilityLabel="Receipt image unavailable">
        <ImageOff size={Math.round(size * 0.4)} color={Colors.textTertiary} strokeWidth={2} />
      </View>
    );
  }

  return (
    <View style={[styles.well, wellStyle]} accessibilityLabel="No receipt photo">
      <ReceiptText size={Math.round(size * 0.42)} color={Colors.textTertiary} strokeWidth={2} />
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  well: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoWell: {
    borderColor: Colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surfaceSecondary,
  },
});
