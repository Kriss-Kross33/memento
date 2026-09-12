import { Stack } from "expo-router";
import React, { useMemo } from "react";
import { useThemeColors } from "@/context/ThemeContext";

export default function HomeLayout() {
  const Colors = useThemeColors();
  const screenOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: Colors.background },
      headerShadowVisible: false,
      headerTintColor: Colors.text,
      contentStyle: { backgroundColor: Colors.background },
      headerTitleStyle: {
        fontWeight: "700" as const,
        fontSize: 20,
        color: Colors.text,
      },
    }),
    [Colors]
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="index"
        options={{
          headerTitle: "Memento",
        }}
      />
    </Stack>
  );
}
