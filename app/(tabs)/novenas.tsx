// app/(tabs)/novenas.tsx
//
// Novenas Calendar
// - Shows novenas that START on a day (and feast days that relate to novenas)
// - Tap a day -> "Starts today" list (routes to /novena/[id]) + "Feast today"
//
// ✅ UI rules here:
// - Uses Sanctuary gradient (AppTheme)
// - Season-colored outline for EVERY day (so grid always looks alive)
// - Stronger outline when novena starts; medium when feast exists
// - Shows SeasonLegend at bottom
//
// ✅ Runtime hardening:
// - buildCalendarMapsForYear may return Map OR plain object
// - Avoids crash: "src.entries is not a function"

import React, { useMemo, useState, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Portal, Modal, Card, Text, Divider, Button } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { MonthGrid } from "@/components/MonthGrid";
import { SeasonLegend } from "@/components/SeasonLegend";

import { buildCalendarMapsForYear } from "../../data/calendar";

import {
  computeMovableFeastsForYear,
  type MovableObservance,
  type LiturgicalSeason,
} from "../../utils/movableFeastsRules";

import { AppTheme, seasonOutlineColor } from "../../utils/theme";

// Local type to avoid depending on a named export that may not exist.
type CalendarEntry = {
  id: string;
  title: string;
  startDate?: string; // YYYY-MM-DD
  feastDate?: string; // YYYY-MM-DD
};

type SelectedDay = {
  dateKey: string;
  starts: CalendarEntry[];
  feasts: CalendarEntry[];
};

/**
 * Build a "best-guess season" resolver using season markers.
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
    let best: LiturgicalSeason | undefined;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (markers[mid].dateKey <= dateKey) {
        best = markers[mid].season;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  };
}

function shortTitle(s: string, max = 18) {
  const t = (s ?? "").trim();
  if (!t) return t;
  return t.length > max ? `${t.slice(0, max).trim()}…` : t;
}

/**
 * Normalize Map | object → Map
 */
function toMap(src: any): Map<string, CalendarEntry[]> {
  if (!src) return new Map();
  if (src instanceof Map) return src;

  if (typeof src === "object") {
    const m = new Map<string, CalendarEntry[]>();
    for (const [k, v] of Object.entries(src)) {
      if (Array.isArray(v)) m.set(k, v as CalendarEntry[]);
    }
    return m;
  }
  return new Map();
}

export default function NovenasScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selected, setSelected] = useState<SelectedDay | null>(null);

  const year = currentDate.getFullYear();

  const { startsMap, feastsMap } = useMemo(() => {
    if (typeof buildCalendarMapsForYear !== "function") {
      throw new Error(
        "[NovenasScreen] buildCalendarMapsForYear is not a function",
      );
    }

    const prev = buildCalendarMapsForYear(year - 1);
    const cur = buildCalendarMapsForYear(year);
    const next = buildCalendarMapsForYear(year + 1);

    const s = new Map<string, CalendarEntry[]>();
    const f = new Map<string, CalendarEntry[]>();

    const merge = (srcLike: any, dest: Map<string, CalendarEntry[]>) => {
      const src = toMap(srcLike);
      for (const [k, arr] of src.entries()) {
        if (!dest.has(k)) dest.set(k, []);
        dest.get(k)!.push(...arr);
      }
    };

    merge(prev?.startsMap, s);
    merge(cur?.startsMap, s);
    merge(next?.startsMap, s);

    merge(prev?.feastsMap, f);
    merge(cur?.feastsMap, f);
    merge(next?.feastsMap, f);

    for (const arr of s.values()) {
      arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    for (const arr of f.values()) {
      arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    return { startsMap: s, feastsMap: f };
  }, [year]);

  const liturgicalMap = useMemo(() => {
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
    return out;
  }, [year]);

  const resolveSeason = useMemo(
    () => buildSeasonResolver(liturgicalMap),
    [liturgicalMap],
  );

  const getDayMeta = useCallback(
    (dateKey: string) => {
      const starts = startsMap.get(dateKey) ?? [];
      const feasts = feastsMap.get(dateKey) ?? [];

      const hasStart = starts.length > 0;
      const hasFeast = feasts.length > 0;

      const season = resolveSeason(dateKey);
      const outlineColor =
        seasonOutlineColor(season) ?? AppTheme.outlineFallback;

      if (hasStart) {
        return {
          hasEvent: true,
          tone: "primary" as const,
          badgeText: shortTitle(starts[0].title),
          outlineColor,
          outlineWidth: 3,
        };
      }

      if (hasFeast) {
        return {
          hasEvent: true,
          tone: "secondary" as const,
          badgeText: shortTitle(`${t("badge_feast_prefix")}${feasts[0].title}`),
          outlineColor,
          outlineWidth: 2,
        };
      }

      return {
        hasEvent: true,
        tone: "none" as const,
        badgeText: "·",
        outlineColor,
        outlineWidth: 2,
      };
    },
    [startsMap, feastsMap, t, resolveSeason],
  );

  const onPressDate = useCallback(
    (dateKey: string) => {
      setSelected({
        dateKey,
        starts: startsMap.get(dateKey) ?? [],
        feasts: feastsMap.get(dateKey) ?? [],
      });
    },
    [startsMap, feastsMap],
  );

  const starts = selected?.starts ?? [];
  const feasts = selected?.feasts ?? [];

  return (
    <LinearGradient colors={[...AppTheme.gradients.main]} style={{ flex: 1 }}>
      <MonthGrid
        currentDate={currentDate}
        onChangeDate={setCurrentDate}
        onPressDate={onPressDate}
        getDayMeta={getDayMeta}
        headerTitle={t("novenas")}
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
          {!selected ? null : (
            <Card style={{ borderRadius: 20 }}>
              <Card.Content>
                <Text variant="titleLarge" style={{ fontWeight: "800" }}>
                  {selected.dateKey}
                </Text>

                {starts.length === 0 && feasts.length === 0 ? (
                  <Text style={{ marginTop: 10, opacity: 0.7 }}>
                    {t("no_novenas_or_feasts")}
                  </Text>
                ) : (
                  <>
                    {starts.length > 0 && (
                      <>
                        <Text style={{ marginTop: 14, fontWeight: "800" }}>
                          {t("starts_today")}
                        </Text>
                        <Divider style={{ marginTop: 8 }} />
                        {starts.map((n, idx) => (
                          <Button
                            key={`${n.id}-${idx}`}
                            mode="contained"
                            style={{ marginTop: 10 }}
                            onPress={() => {
                              const date = selected.dateKey;
                              setSelected(null);
                              router.push({
                                pathname: "/novena/[id]",
                                params: { id: n.id, date },
                              });
                            }}
                          >
                            {n.title}
                          </Button>
                        ))}
                      </>
                    )}

                    {feasts.length > 0 && (
                      <>
                        <Text style={{ marginTop: 16, fontWeight: "800" }}>
                          {t("feast_today")}
                        </Text>
                        <Divider style={{ marginTop: 8 }} />
                        {feasts.slice(0, 6).map((f, idx) => (
                          <Text key={`${f.id}-${idx}`} style={{ marginTop: 8 }}>
                            • {f.title}
                          </Text>
                        ))}
                      </>
                    )}
                  </>
                )}

                <Button
                  mode="text"
                  style={{ marginTop: 16 }}
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
