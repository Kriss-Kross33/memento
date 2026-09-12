import { Tabs } from "expo-router";
import { Home, Library, Camera, Settings } from "lucide-react-native";
import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/context/ThemeContext";

const TAB_BAR_BASE_HEIGHT = 56;

export default function TabLayout() {
  const Colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.borderLight,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: bottomInset,
          height: TAB_BAR_BASE_HEIGHT + bottomInset,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500' as const,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Home size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Library size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Camera size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Settings size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIcon: {
    transform: [{ scale: 1.05 }],
  },
});
