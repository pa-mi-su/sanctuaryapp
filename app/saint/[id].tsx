// app/saint/[id].tsx
//
// Saint detail page.
// Route: /saint/[id]
// Params: id (required), date (optional YYYY-MM-DD)
//
// ✅ NO language toggle here.
// ✅ Uses global app language via i18n.
// ✅ All user-visible labels translated via t(...), with defaultValue fallbacks.
//
// Uses the auto-generated saintsManifest.ts to load the JSON doc for the saint.

import React, { useMemo } from "react";
import { View, ScrollView, Linking, Pressable } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Text,
  Card,
  Divider,
  Button,
  ActivityIndicator,
} from "react-native-paper";
import { useTranslation } from "react-i18next";

import { getSaintDoc, type SaintDoc } from "../../data/saintsManifest";
import { AppTheme } from "../../utils/theme";

export default function SaintDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();

  const id = typeof params.id === "string" ? params.id : "";
  const date = typeof params.date === "string" ? params.date : undefined;

  const doc: SaintDoc | null = useMemo(() => {
    if (!id) return null;
    return getSaintDoc(id);
  }, [id]);

  const title =
    doc?.name ?? t("saint_title_fallback", { defaultValue: "Saint" });

  const prettySourceLabel = (raw: string) => {
    const s = (raw || "").trim();

    // Wikipedia (any language)
    if (/^https?:\/\/([a-z]{2}\.)?wikipedia\.org\//i.test(s))
      return "Wikipedia";

    // Optional niceties for common sites
    if (/^https?:\/\/www\.vatican\.va\//i.test(s)) return "Vatican.va";
    if (/^https?:\/\/www\.newadvent\.org\//i.test(s)) return "New Advent";
    if (/^https?:\/\/www\.catholic\.org\//i.test(s)) return "Catholic.org";

    // Plain URL? show hostname
    if (/^https?:\/\//i.test(s)) {
      try {
        const host = new URL(s).hostname.replace(/^www\./, "");
        return host;
      } catch {
        return t("source_label_fallback", { defaultValue: "Source" });
      }
    }

    // Not a URL; just show it
    return s || t("source_label_fallback", { defaultValue: "Source" });
  };

  const openIfUrl = async (raw: string) => {
    const s = (raw || "").trim();
    if (!/^https?:\/\//i.test(s)) return;

    try {
      const can = await Linking.canOpenURL(s);
      if (can) await Linking.openURL(s);
    } catch {
      // ignore
    }
  };

  // Safety spinner
  if (!params) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  // ✅ TS-safe locals (avoid "possibly undefined" on doc fields inside JSX)
  const prayers = doc?.prayers ?? [];
  const sources = doc?.sources ?? [];

  return (
    <LinearGradient colors={[...AppTheme.gradients.main]} style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title,
          headerTitleAlign: "center",

          // ✅ Arrow-only back, no "(tabs)"
          headerBackVisible: false,
          headerLeft: () => (
            <Button
              compact
              onPress={() => router.back()}
              contentStyle={{ paddingHorizontal: 0 }}
            >
              ←
            </Button>
          ),
        }}
      />

      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Card style={{ borderRadius: 20 }}>
            <Card.Content>
              <Text variant="headlineSmall" style={{ fontWeight: "800" }}>
                {doc?.name ??
                  t("saint_not_found_title", {
                    defaultValue: "Saint not found",
                  })}
              </Text>

              {date ? (
                <Text style={{ marginTop: 6, opacity: 0.7 }}>
                  {t("date_label", { defaultValue: "Date" })}: {date}
                </Text>
              ) : null}

              {doc?.feast ? (
                <Text style={{ marginTop: 6, opacity: 0.8 }}>
                  {t("feast_label", { defaultValue: "Feast" })}: {doc.feast}
                </Text>
              ) : null}

              {doc?.mmdd ? (
                <Text style={{ marginTop: 6, opacity: 0.6 }}>
                  {t("fixed_date_label", { defaultValue: "Fixed date" })}:{" "}
                  {doc.mmdd}
                </Text>
              ) : null}
            </Card.Content>
          </Card>

          {/* Not found */}
          {!doc ? (
            <Card style={{ borderRadius: 20, marginTop: 14 }}>
              <Card.Content>
                <Text style={{ opacity: 0.8 }}>
                  {t("saint_doc_load_failed", {
                    defaultValue: "I couldn’t load this saint document.",
                  })}
                </Text>

                <Text style={{ marginTop: 8, opacity: 0.6 }}>
                  {t("id_label", { defaultValue: "id" })}:{" "}
                  {id || t("missing_value", { defaultValue: "(missing)" })}
                </Text>

                <Button
                  mode="contained"
                  style={{ marginTop: 14 }}
                  onPress={() => router.back()}
                >
                  {t("go_back", { defaultValue: "Go back" })}
                </Button>
              </Card.Content>
            </Card>
          ) : (
            <>
              {/* Summary */}
              {doc.summary ? (
                <Card style={{ borderRadius: 20, marginTop: 14 }}>
                  <Card.Content>
                    <Text variant="titleMedium" style={{ fontWeight: "800" }}>
                      {t("summary", { defaultValue: "Summary" })}
                    </Text>
                    <Divider style={{ marginTop: 10 }} />
                    <Text style={{ marginTop: 12, lineHeight: 20 }}>
                      {doc.summary}
                    </Text>
                  </Card.Content>
                </Card>
              ) : null}

              {/* Biography */}
              {doc.biography ? (
                <Card style={{ borderRadius: 20, marginTop: 14 }}>
                  <Card.Content>
                    <Text variant="titleMedium" style={{ fontWeight: "800" }}>
                      {t("biography", { defaultValue: "Biography" })}
                    </Text>
                    <Divider style={{ marginTop: 10 }} />
                    <Text style={{ marginTop: 12, lineHeight: 20 }}>
                      {doc.biography}
                    </Text>
                  </Card.Content>
                </Card>
              ) : null}

              {/* Prayers */}
              {prayers.length > 0 ? (
                <Card style={{ borderRadius: 20, marginTop: 14 }}>
                  <Card.Content>
                    <Text variant="titleMedium" style={{ fontWeight: "800" }}>
                      {t("prayers", { defaultValue: "Prayers" })}
                    </Text>
                    <Divider style={{ marginTop: 10 }} />

                    {prayers.map((p, idx) => (
                      <View key={`${idx}-${String(p).slice(0, 12)}`}>
                        <Text style={{ marginTop: 12, lineHeight: 20 }}>
                          {p}
                        </Text>
                        {idx !== prayers.length - 1 ? (
                          <Divider style={{ marginTop: 12, opacity: 0.4 }} />
                        ) : null}
                      </View>
                    ))}
                  </Card.Content>
                </Card>
              ) : null}

              {/* Sources */}
              {sources.length > 0 ? (
                <Card style={{ borderRadius: 20, marginTop: 14 }}>
                  <Card.Content>
                    <Text variant="titleMedium" style={{ fontWeight: "800" }}>
                      {t("sources", { defaultValue: "Sources" })}
                    </Text>
                    <Divider style={{ marginTop: 10 }} />

                    {sources.map((s) => {
                      const raw = (s || "").trim();
                      const isUrl = /^https?:\/\//i.test(raw);
                      const label = prettySourceLabel(raw);

                      return (
                        <View key={raw || label} style={{ marginTop: 10 }}>
                          {isUrl ? (
                            <Pressable onPress={() => openIfUrl(raw)}>
                              <Text
                                style={{
                                  opacity: 0.9,
                                  textDecorationLine: "underline",
                                }}
                              >
                                • {label}
                              </Text>
                              <Text
                                style={{
                                  marginTop: 4,
                                  opacity: 0.6,
                                  fontSize: 12,
                                }}
                              >
                                {raw}
                              </Text>
                            </Pressable>
                          ) : (
                            <Text style={{ opacity: 0.8 }}>• {label}</Text>
                          )}
                        </View>
                      );
                    })}
                  </Card.Content>
                </Card>
              ) : null}

              {/* Stub notice */}
              {!doc.summary && !doc.biography && prayers.length === 0 ? (
                <Card style={{ borderRadius: 20, marginTop: 14 }}>
                  <Card.Content>
                    <Text style={{ opacity: 0.8 }}>
                      {t("saint_stub_notice", {
                        defaultValue: "This saint page is a stub right now.",
                      })}
                    </Text>
                    <Text style={{ marginTop: 8, opacity: 0.6 }}>
                      {t("saint_stub_next_step", {
                        defaultValue:
                          "Next step: enrich the generated JSON with summary, biography, and prayers.",
                      })}
                    </Text>
                  </Card.Content>
                </Card>
              ) : null}

              <Button
                mode="text"
                style={{ marginTop: 16 }}
                onPress={() => router.back()}
              >
                {t("back", { defaultValue: "Back" })}
              </Button>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
