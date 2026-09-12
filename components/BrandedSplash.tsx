import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ICON = require('../assets/images/splash-icon.png');
const SPLASH_BG = '#10151F';

const APP_NAME = Constants.expoConfig?.name ?? 'ReceiptSnap';
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/**
 * Continues the native splash (icon on #10151F) with the app name and version.
 * Android 12+ system splash cannot draw custom text, so this view takes over
 * as soon as it lays out.
 */
export default function BrandedSplash() {
  const insets = useSafeAreaInsets();

  const hideNative = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.screen} onLayout={hideNative}>
      <StatusBar style="light" backgroundColor={SPLASH_BG} />
      <View style={styles.center}>
        <Image source={ICON} style={styles.icon} contentFit="contain" />
        <Text style={styles.name}>{APP_NAME}</Text>
      </View>
      <Text style={[styles.version, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
        {APP_VERSION}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SPLASH_BG,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  icon: {
    width: 160,
    height: 160,
  },
  name: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: '#FFFFFF',
  },
  version: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.42)',
    fontVariant: ['tabular-nums'],
  },
});
