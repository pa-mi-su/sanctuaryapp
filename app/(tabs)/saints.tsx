// app/(tabs)/saints.tsx
//
// Saints tab = saints-only.
// - data/saints_index.json => "primary saint" per MM-DD (button to /saint/[id])
// - data/saints_by_mmdd.json => saints[] list only (other saints)
// - DOES NOT use movable feasts rules for saints data,
//   BUT we DO use movable feasts rules for SEASON coloring (outlines + legend).
//
// ✅ UI rules here:
// - Uses Sanctuary gradient (AppTheme)
// - Season-colored outline for EVERY day (so grid always looks alive)
// - Stronger outline when there is at least one saint entry
// - Shows SeasonLegend at bottom

import React, { useMemo, useState, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Portal, Modal, Card, Text, Divider, Button } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { MonthGrid } from "@/components/MonthGrid";
import { SeasonLegend } from "@/components/SeasonLegend";

import saintsIndex from "../../data/saints_index.json";
import saintsByMmdd from "../../data/saints_by_mmdd.json";

import {
  computeMovableFeastsForYear,
  type MovableObservance,
  type LiturgicalSeason,
} from "../../utils/movableFeastsRules";

import { AppTheme, seasonOutlineColor } from "../../utils/theme";

type SaintIndexEntry = {
  id: string;
  name: string;
  mmdd: string; // "01-08"
  feast?: string | null;
};

type DaySaints = {
  feast: string | null;
  saints: string[];
  featuredSaint?: string | null;
};

type SelectedDay = {
  dateKey: string; // YYYY-MM-DD
  mmdd: string; // MM-DD
  feast: string | null;
  primary: SaintIndexEntry | null;
  saintsList: string[];
};

function toMmdd(dateKey: string) {
  const parts = dateKey.split("-");
  return `${parts[1]}-${parts[2]}`;
}

function normKey(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function isJunkSaintName(s: string) {
  const t = normKey(s);
  if (!t) return true;
  if (t === "all saints for today") return true;
  if (t === "all saints") return true;
  if (t === "saint") return true;
  if (t === "saints") return true;
  return false;
}

function buildPrimaryIndexMap() {
  const map = new Map<string, SaintIndexEntry>();
  for (const e of saintsIndex as unknown as SaintIndexEntry[]) {
    map.set(e.mmdd, e);
  }
  return map;
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

export default function SaintsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selected, setSelected] = useState<SelectedDay | null>(null);

  const primaryIndexMap = useMemo(() => buildPrimaryIndexMap(), []);

  const year = currentDate.getFullYear();

  // Cross-year liturgical map ONLY for season resolution + colored outlines
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
      const md = toMmdd(dateKey);

      const primary = primaryIndexMap.get(md) ?? null;
      const dayInfo = (saintsByMmdd as unknown as Record<string, DaySaints>)[
        md
      ];

      let saintsList = (dayInfo?.saints ?? [])
        .map((s) => (s ?? "").trim())
        .filter((s) => !isJunkSaintName(s));

      if (primary?.name) {
        const pk = normKey(primary.name);
        saintsList = saintsList.filter((s) => normKey(s) !== pk);
      }

      const label =
        primary?.name ?? (saintsList.length > 0 ? saintsList[0] : null) ?? null;

      const hasAny = !!primary || saintsList.length > 0;

      // Season-colored outline for EVERY day
      const season = resolveSeason(dateKey);
      const outlineColor =
        seasonOutlineColor(season) ?? AppTheme.outlineFallback;

      // Thickness communicates “content exists”
      const outlineWidth = hasAny ? 3 : 2;

      return {
        hasEvent: true,
        tone: hasAny ? "secondary" : "none",
        badgeText: label ?? "·",
        outlineColor,
        outlineWidth,
      };
    },
    [primaryIndexMap, resolveSeason],
  );

  const onPressDate = useCallback(
    (dateKey: string) => {
      const md = toMmdd(dateKey);

      const primary = primaryIndexMap.get(md) ?? null;
      const dayInfo = (saintsByMmdd as unknown as Record<string, DaySaints>)[
        md
      ];

      const feast = dayInfo?.feast ?? primary?.feast ?? null;

      let saintsList = (dayInfo?.saints ?? [])
        .map((s) => (s ?? "").trim())
        .filter((s) => !isJunkSaintName(s));

      if (primary?.name) {
        const pk = normKey(primary.name);
        saintsList = saintsList.filter((s) => normKey(s) !== pk);
      }

      setSelected({
        dateKey,
        mmdd: md,
        feast,
        primary,
        saintsList,
      });
    },
    [primaryIndexMap],
  );

  const primary = selected?.primary ?? null;
  const saintsList = selected?.saintsList ?? [];
  const feast = selected?.feast ?? primary?.feast ?? null;

  return (
    <LinearGradient colors={[...AppTheme.gradients.main]} style={{ flex: 1 }}>
      <MonthGrid
        currentDate={currentDate}
        onChangeDate={setCurrentDate}
        onPressDate={onPressDate}
        getDayMeta={getDayMeta}
        headerTitle={t("saints")}
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
          {!selected?.dateKey ? null : (
            <Card style={{ borderRadius: 20 }}>
              <Card.Content>
                <Text variant="titleLarge" style={{ fontWeight: "800" }}>
                  {selected.dateKey}
                </Text>

                {feast ? (
                  <Text style={{ marginTop: 6, opacity: 0.75 }}>{feast}</Text>
                ) : null}

                <Divider style={{ marginTop: 12 }} />

                {primary ? (
                  <>
                    <Text style={{ marginTop: 16, fontWeight: "800" }}>
                      {t("saint_of_the_day")}
                    </Text>

                    <Button
                      mode="contained"
                      style={{ marginTop: 10 }}
                      onPress={() => {
                        const date = selected.dateKey;
                        const id = primary.id;
                        setSelected(null);
                        router.push({
                          pathname: "/saint/[id]",
                          params: { id, date },
                        });
                      }}
                    >
                      {primary.name}
                    </Button>
                  </>
                ) : null}

                {saintsList.length > 0 ? (
                  <>
                    <Text style={{ marginTop: 16, fontWeight: "800" }}>
                      {t("other_saints_today")}
                    </Text>
                    <Divider style={{ marginTop: 8 }} />

                    {saintsList.slice(0, 10).map((name, idx) => (
                      <Text
                        key={`${selected.mmdd}-${idx}-${name}`}
                        style={{ marginTop: 8, opacity: 0.85 }}
                      >
                        • {name}
                      </Text>
                    ))}

                    {saintsList.length > 10 ? (
                      <Text style={{ marginTop: 8, opacity: 0.6 }}>
                        …and {saintsList.length - 10} more
                      </Text>
                    ) : null}
                  </>
                ) : null}

                {!primary && saintsList.length === 0 ? (
                  <Text style={{ marginTop: 12, opacity: 0.7 }}>
                    {t("no_saint_entry_found")}
                  </Text>
                ) : null}

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
