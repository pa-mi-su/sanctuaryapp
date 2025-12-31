// components/MonthGrid.tsx
//
// Reusable month grid with:
// - Prev/Next month arrows
// - Clickable Month/Year header with a professional "Jump to month" picker
// - Swipe left/right to change months
// - A getDayMeta(dateKey) hook to let each tab supply badges/meaning
//
// Each tab owns its own "tap sheet" behavior; MonthGrid only reports which date was tapped.
//

import React, { useMemo, useRef, useState } from "react";
import { View, TouchableOpacity, FlatList, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Text,
  Modal,
  Portal,
  Card,
  Divider,
  Button,
  IconButton,
} from "react-native-paper";
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from "react-native-reanimated";

import { useTranslation } from "react-i18next";

const SCREEN_PADDING = 16;
const CELL_MARGIN = 4;
const NUM_COLS = 7;

const { width } = Dimensions.get("window");
const availableWidth = width - SCREEN_PADDING * 2 - CELL_MARGIN * 2 * NUM_COLS;
const DAY_SIZE = availableWidth / NUM_COLS;
const DAY_HEIGHT = 70;

// Months / weekdays per language
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MONTHS_PL = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

const MONTHS_TL = [
  "Enero",
  "Pebrero",
  "Marso",
  "Abril",
  "Mayo",
  "Hunyo",
  "Hulyo",
  "Agosto",
  "Setyembre",
  "Oktubre",
  "Nobyembre",
  "Disyembre",
];

// Sunday-first: Sun..Sat
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEKDAYS_PL = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
const WEEKDAYS_TL = ["Lin", "Lun", "Mar", "Miy", "Huw", "Biy", "Sab"];

/**
 * NOTE:
 * We intentionally allow `tone` to be `string` so callers don’t have to
 * fight TypeScript inference (it was returning `tone: string`).
 * MonthGrid normalizes tone to: "primary" | "secondary" | "none".
 */
export type DayMeta = {
  hasEvent?: boolean;
  badgeText?: string | null;
  tone?: "primary" | "secondary" | "none" | string;
  outlineColor?: string;
  outlineWidth?: number;
};

