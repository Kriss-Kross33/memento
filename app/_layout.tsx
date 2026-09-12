import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ReceiptsProvider, useReceipts } from "@/context/ReceiptsContext";
import {
  ThemeProvider,
  useThemeColors,
  useThemeMode,
} from "@/context/ThemeContext";
import BrandedSplash from "@/components/BrandedSplash";
import Onboarding from "./onboarding";

SplashScreen.preventAutoHideAsync();

const SPLASH_MIN_MS = 800;

export const unstable_settings = {
  anchor: "(tabs)",
};

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { hasOnboarded, isSettingsLoaded } = useReceipts();
  const { mode, isLoaded: isThemeLoaded } = useThemeMode();
  const Colors = useThemeColors();
  const statusBarStyle = mode === "dark" ? "light" : "dark";
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(Colors.background);
  }, [Colors.background]);

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!isSettingsLoaded || !isThemeLoaded || !minSplashElapsed) {
    return <BrandedSplash />;
  }

  if (!hasOnboarded) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <StatusBar style={statusBarStyle} backgroundColor={Colors.background} />
        <Onboarding />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar style={statusBarStyle} backgroundColor={Colors.background} />
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="receipt/[id]"
          options={{
            presentation: "card",
            headerTitle: "Receipt Details",
            headerTintColor: Colors.text,
            headerBackVisible: true,
          }}
        />
        <Stack.Screen
          name="categories"
          options={{
            presentation: "modal",
            headerTitle: "Categories",
            headerTintColor: Colors.text,
          }}
        />
        <Stack.Screen
          name="export"
          options={{
            presentation: "modal",
            headerTitle: "Export Data",
            headerTintColor: Colors.text,
          }}
        />
        <Stack.Screen
          name="insights"
          options={{
            presentation: "modal",
            headerTitle: "Insights",
            headerTintColor: Colors.text,
          }}
        />
        <Stack.Screen
          name="preview"
          options={{
            presentation: "modal",
            headerTitle: "Preview",
            headerTintColor: Colors.text,
          }}
        />
        <Stack.Screen
          name="protection"
          options={{
            presentation: "card",
            headerTitle: "Warranties & Returns",
            headerTintColor: Colors.text,
          }}
        />
        {__DEV__ ? (
          <Stack.Screen
            name="dev/ocr-lab"
            options={{
              presentation: "card",
              headerTitle: "OCR Lab",
              headerTintColor: Colors.text,
            }}
          />
        ) : null}
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <ReceiptsProvider>
              <RootLayoutNav />
            </ReceiptsProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
