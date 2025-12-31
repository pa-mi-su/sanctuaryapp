// components/SeasonLegend.tsx
//
// Small legend row: "Advent • Christmas • Lent • Easter • Ordinary Time"
// Uses AppTheme season outline colors.
// Keep it subtle so it doesn't clutter the screen.

import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "react-native-paper";
import { AppTheme, type LiturgicalSeason } from "@/utils/theme";

type Props = {
  // Optional: hide/show certain seasons if a screen doesn't need all of them.
  seasons?: LiturgicalSeason[];

  // ✅ Allows caller to move the legend up/down without editing this component again.
  style?: StyleProp<ViewStyle>;
};

const DEFAULT: LiturgicalSeason[] = [
  "Advent",
  "Christmas",
  "Lent",
  "Easter",
  "Ordinary Time",
];

export function SeasonLegend({ seasons = DEFAULT, style }: Props) {
  return (
    <View
      style={[
        {
          marginTop: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.18)",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 10,
        },
        style,
      ]}
    >
      {seasons.map((s) => {
        const c = AppTheme.seasons[s];
        return (
          <View
            key={s}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: c,
                backgroundColor: "transparent",
              }}
            />
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
              {s}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
