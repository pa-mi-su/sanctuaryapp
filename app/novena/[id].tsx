// app/novena/[id].tsx
//
// Novena detail page.
// Route: /novena/[id]
// Params: id (required), date (optional YYYY-MM-DD)
//
// ✅ NO language toggle here.
// ✅ Uses global app language via i18n.
// ✅ All user-visible labels translated via t(...), with defaultValue fallbacks.

import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Card, Button, Divider } from "react-native-paper";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";

import { getNovenaContent } from "../../data/novenasManifest";
import { AppTheme } from "../../utils/theme";

type NovenaDay = {
  day: number;
  title?: string;
  scripture?: string;
  prayer?: string;
  reflection?: string;
};

function paramToString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

function extractDays(doc: any): NovenaDay[] {
  if (!doc) return [];
  if (Array.isArray(doc.days)) return doc.days;
  if (doc.content && Array.isArray(doc.content.days)) return doc.content.days;
  return [];
}

/**
 * Strip leaked CSS that sometimes appears in scraped prayer content.
 */
function stripLeakedCss(raw?: string): string | undefined {
  if (!raw) return raw;

  const lines = raw.split(/\r?\n/);
  const kept: string[] = [];

  for (const line of lines) {
    const s = line.trim();
    if (!s) {
      kept.push("");
      continue;
    }

    const looksLikeCss =
      s.startsWith("@media") ||
      s.startsWith("#") ||
      s.startsWith(".") ||
      (s.includes("{") && s.includes("}")) ||
      (s.includes("{") && s.includes(":")) ||
      s.includes("!important") ||
      s.includes("font-size:") ||
      s.includes("padding:") ||
      s.includes("max-width:");

    const justBraces = s === "{" || s === "}" || s === "}}";

    if (looksLikeCss || justBraces) continue;

    kept.push(line);
  }

  const out = kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out.length ? out : undefined;
}

