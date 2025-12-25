// app/(tabs)/novenas.tsx
//
// Novenas Calendar
// - Shows novenas that START on a day (and feast days that relate to novenas)
// - Tap a day -> "Starts today" list (routes to /novena/[id]) + "Feast today"
//
// NOTE:
// This tab is allowed to show BOTH Novenas + Feast days because they’re related context.
// Saints tab remains saints-only.
//

import React, { useMemo, useState, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Portal, Modal, Card, Text, Divider, Button } from "react-native-paper";

import { MonthGrid } from "@/components/MonthGrid";
import {
  buildCalendarMapsForYear,
  type CalendarEntry,
} from "../../data/calendar";

type SelectedDay = {
  dateKey: string; // YYYY-MM-DD
  starts: CalendarEntry[];
  feasts: CalendarEntry[];
};

export default function NovenasScreen() {
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selected, setSelected] = useState<SelectedDay | null>(null);

  const year = currentDate.getFullYear();

  /**
   * Cross-year correctness:
   * - January view needs previous-year entries whose startDate was in Dec (year-1).
   * - December view needs next-year entries whose feastDate lands in Jan (year+1).
   */
  const { startsMap, feastsMap } = useMemo(() => {
    const prev = buildCalendarMapsForYear(year - 1);
    const cur = buildCalendarMapsForYear(year);
    const next = buildCalendarMapsForYear(year + 1);

    const s = new Map<string, CalendarEntry[]>();
    const f = new Map<string, CalendarEntry[]>();

    const merge = (
      src: Map<string, CalendarEntry[]>,
      dest: Map<string, CalendarEntry[]>,
    ) => {
      for (const [k, arr] of src.entries()) {
        if (!dest.has(k)) dest.set(k, []);
        dest.get(k)!.push(...arr);
      }
    };

    merge(prev.startsMap, s);
    merge(cur.startsMap, s);
    merge(next.startsMap, s);

    merge(prev.feastsMap, f);
    merge(cur.feastsMap, f);
    merge(next.feastsMap, f);

    // stable ordering
    for (const arr of s.values())
      arr.sort((a, b) => a.title.localeCompare(b.title));
    for (const arr of f.values())
      arr.sort((a, b) => a.title.localeCompare(b.title));

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[Novenas] years:", year - 1, year, year + 1);
    }

    return { startsMap: s, feastsMap: f };
  }, [year]);

  const getDayMeta = useCallback(
    (dateKey: string) => {
      const starts = startsMap.get(dateKey) ?? [];
      const feasts = feastsMap.get(dateKey) ?? [];

      const hasStart = starts.length > 0;
      const hasFeast = feasts.length > 0;

      if (hasStart) {
        return {
          hasEvent: true,
          tone: "primary",
          badgeText: starts[0].title,
        };
      }

      if (hasFeast) {
        return {
          hasEvent: true,
          tone: "secondary",
          badgeText: `Feast: ${feasts[0].title}`,
        };
      }

      return { hasEvent: false, tone: "none", badgeText: null };
    },
    [startsMap, feastsMap],
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
    <LinearGradient
      colors={["#4b2e83", "#6a4c93", "#b185db"]}
      style={{ flex: 1 }}
    >
      <MonthGrid
        currentDate={currentDate}
        onChangeDate={setCurrentDate}
        onPressDate={onPressDate}
        getDayMeta={getDayMeta}
        headerTitle="Novenas"
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

                {starts.length === 0 && feasts.length === 0 ? (
                  <Text style={{ marginTop: 10, opacity: 0.7 }}>
                    No novenas start or feast on this day.
                  </Text>
                ) : (
                  <>
                    {starts.length > 0 ? (
                      <>
                        <Text style={{ marginTop: 14, fontWeight: "800" }}>
                          Starts today
                        </Text>
                        <Divider style={{ marginTop: 8 }} />
                        {starts.map((n) => (
                          <Button
                            key={`${n.id}|${n.startDate}`}
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
                    ) : null}

                    {feasts.length > 0 ? (
                      <>
                        <Text style={{ marginTop: 16, fontWeight: "800" }}>
                          Feast today
                        </Text>
                        <Divider style={{ marginTop: 8 }} />
                        {feasts.slice(0, 6).map((f) => (
                          <Text
                            key={`${f.id}|${f.feastDate}`}
                            style={{ marginTop: 8, opacity: 0.85 }}
                          >
                            • {f.title}
                          </Text>
                        ))}
                        {feasts.length > 6 ? (
                          <Text style={{ marginTop: 8, opacity: 0.6 }}>
                            …and {feasts.length - 6} more
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                  </>
                )}

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
