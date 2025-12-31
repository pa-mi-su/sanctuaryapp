// app/(tabs)/liturgical.tsx
//
// Liturgical tab = season cycle + major celebrations (NOT saints, NOT novenas).
// Goal: show IMPORTANT liturgical dates and Sundays that define the Church year.

import React, { useMemo, useState, useCallback } from "react";
import { Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Portal, Modal, Card, Text, Divider, Button } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { MonthGrid } from "@/components/MonthGrid";
import { SeasonLegend } from "@/components/SeasonLegend";

import {
  computeMovableFeastsForYear,
  type MovableObservance,
  type LiturgicalRank,
  type LiturgicalSeason,
} from "../../utils/movableFeastsRules";

import { AppTheme, seasonOutlineColor } from "../../utils/theme";

type SelectedDay = {
  dateKey: string; // YYYY-MM-DD
  entries: MovableObservance[];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * USCCB Readings URL builder.
 * Typical format: https://bible.usccb.org/bible/readings/MMDDYY.cfm
 * Christmas Day often has a "-Day" page; we special-case it.
 */
function usccbReadingsUrl(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((x) => parseInt(x, 10));
  const yy = String(y).slice(-2);
  const mm = pad2(m);
  const dd = pad2(d);

  if (m === 12 && d === 25) {
    return `https://bible.usccb.org/bible/readings/${mm}${dd}${yy}-Day.cfm`;
  }
  return `https://bible.usccb.org/bible/readings/${mm}${dd}${yy}.cfm`;
}

function rankWeight(rank: LiturgicalRank): number {
  switch (rank) {
    case "Triduum":
      return 7;
    case "Solemnity":
      return 6;
    case "Sunday":
      return 5;
    case "Feast":
      return 4;
    case "Memorial":
      return 3;
    case "Optional Memorial":
      return 2;
    case "Weekday":
    default:
      return 1;
  }
}

function toneForRank(rank: LiturgicalRank): "primary" | "secondary" | "none" {
  switch (rank) {
    case "Triduum":
    case "Solemnity":
      return "primary";
    case "Sunday":
    case "Feast":
    case "Memorial":
    case "Optional Memorial":
      return "secondary";
    case "Weekday":
    default:
      return "none";
  }
}

function shortBadge(m: MovableObservance): string {
  const title =
    m.title.length > 18 ? `${m.title.slice(0, 18).trim()}…` : m.title;
  return `${m.rank}: ${title}`;
}

/**
 * Build a "best-guess season" resolver.
 * Uses season markers (kind === "SeasonMarker") from movableFeastsRules.
 * For any dateKey, returns the last marker <= dateKey.
 */
function buildSeasonResolver(calendarMap: Record<string, MovableObservance[]>) {
  const markers: Array<{ dateKey: string; season: LiturgicalSeason }> = [];

  for (const [dateKey, arr] of Object.entries(calendarMap)) {
    for (const e of arr) {
      if (e.kind === "SeasonMarker" && e.season) {
        markers.push({ dateKey, season: e.season });
      }
    }
  }

  markers.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  return (dateKey: string): LiturgicalSeason | undefined => {
    let lo = 0;
    let hi = markers.length - 1;
    let best: LiturgicalSeason | undefined = undefined;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const m = markers[mid];
      if (m.dateKey <= dateKey) {
        best = m.season;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  };
}

export default function LiturgicalScreen() {
  const { t } = useTranslation();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selected, setSelected] = useState<SelectedDay | null>(null);

  const year = currentDate.getFullYear();

  // Cross-year: prev/current/next so late-Dec / early-Jan works
  const calendarMap = useMemo(() => {
    const prev = computeMovableFeastsForYear(year - 1);
    const cur = computeMovableFeastsForYear(year);
    const next = computeMovableFeastsForYear(year + 1);

    const out: Record<string, MovableObservance[]> = {};

    const merge = (m: Record<string, MovableObservance[]>) => {
      for (const [k, arr] of Object.entries(m)) {
        if (!out[k]) out[k] = [];
        out[k].push(...arr);
      }
    };

    merge(prev);
    merge(cur);
    merge(next);

    // De-dupe and sort by importance
    for (const k of Object.keys(out)) {
      const seen = new Set<string>();
      out[k] = out[k]
        .filter((x) => {
          if (seen.has(x.id)) return false;
          seen.add(x.id);
          return true;
        })
        .sort((a, b) => {
          const dw = rankWeight(b.rank) - rankWeight(a.rank);
          if (dw !== 0) return dw;
          return a.title.localeCompare(b.title);
        });
    }

    return out;
  }, [year]);

  const resolveSeason = useMemo(
    () => buildSeasonResolver(calendarMap),
    [calendarMap],
  );

  const openReadings = useCallback(async (dateKey: string) => {
    const url = usccbReadingsUrl(dateKey);
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else console.warn("Cannot open URL:", url);
    } catch (e) {
      console.warn("Failed to open readings URL:", url, e);
    }
  }, []);

  const getDayMeta = useCallback(
    (dateKey: string) => {
      const entries = calendarMap[dateKey] ?? [];
      const hasAny = entries.length > 0;

      // Prefer explicit season on the top entry; otherwise infer from season markers.
      const season = hasAny ? entries[0]?.season : resolveSeason(dateKey);
      const outlineColor =
        seasonOutlineColor(season) ?? AppTheme.outlineFallback;

      if (hasAny) {
        const top = entries[0];
        const thick =
          top.rank === "Triduum" || top.rank === "Solemnity" ? 3 : 2;

        return {
          hasEvent: true,
          tone: toneForRank(top.rank),
          badgeText: shortBadge(top),
          outlineColor,
          outlineWidth: thick,
        };
      }

      // “Empty” day: still tappable; show readings cue
      return {
        hasEvent: true,
        tone: "none" as const,
        badgeText: "📖",
        outlineColor,
        outlineWidth: 2,
      };
    },
    [calendarMap, resolveSeason],
  );

  const onPressDate = useCallback(
    (dateKey: string) => {
      setSelected({
        dateKey,
        entries: calendarMap[dateKey] ?? [],
      });
    },
    [calendarMap],
  );

  const selectedDateKey = selected?.dateKey ?? null;
  const entries = selected?.entries ?? [];

  return (
    <LinearGradient colors={[...AppTheme.gradients.main]} style={{ flex: 1 }}>
      <MonthGrid
        currentDate={currentDate}
        onChangeDate={setCurrentDate}
        onPressDate={onPressDate}
        onLongPressDate={openReadings}
        getDayMeta={getDayMeta}
        headerTitle={t("liturgical")}
      />

      <SeasonLegend style={{ marginBottom: 12 }} />

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
          {!selectedDateKey ? null : (
            <Card style={{ borderRadius: 20 }}>
              <Card.Content>
                <Text variant="titleLarge" style={{ fontWeight: "800" }}>
                  {selectedDateKey}
                </Text>

                <Divider style={{ marginTop: 12 }} />

                <Button
                  mode="contained"
                  style={{ marginTop: 12 }}
                  onPress={() => openReadings(selectedDateKey)}
                >
                  Open USCCB Readings
                </Button>

                {entries.length > 0 ? (
                  <>
                    <Text style={{ marginTop: 16, fontWeight: "800" }}>
                      {t("liturgical")}
                    </Text>
                    <Divider style={{ marginTop: 8 }} />

                    {entries.map((m) => (
                      <Text key={m.id} style={{ marginTop: 10, opacity: 0.9 }}>
                        • {m.rank}: {m.title}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Text style={{ marginTop: 14, opacity: 0.7 }}>
                    {t("no_liturgical_observance_found")}
                  </Text>
                )}

                <Text style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                  Tip: Long-press any date to jump straight to readings.
                </Text>

                <Button
                  mode="text"
                  style={{ marginTop: 12 }}
                  onPress={() => setSelected(null)}
                >
                  {t("close")}
                </Button>
              </Card.Content>
            </Card>
          )}
        </Modal>
      </Portal>
    </LinearGradient>
  );
}