export default function NovenaDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();

  const id = paramToString(params.id) ?? "";
  const date = paramToString(params.date);

  const novena = useMemo(() => (id ? getNovenaContent(id) : null), [id]);
  const days = useMemo(() => extractDays(novena), [novena]);

  const [selectedDay, setSelectedDay] = useState<number>(1);

  useEffect(() => {
    setSelectedDay(days.length > 0 ? days[0].day : 1);
  }, [id, days.length]);

  const day = days.find((d) => d.day === selectedDay);

  const headerTitle = novena?.title
    ? String(novena.title)
    : t("novena_title_fallback", { defaultValue: "Novena" });

  const cleaned = useMemo(() => {
    if (!day) return {};
    return {
      scripture: stripLeakedCss(day.scripture),
      prayer: stripLeakedCss(day.prayer),
      reflection: stripLeakedCss(day.reflection),
    };
  }, [day]);

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerTitleAlign: "center",

          // Arrow-only back, no "(tabs)"
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

      <LinearGradient colors={[...AppTheme.gradients.main]} style={{ flex: 1 }}>
        {!novena ? (
          <SafeAreaView style={{ flex: 1, padding: 20 }}>
            <Text
              variant="headlineMedium"
              style={{ color: "white", fontWeight: "800" }}
            >
              {t("novena_not_found", { defaultValue: "Novena not found" })}
            </Text>

            <Text style={{ marginTop: 10, opacity: 0.85, color: "white" }}>
              {t("novena_missing_file_for", {
                defaultValue: "No content file exists for:",
              })}
            </Text>

            <Text style={{ marginTop: 4, fontWeight: "800", color: "white" }}>
              {id}
            </Text>

            <Button
              style={{ marginTop: 20 }}
              mode="contained"
              onPress={router.back}
            >
              {t("close", { defaultValue: "Close" })}
            </Button>
          </SafeAreaView>
        ) : (
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            >
              {/* Title */}
              <Text
                variant="headlineMedium"
                style={{ fontWeight: "900", color: "white" }}
              >
                {novena.title}
              </Text>

              {date ? (
                <Text style={{ marginTop: 6, opacity: 0.85, color: "white" }}>
                  {t("selected_date", { defaultValue: "Selected date" })}:{" "}
                  {date}
                </Text>
              ) : null}

              {novena.description ? (
                <Text style={{ marginTop: 12, opacity: 0.9, color: "white" }}>
                  {novena.description}
                </Text>
              ) : null}

              {/* Day picker */}
              {days.length > 0 ? (
                <>
                  <Text
                    style={{ marginTop: 20, fontWeight: "800", color: "white" }}
                  >
                    {t("choose_a_day", { defaultValue: "Choose a day" })}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      marginTop: 10,
                    }}
                  >
                    {days.map((d) => {
                      const active = d.day === selectedDay;
                      return (
                        <TouchableOpacity
                          key={d.day}
                          onPress={() => setSelectedDay(d.day)}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 20,
                            marginRight: 8,
                            marginBottom: 8,
                            backgroundColor: active
                              ? "rgba(255,255,255,0.22)"
                              : "rgba(255,255,255,0.12)",
                            borderWidth: active ? 2 : 1,
                            borderColor: active
                              ? "rgba(255,255,255,0.65)"
                              : "rgba(255,255,255,0.25)",
                          }}
                        >
                          <Text style={{ fontWeight: "800", color: "white" }}>
                            {t("day_label", { defaultValue: "Day" })} {d.day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Divider style={{ marginVertical: 16, opacity: 0.35 }} />

                  {/* Day content */}
                  {day ? (
                    <Card
                      style={{
                        borderRadius: 18,
                        backgroundColor: "rgba(255,255,255,0.96)",
                      }}
                    >
                      <Card.Content>
                        <Text
                          variant="titleLarge"
                          style={{ fontWeight: "900" }}
                        >
                          {t("day_label", { defaultValue: "Day" })} {day.day}
                          {day.title ? ` — ${day.title}` : ""}
                        </Text>

                        {cleaned.scripture ? (
                          <>
                            <Text style={{ marginTop: 14, fontWeight: "800" }}>
                              {t("scripture", { defaultValue: "Scripture" })}
                            </Text>
                            <Text style={{ marginTop: 6, lineHeight: 20 }}>
                              {cleaned.scripture}
                            </Text>
                          </>
                        ) : null}

                        {cleaned.prayer ? (
                          <>
                            <Text style={{ marginTop: 14, fontWeight: "800" }}>
                              {t("prayer", { defaultValue: "Prayer" })}
                            </Text>
                            <Text style={{ marginTop: 6, lineHeight: 20 }}>
                              {cleaned.prayer}
                            </Text>
                          </>
                        ) : null}

                        {cleaned.reflection ? (
                          <>
                            <Text style={{ marginTop: 14, fontWeight: "800" }}>
                              {t("reflection", {
                                defaultValue: "Reflection",
                              })}
                            </Text>
                            <Text style={{ marginTop: 6, lineHeight: 20 }}>
                              {cleaned.reflection}
                            </Text>
                          </>
                        ) : null}

                        {!cleaned.scripture &&
                        !cleaned.prayer &&
                        !cleaned.reflection ? (
                          <Text style={{ marginTop: 12, opacity: 0.7 }}>
                            {t("no_day_content_found", {
                              defaultValue:
                                "No day content found for this novena.",
                            })}
                          </Text>
                        ) : null}
                      </Card.Content>
                    </Card>
                  ) : (
                    <Text
                      style={{ marginTop: 14, opacity: 0.85, color: "white" }}
                    >
                      {t("no_day_content_found", {
                        defaultValue: "No day content found for this novena.",
                      })}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={{ marginTop: 14, opacity: 0.85, color: "white" }}>
                  {t("no_day_content_found", {
                    defaultValue: "No day content found for this novena.",
                  })}
                </Text>
              )}

              <Button
                style={{ marginTop: 24 }}
                mode="outlined"
                textColor="white"
                onPress={router.back}
              >
                {t("back", { defaultValue: "Back" })}
              </Button>
            </ScrollView>
          </SafeAreaView>
        )}
      </LinearGradient>
    </>
  );
}