type DayItem = {
  empty?: boolean;
  day?: number;
  dateKey?: string; // YYYY-MM-DD
  meta?: DayMeta;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function clampYear(y: number) {
  if (y < 1900) return 1900;
  if (y > 2100) return 2100;
  return y;
}

function getTodayKeyLocal() {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function normalizeTone(
  tone: DayMeta["tone"],
): "primary" | "secondary" | "none" {
  if (tone === "primary") return "primary";
  if (tone === "secondary") return "secondary";
  return "none";
}

function DayCell({
  item,
  onPress,
  onLongPress,
  isToday,
}: {
  item: DayItem;
  onPress: () => void;
  onLongPress?: () => void;
  isToday: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (item.empty) {
    return (
      <View
        style={{ width: DAY_SIZE, height: DAY_HEIGHT, margin: CELL_MARGIN }}
      />
    );
  }

  const meta = item.meta ?? {};
  const hasEvent = !!meta.hasEvent;

  const tone = normalizeTone(meta.tone ?? (hasEvent ? "secondary" : "none"));

  const bg =
    tone === "primary"
      ? "rgba(255,255,255,0.30)"
      : tone === "secondary"
        ? "rgba(255,255,255,0.22)"
        : "rgba(255,255,255,0.14)";

  const baseBorderWidth = tone === "primary" ? 2 : tone === "secondary" ? 2 : 1;

  const borderWidth =
    typeof meta.outlineWidth === "number" ? meta.outlineWidth : baseBorderWidth;

  const borderColor =
    meta.outlineColor ??
    (tone === "primary"
      ? "rgba(255,255,255,0.95)"
      : tone === "secondary"
        ? "rgba(255,255,255,0.65)"
        : "rgba(255,255,255,0.28)");

  const label = meta.badgeText ? String(meta.badgeText) : null;

  const showTodayRing = isToday;

  return (
    <Animated.View
      style={[
        animatedStyle,
        { width: DAY_SIZE, height: DAY_HEIGHT, margin: CELL_MARGIN },
      ]}
    >
      <TouchableOpacity
        onPressIn={() => (scale.value = withSpring(0.95))}
        onPressOut={() => (scale.value = withSpring(1))}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={{
          flex: 1,
          borderRadius: 12,
          backgroundColor: bg,
          borderWidth,
          borderColor,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 4,
          paddingVertical: 6,
          position: "relative",
        }}
      >
        {showTodayRing ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 3,
              left: 3,
              right: 3,
              bottom: 3,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.55)",
            }}
          />
        ) : null}

        <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
          {item.day}
        </Text>

        {label ? (
          <View style={{ marginTop: 6, height: 22, justifyContent: "center" }}>
            <Text
              style={{
                color: "white",
                fontSize: 8,
                textAlign: "center",
                lineHeight: 10,
              }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {label}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 6, height: 22 }} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function MonthGrid({
  currentDate,
  onChangeDate,
  onPressDate,
  onLongPressDate,
  getDayMeta,
  headerTitle,
}: {
  currentDate: Date;
  onChangeDate: (next: Date) => void;
  onPressDate: (dateKey: string) => void;
  onLongPressDate?: (dateKey: string) => void;
  getDayMeta: (dateKey: string) => DayMeta;
  headerTitle?: string;
}) {
  const { t, i18n } = useTranslation();

  const lang = (i18n.language || "en").toLowerCase();
  const isEs = lang.startsWith("es");
  const isPl = lang.startsWith("pl");
  const isTl = lang.startsWith("tl");

  const MONTHS = isEs
    ? MONTHS_ES
    : isPl
      ? MONTHS_PL
      : isTl
        ? MONTHS_TL
        : MONTHS_EN;
  const WEEKDAYS = isEs
    ? WEEKDAYS_ES
    : isPl
      ? WEEKDAYS_PL
      : isTl
        ? WEEKDAYS_TL
        : WEEKDAYS_EN;

  const [jumpOpen, setJumpOpen] = useState(false);
  const [tempMonth, setTempMonth] = useState(() => new Date().getMonth());
  const [tempYear, setTempYear] = useState(() => new Date().getFullYear());

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const year = currentDate.getFullYear();
  const month0 = currentDate.getMonth();

  const todayKey = useMemo(() => getTodayKeyLocal(), []);

  const openJumpPicker = () => {
    setTempMonth(month0);
    setTempYear(year);
    setJumpOpen(true);
  };

  const goToNextMonth = () => onChangeDate(new Date(year, month0 + 1, 1));
  const goToPrevMonth = () => onChangeDate(new Date(year, month0 - 1, 1));

  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
  };

  const handleTouchEnd = (e: any) => {
    touchEndX.current = e.nativeEvent.pageX;
    const diff = touchStartX.current - touchEndX.current;

    if (diff > 50) goToNextMonth();
    else if (diff < -50) goToPrevMonth();
  };

  const daysArray: DayItem[] = useMemo(() => {
    const firstDay = new Date(year, month0, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month0 + 1, 0).getDate();

    const arr: DayItem[] = [];
    for (let i = 0; i < firstDay; i++) arr.push({ empty: true });

    for (let day = 1; day <= daysInMonth; day++) {
      const key = toDateKey(year, month0 + 1, day);
      arr.push({
        day,
        dateKey: key,
        meta: getDayMeta(key),
      });
    }
    return arr;
  }, [year, month0, getDayMeta]);

  return (
    <SafeAreaView
      style={{ flex: 1, padding: SCREEN_PADDING }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 10,
          alignItems: "center",
        }}
      >
        <TouchableOpacity onPress={goToPrevMonth}>
          <Text
            style={{
              color: "white",
              fontSize: 40,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            ‹
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={openJumpPicker}
          style={{
            alignItems: "center",
            paddingHorizontal: 8,
            paddingVertical: 6,
          }}
          accessibilityRole="button"
          accessibilityLabel={t("monthgrid_change_month_year")}
        >
          <Text
            variant="headlineMedium"
            style={{
              color: "white",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            {MONTHS[month0]} {year} ▾
          </Text>

          {headerTitle ? (
            <Text style={{ color: "white", opacity: 0.85, fontSize: 12 }}>
              {headerTitle} • {t("monthgrid_tap_to_jump")}
            </Text>
          ) : (
            <Text style={{ color: "white", opacity: 0.75, fontSize: 12 }}>
              {t("monthgrid_tap_to_jump")}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={goToNextMonth}>
          <Text
            style={{
              color: "white",
              fontSize: 40,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            ›
          </Text>
        </TouchableOpacity>
      </View>

      {/* Weekday Labels */}
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {WEEKDAYS.map((d) => (
          <View
            key={d}
            style={{
              width: DAY_SIZE,
              marginHorizontal: CELL_MARGIN,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "white",
                opacity: 0.8,
                fontSize: 12,
                textAlign: "center",
              }}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <FlatList
        data={daysArray}
        numColumns={NUM_COLS}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <DayCell
            item={item}
            isToday={!!item.dateKey && item.dateKey === todayKey}
            onPress={() => {
              if (!item.dateKey || item.empty) return;
              onPressDate(item.dateKey);
            }}
            onLongPress={
              item.dateKey && !item.empty && onLongPressDate
                ? () => onLongPressDate(item.dateKey!)
                : undefined
            }
          />
        )}
        scrollEnabled={false}
      />

      {/* Jump Picker */}
      <Portal>
        <Modal
          visible={jumpOpen}
          onDismiss={() => setJumpOpen(false)}
          contentContainerStyle={{
            backgroundColor: "white",
            margin: 20,
            borderRadius: 20,
            padding: 16,
          }}
        >
          <Card style={{ borderRadius: 20 }}>
            <Card.Content>
              <Text variant="titleLarge" style={{ fontWeight: "800" }}>
                {t("monthgrid_jump_title")}
              </Text>
              <Text style={{ marginTop: 4, opacity: 0.65 }}>
                {t("monthgrid_jump_subtitle")}
              </Text>

              <Divider style={{ marginVertical: 12 }} />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconButton
                  icon="minus"
                  onPress={() => setTempYear((y) => clampYear(y - 1))}
                  accessibilityLabel={t("monthgrid_year_decrease")}
                />
                <Text style={{ fontSize: 20, fontWeight: "800" }}>
                  {tempYear}
                </Text>
                <IconButton
                  icon="plus"
                  onPress={() => setTempYear((y) => clampYear(y + 1))}
                  accessibilityLabel={t("monthgrid_year_increase")}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  marginTop: 8,
                }}
              >
                {MONTHS.map((m, i) => (
                  <Button
                    key={`${m}-${i}`}
                    mode={i === tempMonth ? "contained" : "outlined"}
                    style={{ width: "30%", margin: "1.5%" }}
                    onPress={() => setTempMonth(i)}
                  >
                    {m.slice(0, 3)}
                  </Button>
                ))}
              </View>

              <Button
                mode="contained"
                style={{ marginTop: 14 }}
                onPress={() => {
                  onChangeDate(new Date(tempYear, tempMonth, 1));
                  setJumpOpen(false);
                }}
              >
                {t("monthgrid_apply")}
              </Button>

              <Button
                mode="text"
                style={{ marginTop: 6 }}
                onPress={() => setJumpOpen(false)}
              >
                {t("monthgrid_cancel")}
              </Button>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}
