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

const SCREEN_PADDING = 16;
const CELL_MARGIN = 4;
const NUM_COLS = 7;

const { width } = Dimensions.get("window");
const availableWidth = width - SCREEN_PADDING * 2 - CELL_MARGIN * 2 * NUM_COLS;
const DAY_SIZE = availableWidth / NUM_COLS;
const DAY_HEIGHT = 70;

const MONTHS = [
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

type DayMeta = {
  hasEvent?: boolean;
  badgeText?: string | null;

  /**
   * Optional style hint from the tab.
   * - "primary": strong highlight (e.g., Novena starts)
   * - "secondary": medium highlight (e.g., Feast day)
   * - "none": default
   */
  tone?: "primary" | "secondary" | "none";
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

function DayCell({
  item,
  onPress,
  isToday,
}: {
  item: DayItem;
  onPress: () => void;
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
  const tone = meta.tone ?? (hasEvent ? "secondary" : "none");

  const bg =
    tone === "primary"
      ? "rgba(255,255,255,0.30)"
      : tone === "secondary"
        ? "rgba(255,255,255,0.22)"
        : "rgba(255,255,255,0.14)";

  const borderWidth = tone === "none" ? 1 : 2;
  const borderColor =
    tone === "primary"
      ? "#fff"
      : tone === "secondary"
        ? "rgba(255,255,255,0.85)"
        : "rgba(255,255,255,0.3)";

  const label = meta.badgeText ? String(meta.badgeText) : null;

  // ✅ "Today" highlight: subtle ring + small dot, does not override tone styles
  const todayRingWidth = isToday ? 2 : 0;
  const todayRingColor = isToday ? "rgba(255, 215, 0, 0.95)" : "transparent"; // gold-ish

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
        {/* Today ring overlay */}
        {isToday ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 2,
              left: 2,
              right: 2,
              bottom: 2,
              borderRadius: 12,
              borderWidth: todayRingWidth,
              borderColor: todayRingColor,
            }}
          />
        ) : null}

        <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
          {item.day}
        </Text>

        {/* Today dot */}
        {isToday ? (
          <View
            pointerEvents="none"
            style={{
              marginTop: 4,
              width: 6,
              height: 6,
              borderRadius: 999,
              backgroundColor: "rgba(255, 215, 0, 0.95)",
            }}
          />
        ) : (
          <View style={{ marginTop: 4, width: 6, height: 6 }} />
        )}

        {label ? (
          <View style={{ marginTop: 2, height: 22, justifyContent: "center" }}>
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
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function MonthGrid({
  currentDate,
  onChangeDate,
  onPressDate,
  getDayMeta,
  headerTitle,
}: {
  currentDate: Date;
  onChangeDate: (next: Date) => void;
  onPressDate: (dateKey: string) => void;
  getDayMeta: (dateKey: string) => DayMeta;
  headerTitle?: string;
}) {
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
          accessibilityLabel="Change month and year"
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
              {headerTitle} • Tap to jump
            </Text>
          ) : (
            <Text style={{ color: "white", opacity: 0.75, fontSize: 12 }}>
              Tap to jump
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
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
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
                Jump to month
              </Text>
              <Text style={{ marginTop: 4, opacity: 0.65 }}>
                Select a month, then adjust the year.
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
                />
                <Text style={{ fontSize: 20, fontWeight: "800" }}>
                  {tempYear}
                </Text>
                <IconButton
                  icon="plus"
                  onPress={() => setTempYear((y) => clampYear(y + 1))}
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
                    key={m}
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
                Apply
              </Button>

              <Button
                mode="text"
                style={{ marginTop: 6 }}
                onPress={() => setJumpOpen(false)}
              >
                Cancel
              </Button>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}
