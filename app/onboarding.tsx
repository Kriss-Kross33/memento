import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Search } from 'lucide-react-native';
import { useThemeColors, useThemeMode } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { markFreshEntrance } from '@/utils/freshEntrance';
import { useReceipts } from '@/context/ReceiptsContext';

const PHOTO_DESK = require('../assets/onboarding/desk.jpg');
const PHOTO_CAPTURE = require('../assets/onboarding/capture.jpg');
const PHOTO_PURCHASE = require('../assets/onboarding/purchase.jpg');

type Slide =
  | { kind: 'photo'; image: number; title: string; body: string; points?: string[] }
  | { kind: 'library'; title: string; body: string };

const SLIDES: Slide[] = [
  {
    kind: 'photo',
    image: PHOTO_DESK,
    title: 'Never lose a receipt again.',
    body: 'Keep every purchase organized, searchable, and safely stored on your device.',
  },
  {
    kind: 'photo',
    image: PHOTO_CAPTURE,
    title: 'Snap it. You’re done.',
    body: 'Capture a receipt in seconds and keep the important details organized.',
  },
  {
    kind: 'library',
    title: 'Your receipts, finally organized.',
    body: 'Search by merchant, date, category, amount, or what you bought.',
  },
  {
    kind: 'photo',
    image: PHOTO_PURCHASE,
    title: 'Your receipts stay yours.',
    body: 'ReceiptSnap is local-first. Your receipts stay on your device unless you choose to back them up.',
    points: ['Stored on this device', 'No account required', 'Backup only if you choose'],
  },
];

const LAST = SLIDES.length - 1;

const DEMO_ROWS = [
  { merchant: 'Starbucks', meta: 'Food & Dining · 3 Sep', amount: 'GH₵12.45', thumb: PHOTO_CAPTURE },
  { merchant: 'Melcom', meta: 'Other · 2 Sep', amount: 'GH₵200.00', thumb: PHOTO_PURCHASE },
  { merchant: 'ECG', meta: 'Utilities · 28 Nov', amount: 'GH₵20.00', thumb: PHOTO_DESK },
] as const;

const clamp = { extrapolate: 'clamp' as const };

function clampIndex(value: number): number {
  return Math.max(0, Math.min(LAST, value));
}

function KenBurns({ children }: { children: React.ReactNode }) {
  const zoom = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(zoom, {
          toValue: 1,
          duration: 22000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(zoom, {
          toValue: 0,
          duration: 22000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [zoom]);

  const scale = zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

function LibraryPreview({ Colors }: { Colors: ThemeColors }) {
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  return (
    <View style={styles.libraryPreview} pointerEvents="none">
      <View style={styles.searchBar}>
        <Search size={15} color={Colors.textTertiary} />
        <Text style={styles.searchPlaceholder}>Search receipts</Text>
      </View>
      <Text style={styles.sectionLabel}>September</Text>
      <View style={styles.libraryList}>
        {DEMO_ROWS.map((row, i) => (
          <View key={row.merchant}>
            <View style={styles.libraryRow}>
              <Image source={row.thumb} style={styles.thumb} contentFit="cover" />
              <View style={styles.libraryCopy}>
                <Text style={styles.libraryMerchant}>{row.merchant}</Text>
                <Text style={styles.libraryMeta}>{row.meta}</Text>
              </View>
              <Text style={styles.libraryAmount}>{row.amount}</Text>
            </View>
            {i < DEMO_ROWS.length - 1 ? <View style={styles.rowDivider} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function SlideLayer({
  slide,
  index,
  scrollX,
  width,
  Colors,
}: {
  slide: Slide;
  index: number;
  scrollX: Animated.Value;
  width: number;
  Colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const page = Math.max(width, 1);
  const inputRange = [(index - 1) * page, index * page, (index + 1) * page];
  const copyRange = [
    (index - 1) * page,
    (index - 0.22) * page,
    index * page,
    (index + 0.22) * page,
    (index + 1) * page,
  ];

  const opacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], ...clamp });
  const scale = scrollX.interpolate({ inputRange, outputRange: [1.045, 1, 1.025], ...clamp });
  const shift = scrollX.interpolate({
    inputRange,
    outputRange: [page * 0.045, 0, -page * 0.035],
    ...clamp,
  });
  const titleY = scrollX.interpolate({ inputRange, outputRange: [22, 0, -14], ...clamp });
  const titleOpacity = scrollX.interpolate({
    inputRange: copyRange,
    outputRange: [0, 1, 1, 0.15, 0],
    ...clamp,
  });
  const bodyY = scrollX.interpolate({ inputRange, outputRange: [36, 0, -10], ...clamp });
  const bodyOpacity = scrollX.interpolate({
    inputRange: copyRange,
    outputRange: [0, 0.2, 1, 0, 0],
    ...clamp,
  });

  if (slide.kind === 'photo') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity, transform: [{ translateX: shift }, { scale }] },
          ]}
        >
          <KenBurns>
            <Image
              source={slide.image}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              accessibilityRole="image"
              accessibilityLabel={slide.title}
            />
          </KenBurns>
          <LinearGradient
            pointerEvents="none"
            style={styles.photoScrim}
            colors={['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.88)']}
            locations={[0, 0.38, 0.7, 1]}
          />
        </Animated.View>
        <View style={styles.photoCopy}>
          <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleY }] }}>
            <Text style={styles.photoHeadline}>{slide.title}</Text>
          </Animated.View>
          <Animated.View style={{ opacity: bodyOpacity, transform: [{ translateY: bodyY }] }}>
            <Text style={styles.photoBody}>{slide.body}</Text>
            {slide.points && (
              <View style={styles.points}>
                {slide.points.map((point, i) => (
                  <View key={point}>
                    {i > 0 ? <View style={styles.pointRule} /> : null}
                    <Text style={styles.pointText}>{point}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.paddedSlide, StyleSheet.absoluteFill]} pointerEvents="none">
      <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleY }] }}>
        <Text style={styles.headline}>{slide.title}</Text>
      </Animated.View>
      <Animated.View style={{ opacity: bodyOpacity, transform: [{ translateY: bodyY }] }}>
        <Text style={styles.body}>{slide.body}</Text>
        <LibraryPreview Colors={Colors} />
      </Animated.View>
    </View>
  );
}

