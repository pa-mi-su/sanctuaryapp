// app/(tabs)/liturgical.tsx
//
// Liturgical tab = "liturgical calendar"
// Data sources:
// 1) Fixed observances from scrape: data/saints_by_mmdd.json (use feast field)
// 2) Movable observances from rules: utils/movableFeastsRules.ts
//
// Saints tab must NOT show movable feasts; they live here.

import React, { useMemo, useState, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Portal, Modal, Card, Text, Divider, Button } from "react-native-paper";

import { MonthGrid } from "@/components/MonthGrid";

import saintsByMmdd from "../../data/saints_by_mmdd.json";
import { computeMovableFeastsForYear } from "../../utils/movableFeastsRules";

type DaySaints = { feast: string | null; saints: string[] };

type SelectedDay = {
  dateKey: string; // YYYY-MM-DD
  fixed: { title: string; rank: string } | null;
  movable: string[];
};

function toMmdd(dateKey: string) {
  const parts = dateKey.split("-");
  return `${parts[1]}-${parts[2]}`;
}

/**
 * Extract rank from a label like:
 *   "Solemnity of Mary, Mother of God—Solemnity"
 *   "Saints Basil...—Memorial"
 *
 * If no rank suffix is found, rank=null and we keep the whole title.
 */
function parseFixedObservance(
  label: string | null,
): { title: string; rank: string } | null {
  const s = (label ?? "").trim();
  if (!s) return null;

  // This is a scrape placeholder; NOT a liturgical observance.
  if (s.toLowerCase() === "all saints for today") return null;

  // Split on em dash / dash variants
  const parts = s
    .split("—")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const title = parts[0];
    const rank = parts[parts.length - 1]; // last segment
    // Only accept common ranks; otherwise treat as title-only
    const r = rank.toLowerCase();
    if (r.includes("solemnity")) return { title, rank: "Solemnity" };
    if (r === "feast") return { title, rank: "Feast" };
    if (r.includes("memorial")) return { title, rank: "Memorial" };
  }

  return { title: s, rank: "Observance" };
}

function mergeMaps(
  ...maps: Array<Record<string, string[]>>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of maps) {
    for (const [k, arr] of Object.entries(m)) {
      if (!out[k]) out[k] = [];
      out[k].push(...arr);
    }
  }
  for (const k of Object.keys(out)) {
    out[k] = Array.from(new Set(out[k])).sort((a, b) => a.localeCompare(b));
  }
  return out;
}

function toneForRank(rank: string | null): "primary" | "secondary" | "none" {
  if (!rank) return "none";
  const r = rank.toLowerCase();
  if (r.includes("solemnity")) return "primary";
  if (r.includes("feast") || r.includes("memorial")) return "secondary";
  return "secondary";
}

export default function LiturgicalScreen() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selected, setSelected] = useState<SelectedDay | null>(null);

  const year = currentDate.getFullYear();

  const movableMap = useMemo(() => {
    const prev = computeMovableFeastsForYear(year - 1);
    const cur = computeMovableFeastsForYear(year);
    const next = computeMovableFeastsForYear(year + 1);
    return mergeMaps(prev, cur, next);
  }, [year]);

  const getDayMeta = useCallback(
    (dateKey: string) => {
      const md = toMmdd(dateKey);
      const dayInfo = (saintsByMmdd as unknown as Record<string, DaySaints>)[
        md
      ];

      const fixed = parseFixedObservance(dayInfo?.feast ?? null);
      const movable = movableMap[dateKey] ?? [];

      const hasAny = !!fixed || movable.length > 0;

      // Prefer movable label on grid, else fixed.
      const badge =
        (movable.length > 0 ? movable[0] : null) ??
        (fixed ? `${fixed.rank}: ${fixed.title}` : null);

      // Tone: Solemnity stronger.
      const tone =
        movable.length > 0
          ? "secondary"
          : fixed
            ? toneForRank(fixed.rank)
            : "none";

      return { hasEvent: hasAny, tone, badgeText: badge };
    },
    [movableMap],
  );

  const onPressDate = useCallback(
    (dateKey: string) => {
      const md = toMmdd(dateKey);
      const dayInfo = (saintsByMmdd as unknown as Record<string, DaySaints>)[
        md
      ];

      setSelected({
        dateKey,
        fixed: parseFixedObservance(dayInfo?.feast ?? null),
        movable: movableMap[dateKey] ?? [],
      });
    },
    [movableMap],
  );

  const fixed = selected?.fixed ?? null;
  const movable = selected?.movable ?? [];

  return (
    <LinearGradient
      colors={["#4b2e83", "#6a4c93", "#b185db"]}
      style={{ flex: 1 }}
    >
      <MonthGrid
        currentDate={currentDate}
        onChangeDate={setCurrentDate}
        onPressDate={onPressDate}
        getDayMeta={getDayMeta}
        headerTitle="Liturgical"
      />

      <Portal>
        <Modal
          visible={!!selected}
          onDismiss={() => setSelected(null)}
          contentContainerStyle={{
            backgroundColor: "white",
            margin: 20,
            borderRadius: 20,
            padding: 20,
          }}
        >
          {!selected?.dateKey ? null : (
            <Card style={{ borderRadius: 20 }}>
              <Card.Content>
                <Text variant="titleLarge" style={{ fontWeight: "800" }}>
                  {selected.dateKey}
                </Text>

                <Divider style={{ marginTop: 12 }} />

                {movable.length > 0 ? (
                  <>
                    <Text style={{ marginTop: 14, fontWeight: "800" }}>
                      Movable observances (year-aware)
                    </Text>
                    <Divider style={{ marginTop: 8 }} />
                    {movable.map((f) => (
                      <Text key={f} style={{ marginTop: 8, opacity: 0.85 }}>
                        • {f}
                      </Text>
                    ))}
                  </>
                ) : null}

                {fixed ? (
                  <>
                    <Text style={{ marginTop: 16, fontWeight: "800" }}>
                      Fixed observance
                    </Text>
                    <Divider style={{ marginTop: 8 }} />
                    <Text style={{ marginTop: 8, opacity: 0.85 }}>
                      • {fixed.rank}: {fixed.title}
                    </Text>
                  </>
                ) : null}

                {!fixed && movable.length === 0 ? (
                  <Text style={{ marginTop: 12, opacity: 0.7 }}>
                    No liturgical observance found for this date.
                  </Text>
                ) : null}

                <Button
                  mode="text"
                  style={{ marginTop: 16 }}
                  onPress={() => setSelected(null)}
                >
                  Close
                </Button>
              </Card.Content>
            </Card>
          )}
        </Modal>
      </Portal>
    </LinearGradient>
  );
}
