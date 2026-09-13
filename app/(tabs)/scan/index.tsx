import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, FileText, Zap, FlipHorizontal, ImagePlus, Scan, FolderOpen } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { useReceipts } from '@/context/ReceiptsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import Button from '@/components/Button';
import PageTray from '@/components/PageTray';
import { toISODate } from '@/components/DatePickerField';
import { isDocumentScannerAvailable, scanReceiptDocuments } from '@/services/documentScanner';
import {
  finalizeScannedReceipt,
  ingestReceiptPages,
  mapParsedToReceiptFields,
} from '@/services/ingest';
import { rasterizePdfPages } from '@/services/ingest/pdf';
import { isPdfInput } from '@/services/ingest/types';
import type { ReceiptMedia } from '@/models/types';
import { MAX_RECEIPT_PAGES } from '@/utils/receipt/limits';

type SessionPage = {
  id: string;
  uri: string;
  source: ReceiptMedia['source'];
};

export default function ScanScreen() {
  const router = useRouter();
  const { addReceipt, defaultCurrency, receipts } = useReceipts();
  const { requestScan, consumeScan } = useSubscription();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Reading receipt…');
  const [captureFailed, setCaptureFailed] = useState(false);
  const [scannerAvailable, setScannerAvailable] = useState(Platform.OS !== 'web');
  const [detectMode, setDetectMode] = useState(Platform.OS !== 'web');
  const [sessionPages, setSessionPages] = useState<SessionPage[]>([]);
  const cameraRef = useRef<CameraView>(null);
  const captureAnim = useRef(new Animated.Value(1)).current;
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  useEffect(() => {
    let cancelled = false;
    void isDocumentScannerAvailable().then((available) => {
      if (cancelled) return;
      setScannerAvailable(available);
      if (!available) setDetectMode(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const animateCapture = () => {
    Animated.sequence([
      Animated.timing(captureAnim, { toValue: 0.88, duration: 90, useNativeDriver: true }),
      Animated.timing(captureAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const haptic = (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(style);
  };

  const fallback = () => ({ date: toISODate(new Date()), currency: defaultCurrency });

  const openReview = (id: string) => {
    router.push(`/receipt/${id}?scanned=1`, { withAnchor: true });
  };

  const openPaywall = () => {
    router.push('/paywall?reason=scans');
  };

  const ensureScanAllowed = async (): Promise<boolean> => {
    const allowed = await requestScan();
    if (allowed) return true;
    openPaywall();
    return false;
  };

  const addPages = (uris: string[], source: ReceiptMedia['source']) => {
    setSessionPages((prev) => {
      const room = MAX_RECEIPT_PAGES - prev.length;
      const next = uris.slice(0, room).map((uri) => ({
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        uri,
        source,
      }));
      return [...prev, ...next];
    });
  };

  const reviewSession = async (saveAnyway = false) => {
    if (sessionPages.length === 0) return;
    if (!(await ensureScanAllowed())) return;
    setIsProcessing(true);
    setProcessingMessage(
      sessionPages.length > 1 ? `Processing page 1 of ${sessionPages.length}…` : 'Reading receipt…'
    );
    try {
      const result = await ingestReceiptPages(
        sessionPages.map((page) => ({ uri: page.uri, source: page.source })),
        fallback(),
        (progress) => setProcessingMessage(progress.message)
      );
      const fields = mapParsedToReceiptFields(result.parsed, fallback(), result.pages.some((page) => page.document));
      const incoming = {
        ...fields,
        media: result.pages[0]?.media,
        sourceMedia: result.pages.map((page) => page.media),
      };
      const finalized = await finalizeScannedReceipt(incoming, receipts, { addReceipt, consumeScan }, { saveAnyway });
      if (finalized.status === 'duplicate') {
        setIsProcessing(false);
        Alert.alert(
          'This looks like a receipt you already saved.',
          'You can open the existing receipt or keep both.',
          [
            {
              text: 'Review existing',
              onPress: () => router.push(`/receipt/${finalized.match.receiptId}`),
            },
            { text: 'Save anyway', onPress: () => void reviewSession(true) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
      if (result.failedIndexes.length > 0) {
        Alert.alert(
          'Some pages could not be read',
          `Page ${result.failedIndexes.map((index) => index + 1).join(', ')} failed. The other pages were kept. You can retry a page from the receipt.`
        );
      }
      setSessionPages([]);
      openReview(finalized.id);
    } catch (error) {
      console.warn('[scan] save failed', error);
      Alert.alert(
        "Receipt couldn't be saved",
        'The receipt was read, but it could not be stored on this device. Try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDetectReceipt = async () => {
    if (isCapturing || isProcessing) return;
    if (!(await ensureScanAllowed())) return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    let uris: string[] = [];
    try {
      uris = await scanReceiptDocuments();
    } catch (error) {
      console.warn('[scan] detect failed', error);
      Alert.alert(
        "Receipt couldn't be detected",
        'Try Detect again, or take a photo with the camera shutter.',
        [
          { text: 'Try Detect again', style: 'cancel' },
          { text: 'Use camera', onPress: () => setDetectMode(false) },
        ]
      );
      return;
    }
    if (uris.length === 0) return;
    addPages(uris, 'camera');
  };

  const handleCapture = async () => {
    if (isCapturing || isProcessing) return;
    if (Platform.OS !== 'web' && sessionPages.length === 0 && !(await ensureScanAllowed())) return;

    setIsCapturing(true);
    animateCapture();
    haptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (Platform.OS === 'web') {
        const id = await addReceipt({
          merchant: '',
          date: toISODate(new Date()),
          amount: 0,
          currency: defaultCurrency,
          category: 'Other',
          notes: '',
        });
        openReview(id);
        return;
      }

      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        throw new Error('capture-failed');
      }
      addPages([photo.uri], 'camera');
    } catch {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Receipt image couldn't be captured",
          'The photo could not be saved. Try again, or enter the receipt manually.',
          [
            { text: 'Try Again', onPress: () => void handleCapture() },
            { text: 'Enter Manually', onPress: handleManualEntry, style: 'cancel' },
          ]
        );
      } else {
        setCaptureFailed(true);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleLibraryImport = async () => {
    if (isCapturing || isProcessing) return;
    if (sessionPages.length === 0 && !(await ensureScanAllowed())) return;
    try {
      const inSession = sessionPages.length > 0;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: inSession,
        selectionLimit: inSession ? Math.max(1, MAX_RECEIPT_PAGES - sessionPages.length) : 1,
      });
      if (result.canceled || !result.assets[0]) return;
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      addPages(
        result.assets.map((asset) => asset.uri),
        'library'
      );
    } catch {
      setCaptureFailed(true);
    }
  };

  const handleFileImport = async () => {
    if (isCapturing || isProcessing) return;
    if (sessionPages.length === 0 && !(await ensureScanAllowed())) return;
    try {
      const DocumentPicker = await import('expo-document-picker');
      const inSession = sessionPages.length > 0;
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: inSession,
      });
      if (result.canceled || !result.assets?.[0]) return;
      for (const asset of result.assets) {
        const input = { kind: 'file' as const, uri: asset.uri, mimeType: asset.mimeType, fileName: asset.name };
        if (isPdfInput(input)) {
          const raster = await rasterizePdfPages(asset.uri);
          if (raster.error) {
            Alert.alert(
              raster.error === 'unsupported'
                ? 'PDF reading needs a native build'
                : raster.error === 'too-many-pages'
                  ? 'This PDF has too many pages'
                  : "This PDF couldn't be read",
              raster.error === 'too-many-pages'
                ? `Memento can read up to ${MAX_RECEIPT_PAGES} pages in one receipt.`
                : 'Try an image, or rebuild the app to enable local PDF reading.'
            );
            continue;
          }
          addPages(raster.uris, 'pdf');
        } else {
          addPages([asset.uri], 'file');
        }
      }
    } catch (error) {
      console.warn('[scan] file import failed', error);
      Alert.alert("File couldn't be imported", 'Try a JPEG, PNG, HEIC, WebP, or PDF.');
    }
  };

  const handleManualEntry = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    router.push('/add-receipt');
  };

  const returnToDetect = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setDetectMode(true);
  };

  const movePage = (id: string, direction: -1 | 1) => {
    setSessionPages((prev) => {
      const index = prev.findIndex((page) => page.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };

  const sessionTray = sessionPages.length > 0 ? (
    <View style={styles.sessionPanel}>
      <PageTray
        pages={sessionPages}
        onAdd={() =>
          Alert.alert('Add another page', 'These pages will become one receipt.', [
            { text: 'Camera', onPress: () => setDetectMode(false) },
            { text: 'Photos', onPress: () => void handleLibraryImport() },
            { text: 'Files', onPress: () => void handleFileImport() },
            { text: 'Cancel', style: 'cancel' },
          ])
        }
        onRemove={(id) => setSessionPages((prev) => prev.filter((page) => page.id !== id))}
        onMove={movePage}
        dark
      />
      <Button
        title={isProcessing ? processingMessage : 'Review'}
        onPress={() => void reviewSession()}
        disabled={isProcessing}
        loading={isProcessing}
        style={styles.reviewButton}
        testID="review-pages-button"
      />
    </View>
  ) : null;

  if (Platform.OS !== 'web' && scannerAvailable && detectMode) {
    return (
      <View style={styles.container}>
        <View style={styles.detectScreen}>
          <View style={styles.detectIcon}>
            <Camera size={44} color="#FFFFFF" strokeWidth={1.8} />
          </View>
          <Text style={styles.detectTitle}>Detect a receipt</Text>
          <Text style={styles.detectText}>
            Point the camera at the receipt. The scanner finds the edges, crops it, then reads the
            details on your device.
          </Text>
          <Button
            title={isProcessing ? processingMessage : sessionPages.length > 0 ? 'Add page' : 'Detect Receipt'}
            onPress={() => void handleDetectReceipt()}
            disabled={isProcessing}
            loading={isProcessing}
            style={styles.detectButton}
            testID="detect-receipt-button"
          />
          {sessionTray}
          <TouchableOpacity
            style={styles.manualEntryLink}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              setDetectMode(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Use the camera shutter"
          >
            <Text style={styles.detectLink}>Or use the camera shutter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualEntryLink}
            onPress={() => void handleLibraryImport()}
            accessibilityRole="button"
            accessibilityLabel="Import a receipt from your photo gallery"
          >
            <Text style={styles.detectLink}>Or import from your gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualEntryLink}
            onPress={() => void handleFileImport()}
            accessibilityRole="button"
            accessibilityLabel="Import a receipt file or PDF"
          >
            <Text style={styles.detectLink}>Or import a file or PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualEntryLink}
            onPress={handleManualEntry}
            accessibilityRole="button"
          >
            <Text style={styles.detectLink}>Or enter receipt manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIcon}>
            <Camera size={44} color={themeColors.textSecondary} strokeWidth={1.8} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Memento needs camera access to scan your receipts. Photos are copied into the app and
            never leave your device.
          </Text>
          <Button
            title="Enable Camera"
            onPress={requestPermission}
            style={styles.permissionButton}
            testID="enable-camera-button"
          />
          {sessionTray}
          <TouchableOpacity
            style={styles.manualEntryLink}
            onPress={() => void handleLibraryImport()}
            testID="permission-library-import"
            accessibilityRole="button"
            accessibilityLabel="Import a receipt from your photo gallery"
          >
            <Text style={styles.manualEntryText}>Or import from your gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualEntryLink}
            onPress={handleManualEntry}
            testID="manual-entry-button"
            accessibilityRole="button"
          >
            <Text style={styles.manualEntryText}>Or enter receipt manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const showFailureBanner = captureFailed && !isProcessing;

  return (
    <View style={styles.container}>
      {Platform.OS !== 'web' ? (
        <View style={styles.camera}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            enableTorch={flash}
          />
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.topControls}>
              <View style={styles.controlsRow}>
                {scannerAvailable ? (
                  <TouchableOpacity
                    style={styles.detectReturnButton}
                    onPress={returnToDetect}
                    accessibilityRole="button"
                    accessibilityLabel="Return to detect receipt"
                    testID="return-to-detect-button"
                  >
                    <Scan size={18} color="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.detectReturnText}>Detect</Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}
                <View style={styles.controlsRight}>
                  <TouchableOpacity
                    style={[styles.controlButton, flash && styles.controlButtonActive]}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setFlash(!flash);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={flash ? 'Turn flash off' : 'Turn flash on'}
                  >
                    <Zap
                      size={20}
                      color={flash ? '#0F172A' : '#FFFFFF'}
                      fill={flash ? '#F59E0B' : 'transparent'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setFacing(facing === 'back' ? 'front' : 'back');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Flip camera"
                  >
                    <FlipHorizontal size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.frameContainer} pointerEvents="none">
              <View style={styles.frameGuide}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.guideText}>
                {sessionPages.length > 0 ? 'Add another page, then review' : 'Position receipt within frame'}
              </Text>
            </View>

            {sessionTray}

            <View style={styles.bottomControls}>
              <TouchableOpacity style={styles.sideAction} onPress={handleManualEntry} accessibilityRole="button" accessibilityLabel="Manual entry">
                <FileText size={22} color="#FFFFFF" strokeWidth={1.8} />
                <Text style={styles.sideActionText}>Manual</Text>
              </TouchableOpacity>

              <Animated.View style={{ transform: [{ scale: captureAnim }] }}>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={() => void handleCapture()}
                  activeOpacity={0.9}
                  disabled={isCapturing || isProcessing}
                  accessibilityRole="button"
                  accessibilityLabel="Capture receipt"
                  testID="capture-button"
                >
                  <View style={styles.captureOuter}>
                    <View style={[styles.captureInner, isCapturing && styles.captureInnerActive]} />
                  </View>
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                style={styles.sideAction}
                onPress={() => void handleLibraryImport()}
                accessibilityRole="button"
                accessibilityLabel="Choose from photo library"
                testID="library-import-button"
              >
                <ImagePlus size={22} color="#FFFFFF" strokeWidth={1.8} />
                <Text style={styles.sideActionText}>Library</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.filesLink}
              onPress={() => void handleFileImport()}
              accessibilityRole="button"
              accessibilityLabel="Import a file or PDF"
            >
              <FolderOpen size={14} color="rgba(255,255,255,0.75)" />
              <Text style={styles.filesLinkText}>Files or PDF</Text>
            </TouchableOpacity>

            <View style={styles.hint}>
              <Text style={styles.hintText}>
                Photos are saved privately on your device. Review details after capture.
              </Text>
            </View>
          </View>

          {isProcessing && (
            <View style={styles.processingOverlay} testID="processing-overlay">
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.processingText}>{processingMessage}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.webFallback}>
          <View style={styles.webContent}>
            <View style={styles.webIconContainer}>
              <Camera size={44} color={themeColors.textTertiary} strokeWidth={1.8} />
            </View>
            <Text style={styles.webTitle}>Receipt Scanner</Text>
            <Text style={styles.webText}>
              The camera preview is limited on web. For the best scanning experience, use the mobile
              app.
            </Text>
            <View style={styles.webActions}>
              <Button title="Capture Receipt" onPress={() => void handleCapture()} testID="web-capture-button" />
              {showFailureBanner ? (
                <Text style={styles.failureText}>Capture failed. Try again or enter manually.</Text>
              ) : null}
              <TouchableOpacity style={styles.webManualLink} onPress={handleManualEntry} accessibilityRole="button">
                <Text style={styles.webManualText}>Enter details manually</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.webManualLink} onPress={() => void handleLibraryImport()} accessibilityRole="button">
                <Text style={styles.webManualText}>Or import from your gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.slate[900],
  },
  detectScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  detectIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  detectTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  detectText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 320,
  },
  detectButton: {
    width: '100%',
    maxWidth: 280,
  },
  detectLink: {
    fontSize: 15,
    color: '#5EEAD4',
    fontWeight: '500' as const,
  },
  sessionPanel: {
    width: '100%',
    maxWidth: 360,
    marginTop: 20,
    gap: 12,
  },
  reviewButton: {
    width: '100%',
  },
  filesLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
  },
  filesLinkText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500' as const,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.background,
  },
  permissionIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 300,
  },
  permissionButton: {
    width: '100%',
    maxWidth: 280,
  },
  manualEntryLink: {
    marginTop: 18,
    padding: 8,
  },
  manualEntryText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  topControls: {
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlsRight: {
    flexDirection: 'row',
    gap: 12,
  },
  detectReturnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  detectReturnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: Colors.warning,
  },
  frameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  frameGuide: {
    width: '100%',
    aspectRatio: 0.7,
    maxHeight: '70%',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Colors.surface,
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  guideText: {
    position: 'absolute',
    bottom: -32,
    alignSelf: 'center',
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500' as const,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingBottom: 16,
  },
  sideAction: {
    alignItems: 'center',
    gap: 6,
    padding: 12,
    width: 76,
  },
  sideActionText: {
    fontSize: 12,
    color: Colors.surface,
    fontWeight: '500' as const,
  },
  captureButton: {
    padding: 4,
  },
  captureOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surface,
  },
  captureInnerActive: {
    backgroundColor: Colors.primary,
  },
  hint: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.surface,
  },
  webFallback: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  webContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  webIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  webTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  webText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  webActions: {
    width: '100%',
    alignItems: 'center',
  },
  failureText: {
    fontSize: 13,
    color: Colors.error,
    marginTop: 12,
    textAlign: 'center',
  },
  webManualLink: {
    marginTop: 16,
    padding: 8,
  },
  webManualText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
});