export default function Onboarding() {
  const { completeOnboarding } = useReceipts();
  const { mode } = useThemeMode();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(0);
  const settledRef = useRef(0);
  const widthRef = useRef(windowWidth);
  const [index, setIndex] = useState(0);
  const [pagerSize, setPagerSize] = useState({ width: windowWidth, height: 0 });

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const setPage = useCallback((next: number) => {
    const target = clampIndex(next);
    if (target === indexRef.current) return;
    indexRef.current = target;
    setIndex(target);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const target = clampIndex(next);
      if (target !== indexRef.current) haptic();
      indexRef.current = target;
      settledRef.current = target;
      setIndex(target);
      pagerRef.current?.scrollTo({ x: target * widthRef.current, animated: true });
    },
    [haptic]
  );

  const finish = useCallback(() => {
    haptic();
    markFreshEntrance();
    completeOnboarding();
  }, [completeOnboarding, haptic]);

  const advance = useCallback(() => {
    if (indexRef.current >= LAST) {
      finish();
      return;
    }
    goTo(indexRef.current + 1);
  }, [finish, goTo]);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const pageWidth = widthRef.current;
          if (pageWidth <= 0) return;
          setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
        },
      }),
    [scrollX, setPage]
  );

  const slide = SLIDES[index];
  const isPhoto = slide.kind === 'photo';
  const isLast = index === LAST;
  const ctaTitle = isLast ? 'Start using ReceiptSnap' : index === 0 ? 'Get Started' : 'Continue';
  const page = Math.max(pagerSize.width, 1);

  const photoMix = scrollX.interpolate({
    inputRange: [0, page, page * 2, page * 3],
    outputRange: [1, 1, 0, 1],
    ...clamp,
  });
  const lightMix = scrollX.interpolate({
    inputRange: [0, page, page * 2, page * 3],
    outputRange: [0, 0, 1, 0],
    ...clamp,
  });
  const progressFill = scrollX.interpolate({
    inputRange: [0, page * LAST],
    outputRange: [1 / SLIDES.length, 1],
    ...clamp,
  });

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#10151F', opacity: photoMix }]}
      />
      <StatusBar style={isPhoto || mode === 'dark' ? 'light' : 'dark'} />

      <View
        style={styles.pager}
        onLayout={(e) => {
          const { width: nextWidth, height: nextHeight } = e.nativeEvent.layout;
          if (nextWidth <= 0) return;
          const sizeChanged = nextWidth !== pagerSize.width || nextHeight !== pagerSize.height;
          if (!sizeChanged) return;
          widthRef.current = nextWidth;
          setPagerSize({ width: nextWidth, height: nextHeight });
          pagerRef.current?.scrollTo({ x: indexRef.current * nextWidth, animated: false });
        }}
      >
        {SLIDES.map((item, i) => (
          <SlideLayer
            key={i}
            slide={item}
            index={i}
            scrollX={scrollX}
            width={pagerSize.width}
            Colors={Colors}
          />
        ))}
        <Animated.ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          decelerationRate="fast"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          onMomentumScrollEnd={(e) => {
            const pageWidth = widthRef.current;
            if (pageWidth <= 0) return;
            const next = clampIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
            if (next !== settledRef.current) haptic();
            settledRef.current = next;
            setPage(next);
          }}
          scrollEventThrottle={16}
          style={styles.pagerHit}
        >
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{ width: page, height: Math.max(pagerSize.height, 1) }}
            />
          ))}
        </Animated.ScrollView>
      </View>

      {!isLast && (
        <TouchableOpacity
          style={[styles.skip, { top: insets.top + 6 }]}
          onPress={finish}
          testID="onboarding-skip"
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <View>
            <Animated.Text style={[styles.skipText, { opacity: lightMix }]}>Skip</Animated.Text>
            <Animated.Text style={[styles.skipText, styles.skipTextOnPhoto, styles.skipOverlay, { opacity: photoMix }]}>
              Skip
            </Animated.Text>
          </View>
        </TouchableOpacity>
      )}

      <SafeAreaView edges={['bottom']} style={styles.footerWrap} pointerEvents="box-none">
        <View style={styles.footer}>
          <View style={styles.progressTrack}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.progressFill,
                styles.progressFillOnLight,
                { opacity: lightMix },
                {
                  transform: [{ translateX: -22 }, { scaleX: progressFill }, { translateX: 22 }],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.progressFill,
                styles.progressFillOnPhoto,
                styles.progressFillOverlay,
                { opacity: photoMix },
                {
                  transform: [{ translateX: -22 }, { scaleX: progressFill }, { translateX: 22 }],
                },
              ]}
            />
          </View>
          <View style={styles.ctaStack}>
            <Animated.View style={[styles.cta, styles.ctaOnLight, { opacity: lightMix }]}>
              <Text style={[styles.ctaText, styles.ctaTextOnLight]}>{ctaTitle}</Text>
            </Animated.View>
            <Animated.View style={[styles.cta, styles.ctaOnPhoto, styles.ctaOverlay, { opacity: photoMix }]}>
              <Text style={[styles.ctaText, styles.ctaTextOnPhoto]}>{ctaTitle}</Text>
            </Animated.View>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={advance}
              activeOpacity={0.9}
              testID="onboarding-cta"
              accessibilityRole="button"
              accessibilityLabel={ctaTitle}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    pager: {
      flex: 1,
    },
    pagerHit: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    photoScrim: {
      ...StyleSheet.absoluteFillObject,
    },
    photoCopy: {
      position: 'absolute',
      left: 28,
      right: 28,
      bottom: 148,
    },
    points: {
      marginTop: 22,
    },
    pointText: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '500' as const,
      color: 'rgba(255,255,255,0.88)',
      paddingVertical: 10,
    },
    pointRule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    photoHeadline: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '600' as const,
      color: '#FFFFFF',
      letterSpacing: -0.5,
    },
    photoBody: {
      fontSize: 16,
      lineHeight: 24,
      color: 'rgba(255,255,255,0.78)',
      marginTop: 10,
    },
    paddedSlide: {
      paddingHorizontal: 24,
      paddingTop: 72,
    },
    headline: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '600' as const,
      color: Colors.text,
      letterSpacing: -0.5,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      color: Colors.textSecondary,
      marginTop: 12,
    },
    libraryPreview: {
      marginTop: 36,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 42,
      paddingHorizontal: 12,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 10,
    },
    searchPlaceholder: {
      fontSize: 15,
      color: Colors.textTertiary,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: Colors.textSecondary,
      marginTop: 22,
      marginBottom: 8,
      marginLeft: 4,
    },
    libraryList: {
      backgroundColor: Colors.surface,
      marginHorizontal: -24,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.borderLight,
    },
    libraryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 72,
    },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: Colors.surfaceSecondary,
    },
    libraryCopy: {
      flex: 1,
      marginLeft: 12,
      marginRight: 8,
    },
    libraryMerchant: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: Colors.text,
    },
    libraryMeta: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 3,
    },
    libraryAmount: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: Colors.text,
      fontVariant: ['tabular-nums'],
    },
    rowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.borderLight,
      marginLeft: 70,
    },
    skip: {
      position: 'absolute',
      right: 20,
      zIndex: 10,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    skipText: {
      fontSize: 15,
      fontWeight: '500' as const,
      color: Colors.textSecondary,
    },
    skipTextOnPhoto: {
      color: 'rgba(255,255,255,0.86)',
    },
    skipOverlay: {
      position: 'absolute',
      left: 0,
      top: 0,
    },
    footerWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    footer: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 8,
      gap: 16,
      alignItems: 'center',
    },
    progressTrack: {
      width: 44,
      height: 2,
      borderRadius: 1,
      backgroundColor: 'rgba(127,127,127,0.28)',
      overflow: 'hidden',
    },
    progressFill: {
      height: 2,
      width: 44,
    },
    progressFillOnLight: {
      backgroundColor: Colors.text,
    },
    progressFillOnPhoto: {
      backgroundColor: '#FFFFFF',
    },
    progressFillOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    ctaStack: {
      width: '100%',
      height: 52,
    },
    cta: {
      width: '100%',
      height: 52,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    ctaOnPhoto: {
      backgroundColor: '#FFFFFF',
    },
    ctaOnLight: {
      backgroundColor: Colors.primary,
    },
    ctaText: {
      fontSize: 16,
      fontWeight: '600' as const,
    },
    ctaTextOnPhoto: {
      color: '#18181B',
    },
    ctaTextOnLight: {
      color: '#FFFFFF',
    },
  });
