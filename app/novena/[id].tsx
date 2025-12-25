// app/novena/[id].tsx

import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Card, Button, Divider } from "react-native-paper";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { getNovenaContent } from "../../data/novenasManifest";

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

export default function NovenaDetailScreen() {
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

  const headerTitle = novena?.title ?? "Novena";

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle, // ✅ replaces "novena/[id]"
          headerBackTitleVisible: false, // ✅ removes "(tabs)" label
          headerBackTitle: "", // ✅ force blank back label
          headerTitleAlign: "center",
        }}
      />

      {!novena ? (
        <SafeAreaView style={{ flex: 1, padding: 20 }}>
          <Text variant="headlineMedium">Novena not found</Text>
          <Text style={{ marginTop: 10, opacity: 0.7 }}>
            No content file exists for:
          </Text>
          <Text style={{ marginTop: 4, fontWeight: "700" }}>{id}</Text>

          <Button
            style={{ marginTop: 20 }}
            mode="contained"
            onPress={router.back}
          >
            Back
          </Button>
        </SafeAreaView>
      ) : (
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          >
            <Text variant="headlineMedium" style={{ fontWeight: "800" }}>
              {novena.title}
            </Text>

            {date ? (
              <Text style={{ marginTop: 6, opacity: 0.7 }}>
                Selected date: {date}
              </Text>
            ) : null}

            {novena.description ? (
              <Text style={{ marginTop: 12 }}>{novena.description}</Text>
            ) : null}

            {days.length > 0 ? (
              <>
                <Text style={{ marginTop: 20, fontWeight: "700" }}>
                  Choose a day
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
                            ? "rgba(106,76,147,0.25)"
                            : "rgba(106,76,147,0.1)",
                          borderWidth: active ? 2 : 1,
                          borderColor: active
                            ? "rgba(106,76,147,0.7)"
                            : "rgba(106,76,147,0.2)",
                        }}
                      >
                        <Text style={{ fontWeight: "700" }}>Day {d.day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Divider style={{ marginVertical: 16 }} />

                {day ? (
                  <Card style={{ borderRadius: 16 }}>
                    <Card.Content>
                      <Text variant="titleLarge" style={{ fontWeight: "800" }}>
                        Day {day.day}
                        {day.title ? ` — ${day.title}` : ""}
                      </Text>

                      {day.scripture ? (
                        <>
                          <Text style={{ marginTop: 14, fontWeight: "700" }}>
                            Scripture
                          </Text>
                          <Text style={{ marginTop: 6 }}>{day.scripture}</Text>
                        </>
                      ) : null}

                      {day.prayer ? (
                        <>
                          <Text style={{ marginTop: 14, fontWeight: "700" }}>
                            Prayer
                          </Text>
                          <Text style={{ marginTop: 6 }}>{day.prayer}</Text>
                        </>
                      ) : null}

                      {day.reflection ? (
                        <>
                          <Text style={{ marginTop: 14, fontWeight: "700" }}>
                            Reflection
                          </Text>
                          <Text style={{ marginTop: 6 }}>{day.reflection}</Text>
                        </>
                      ) : null}
                    </Card.Content>
                  </Card>
                ) : (
                  <Text style={{ marginTop: 14, opacity: 0.7 }}>
                    No day content found for this novena.
                  </Text>
                )}
              </>
            ) : (
              <Text style={{ marginTop: 14, opacity: 0.7 }}>
                No day content found for this novena.
              </Text>
            )}

            <Button
              style={{ marginTop: 24 }}
              mode="contained"
              onPress={router.back}
            >
              Back
            </Button>
          </ScrollView>
        </SafeAreaView>
      )}
    </>
  );
}
