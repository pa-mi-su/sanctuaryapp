// app/(tabs)/about.tsx
//
// About tab (Sanctuary branding)
// - Quick explanation of what each tab does
// - Sources + disclaimers
// - Useful links
//
// ✅ NO language toggle here.
// ✅ Uses global app language via i18n (whatever user picked on Home).
// ✅ Keeps the same Sanctuary gradient + card style.

import React, { useCallback } from "react";
import { View, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Card, Text, Divider, Button } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { AppTheme } from "../../utils/theme";

export default function AboutScreen() {
  const { t } = useTranslation();

  const openUrl = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  return (
    <LinearGradient colors={[...AppTheme.gradients.main]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text
          variant="headlineMedium"
          style={{ color: "white", fontWeight: "800" }}
        >
          {t("tabs_about")}{" "}
          {AppTheme.brandName ? `• ${AppTheme.brandName}` : ""}
        </Text>

        <Text style={{ color: "white", opacity: 0.85, marginTop: 6 }}>
          {t("about_subtitle", {
            defaultValue:
              "A simple, focused Catholic companion: liturgical seasons, saints, and novenas — with daily readings one tap away.",
          })}
        </Text>

        <View style={{ marginTop: 14, gap: 12 }}>
          <Card style={{ borderRadius: 18 }}>
            <Card.Content>
              <Text variant="titleMedium" style={{ fontWeight: "800" }}>
                {t("about_whats_in_app", { defaultValue: "What’s in the app" })}
              </Text>
              <Divider style={{ marginTop: 10 }} />

              <Text style={{ marginTop: 10, opacity: 0.85 }}>
                • <Text style={{ fontWeight: "800" }}>{t("liturgical")}</Text>:{" "}
                {t("about_liturgical_desc", {
                  defaultValue:
                    "seasons + major celebrations that shape the Church year.",
                })}
              </Text>

              <Text style={{ marginTop: 6, opacity: 0.85 }}>
                • <Text style={{ fontWeight: "800" }}>{t("saints")}</Text>:{" "}
                {t("about_saints_desc", {
                  defaultValue: "saint of the day + other saints commemorated.",
                })}
              </Text>

              <Text style={{ marginTop: 6, opacity: 0.85 }}>
                • <Text style={{ fontWeight: "800" }}>{t("novenas")}</Text>:{" "}
                {t("about_novenas_desc", {
                  defaultValue:
                    "novenas that start today + related feast days.",
                })}
              </Text>
            </Card.Content>
          </Card>

          <Card style={{ borderRadius: 18 }}>
            <Card.Content>
              <Text variant="titleMedium" style={{ fontWeight: "800" }}>
                {t("about_daily_readings", { defaultValue: "Daily readings" })}
              </Text>
              <Divider style={{ marginTop: 10 }} />

              <Text style={{ marginTop: 10, opacity: 0.85 }}>
                {t("about_daily_readings_body", {
                  defaultValue:
                    "We link to the official USCCB daily readings by date.",
                })}
              </Text>

              <Button
                mode="contained"
                style={{ marginTop: 12 }}
                onPress={() =>
                  openUrl("https://bible.usccb.org/bible/readings/")
                }
              >
                {t("about_open_usccb_readings", {
                  defaultValue: "Open USCCB Readings",
                })}
              </Button>
            </Card.Content>
          </Card>

          <Card style={{ borderRadius: 18 }}>
            <Card.Content>
              <Text variant="titleMedium" style={{ fontWeight: "800" }}>
                {t("about_notes_disclaimer", {
                  defaultValue: "Notes & disclaimer",
                })}
              </Text>
              <Divider style={{ marginTop: 10 }} />

              <Text style={{ marginTop: 10, opacity: 0.85 }}>
                {t("about_disclaimer_1", {
                  defaultValue:
                    "This app is not an official publication of the USCCB or the Holy See. It’s a devotional aid built to be helpful and practical.",
                })}
              </Text>

              <Text style={{ marginTop: 10, opacity: 0.85 }}>
                {t("about_disclaimer_2", {
                  defaultValue:
                    "If a parish/diocese observes a transferred feast or local proper, always follow local guidance.",
                })}
              </Text>
            </Card.Content>
          </Card>

          <Card style={{ borderRadius: 18 }}>
            <Card.Content>
              <Text variant="titleMedium" style={{ fontWeight: "800" }}>
                {t("about_helpful_links", { defaultValue: "Helpful links" })}
              </Text>
              <Divider style={{ marginTop: 10 }} />

              <Button
                mode="outlined"
                style={{ marginTop: 12 }}
                onPress={() =>
                  openUrl("https://bible.usccb.org/daily-bible-reading")
                }
              >
                {t("about_usccb_daily_bible_reading", {
                  defaultValue: "USCCB Daily Bible Reading",
                })}
              </Button>

              <Button
                mode="outlined"
                style={{ marginTop: 10 }}
                onPress={() => openUrl("https://mycatholic.life/liturgy/")}
              >
                {t("about_liturgical_reference", {
                  defaultValue: "Liturgical calendar reference",
                })}
              </Button>
            </Card.Content>
          </Card>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
