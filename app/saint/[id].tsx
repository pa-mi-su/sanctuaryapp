// app/saint/[id].tsx
//
// Saint detail page.
// Route: /saint/[id]
// Params: id (required), date (optional YYYY-MM-DD)
//
// Uses the auto-generated saintsManifest.ts to load the JSON doc for the saint.
//

import React, { useMemo } from "react";
import { View, ScrollView } from "react-native";
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

import { getSaintDoc, type SaintDoc } from "../../data/saintsManifest";

export default function SaintDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();

  const id = typeof params.id === "string" ? params.id : "";
  const date = typeof params.date === "string" ? params.date : undefined;

  const doc: SaintDoc | null = useMemo(() => {
    if (!id) return null;
    return getSaintDoc(id);
  }, [id]);

  const title = doc?.name ?? "Saint";

  // If the route is loading weirdly, show a minimal spinner.
  if (!params) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient
      colors={["#4b2e83", "#6a4c93", "#b185db"]}
      style={{ flex: 1 }}
    >
      <Stack.Screen
        options={{
          title,
          headerBackTitle: "Saints",
        }}
      />

      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header Card */}
          <Card style={{ borderRadius: 20 }}>
            <Card.Content>
              <Text variant="headlineSmall" style={{ fontWeight: "800" }}>
                {doc?.name ?? "Saint not found"}
              </Text>

              {date ? (
                <Text style={{ marginTop: 6, opacity: 0.7 }}>Date: {date}</Text>
              ) : null}

              {doc?.feast ? (
                <Text style={{ marginTop: 6, opacity: 0.8 }}>
                  Feast: {doc.feast}
                </Text>
              ) : null}

              {doc?.mmdd ? (
                <Text style={{ marginTop: 6, opacity: 0.6 }}>
                  Fixed date: {doc.mmdd}
                </Text>
              ) : null}
            </Card.Content>
          </Card>

          {/* Not found */}
          {!doc ? (
            <Card style={{ borderRadius: 20, marginTop: 14 }}>
              <Card.Content>
                <Text style={{ opacity: 0.8 }}>
                  I couldn’t load this saint document.
                </Text>
                <Text style={{ marginTop: 8, opacity: 0.6 }}>
                  id: {id || "(missing)"}
                </Text>

                <Button
                  mode="contained"
                  style={{ marginTop: 14 }}
                  onPress={() => router.back()}
                >
                  Go back
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
                      Summary
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
                      Biography
                    </Text>
                    <Divider style={{ marginTop: 10 }} />
                    <Text style={{ marginTop: 12, lineHeight: 20 }}>
                      {doc.biography}
                    </Text>
                  </Card.Content>
                </Card>
              ) : null}

              {/* Prayers */}
              {doc.prayers && doc.prayers.length > 0 ? (
                <Card style={{ borderRadius: 20, marginTop: 14 }}>
                  <Card.Content>
                    <Text variant="titleMedium" style={{ fontWeight: "800" }}>
                      Prayers
                    </Text>
                    <Divider style={{ marginTop: 10 }} />

                    {doc.prayers.map((p, idx) => (
                      <View key={`${idx}-${p.slice(0, 12)}`}>
                        <Text style={{ marginTop: 12, lineHeight: 20 }}>
                          {p}
                        </Text>
                        {idx !== doc.prayers!.length - 1 ? (
                          <Divider style={{ marginTop: 12, opacity: 0.4 }} />
                        ) : null}
                      </View>
                    ))}
                  </Card.Content>
                </Card>
              ) : null}

              {/* Sources */}
              {doc.sources && doc.sources.length > 0 ? (
                <Card style={{ borderRadius: 20, marginTop: 14 }}>
                  <Card.Content>
                    <Text variant="titleMedium" style={{ fontWeight: "800" }}>
                      Sources
                    </Text>
                    <Divider style={{ marginTop: 10 }} />
                    {doc.sources.map((s) => (
                      <Text key={s} style={{ marginTop: 10, opacity: 0.8 }}>
                        • {s}
                      </Text>
                    ))}
                  </Card.Content>
                </Card>
              ) : null}

              {/* If the doc is mostly empty, show a friendly stub */}
              {!doc.summary &&
              !doc.biography &&
              (!doc.prayers || doc.prayers.length === 0) ? (
                <Card style={{ borderRadius: 20, marginTop: 14 }}>
                  <Card.Content>
                    <Text style={{ opacity: 0.8 }}>
                      This saint page is a stub right now.
                    </Text>
                    <Text style={{ marginTop: 8, opacity: 0.6 }}>
                      Next step: enrich the generated JSON with summary,
                      biography, and prayers.
                    </Text>
                  </Card.Content>
                </Card>
              ) : null}

              <Button
                mode="text"
                style={{ marginTop: 16 }}
                onPress={() => router.back()}
              >
                Back
              </Button>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
