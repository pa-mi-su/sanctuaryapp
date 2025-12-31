// app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

import { useTranslation } from "react-i18next";

type TabIconProps = { color: string };

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? "light"].tint;

  const { t, i18n } = useTranslation();

  return (
    <Tabs
      // Guarantees tab titles update immediately on language change
      key={(i18n.language || "en").toLowerCase()}
      screenOptions={{
        tabBarActiveTintColor: tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs_home"),
          tabBarIcon: ({ color }: TabIconProps) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="novenas"
        options={{
          title: t("tabs_novenas"),
          tabBarIcon: ({ color }: TabIconProps) => (
            <IconSymbol size={28} name="book.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="liturgical"
        options={{
          title: t("tabs_liturgical"),
          tabBarIcon: ({ color }: TabIconProps) => (
            <IconSymbol size={28} name="calendar" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="saints"
        options={{
          title: t("tabs_saints"),
          tabBarIcon: ({ color }: TabIconProps) => (
            <IconSymbol size={28} name="person.3.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="about"
        options={{
          title: t("tabs_about"),
          tabBarIcon: ({ color }: TabIconProps) => (
            <IconSymbol size={28} name="info.circle.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
