// app/_layout.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import {
  MD3LightTheme as PaperLightTheme,
  MD3DarkTheme as PaperDarkTheme,
  Provider as PaperProvider,
} from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { initI18n } from "../i18n";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    initI18n()
      .catch((e) => {
        console.warn("i18n init failed:", e);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const isDark = (colorScheme ?? "light") === "dark";

  const paperTheme = useMemo(() => {
    const base = isDark ? PaperDarkTheme : PaperLightTheme;

    return {
      ...base,
      colors: {
        ...base.colors,
        primary: "#6a4c93",
        secondary: "#ffb4a2",
      },
    };
  }, [isDark]);

  const navTheme = isDark ? NavDarkTheme : NavLightTheme;

  // Don’t render app until i18n is initialized
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <ThemeProvider value={navTheme}>
          <Stack
            screenOptions={{
              headerTitleAlign: "center",
              headerTintColor: isDark ? "#fff" : "#111",
              headerStyle: {
                backgroundColor: isDark ? "#0B1320" : "#fff",
              },
              contentStyle: {
                backgroundColor: isDark ? "#0B1320" : "#fff",
              },
            }}
          >
            <Stack.Screen
              name="(tabs)"
              options={{
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
          </Stack>

          <StatusBar style={isDark ? "light" : "dark"} />
        </ThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
