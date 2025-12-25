// app/(tabs)/saints.tsx
//
// Saints tab = saints-only.
// - data/saints_index.json => "primary saint" per MM-DD (button to /saint/[id])
// - data/saints_by_mmdd.json => saints[] list only (other saints)
// - DOES NOT use movable feasts rules.

import React, { useMemo, useState, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Portal, Modal, Card, Text, Divider, Button } from "react-native-paper";

import { MonthGrid } from "@/components/MonthGrid";

import saintsIndex from "../../data/saints_index.json";
import saintsByMmdd from "../../data/saints_by_mmdd.json";

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
  // dateKey is YYYY-MM-DD
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

export default function SaintsScreen() {
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selected, setSelected] = useState<SelectedDay | null>(null);

  const primaryIndexMap = useMemo(() => buildPrimaryIndexMap(), []);

  const getDayMeta = useCallback(
    (dateKey: string) => {
      const md = toMmdd(dateKey);

      const primary = primaryIndexMap.get(md) ?? null;
      const dayInfo = (saintsByMmdd as unknown as Record<string, DaySaints>)[
        md
      ];

      // saints[] list, cleaned
      let saintsList = (dayInfo?.saints ?? [])
        .map((s) => (s ?? "").trim())
        .filter((s) => !isJunkSaintName(s));

      // Avoid duplicates: remove primary from the "other saints" list
      if (primary?.name) {
        const pk = normKey(primary.name);
        saintsList = saintsList.filter((s) => normKey(s) !== pk);
      }

      const label =
        primary?.name ?? (saintsList.length > 0 ? saintsList[0] : null) ?? null;

      const hasAny = !!primary || saintsList.length > 0;

      return {
        hasEvent: hasAny,
        tone: hasAny ? "secondary" : "none",
        badgeText: label,
      };
    },
    [primaryIndexMap],
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

      // Remove primary from list to prevent duplicate display
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
  const feast =
    selected?.feast ?? primary?.feast ?? null ?? "All Saints for Today";

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
        headerTitle="Saints"
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

                <Text style={{ marginTop: 6, opacity: 0.75 }}>{feast}</Text>

                <Divider style={{ marginTop: 12 }} />

                {primary ? (
                  <>
                    <Text style={{ marginTop: 16, fontWeight: "800" }}>
                      Saint of the day
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
                      Other saints today
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
                    No saint entry found for this date.
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
