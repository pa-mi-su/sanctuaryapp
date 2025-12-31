// app/(tabs)/index.tsx
import React, { useMemo, useState, useCallback } from "react";
import { ImageBackground, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Card, Button } from "react-native-paper";
import { useTranslation } from "react-i18next";

import i18n, { setLanguage, type AppLang } from "../../i18n";

const background = require("../../assets/images/bg.jpg");

export default function HomeScreen() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const currentLang = useMemo<AppLang>(() => {
    const lng = (i18n.language || "en").toLowerCase();
    if (lng.startsWith("es")) return "es";
    if (lng.startsWith("pl")) return "pl";
    if (lng.startsWith("tl")) return "tl";
    return "en";
  }, [i18n.language]);

  const onChangeLang = useCallback(
    async (lang: AppLang) => {
      if (busy || lang === currentLang) return;
      setBusy(true);
      try {
        await setLanguage(lang);
      } finally {
        setBusy(false);
      }
    },
    [busy, currentLang],
  );

  // Data-driven so all screens can reuse the same list later
  const langButtons = useMemo(
    () =>
      [
        { code: "en" as const, label: t("english") },
        { code: "es" as const, label: t("spanish") },
        { code: "pl" as const, label: t("polish") },
        { code: "tl" as const, label: t("tagalog") },
      ] satisfies Array<{ code: AppLang; label: string }>,
    [t],
  );

  return (
    <ImageBackground source={background} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}>
        <View style={{ flex: 1, padding: 24 }}>
          {/* Centered title block */}
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 12,
            }}
          >
            <Text
              variant="headlineLarge"
              style={{
                color: "white",
                fontWeight: "700",
                marginBottom: 12,
                letterSpacing: 0.5,
                textAlign: "center",
              }}
            >
              Sanctuary
            </Text>

            <Text
              style={{
                color: "rgba(255,255,255,0.82)",
                fontSize: 15,
                lineHeight: 22,
                textAlign: "center",
                maxWidth: 340,
              }}
            >
              {t("home_subtitle")}
            </Text>
          </View>

          {/* Bottom language selector */}
          <Card
            style={{
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.95)",
            }}
          >
            <Card.Content>
              <Text
                variant="labelLarge"
                style={{ fontWeight: "700", marginBottom: 10 }}
              >
                {t("language")}
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {langButtons.map((b) => (
                  <Button
                    key={b.code}
                    compact
                    mode={currentLang === b.code ? "contained" : "text"}
                    onPress={() => onChangeLang(b.code)}
                    disabled={busy}
                    style={{ marginRight: 8, marginBottom: 6 }}
                  >
                    {b.label}
                  </Button>
                ))}
              </View>
            </Card.Content>
          </Card>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
