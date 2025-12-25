// data/calendar.ts
//
// Runtime calendar generator (NO precomputed calendar_YYYY.json files)
//
// - Uses data/novenas_index.json (rules) + utils/liturgicalDates.ts (engine)
// - Computes start/feast for any requested year
// - Handles cross-year novenas (e.g. start 2025-12-25, feast 2026-01-03)

import novenasIndex from "./novenas_index.json";
import {
  computeNovenaDatesForYearStrict,
  type NovenaIndexEntry,
} from "../utils/liturgicalDates";

export type CalendarEntry = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  startDate: string; // YYYY-MM-DD (may be in previous year for cross-year)
  feastDate: string; // YYYY-MM-DD
};

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build a full-year calendar for `year`.
 * NOTE: Some entries will have startDate in (year-1) for January feasts.
 */
export function buildCalendarForYear(year: number): CalendarEntry[] {
  const idx = novenasIndex as unknown as NovenaIndexEntry[];

  const out: CalendarEntry[] = idx.map((e) => {
    const r = computeNovenaDatesForYearStrict(e, year);
    return {
      id: e.id,
      title: e.title,
      category: e.category,
      tags: e.tags,
      startDate: isoDateOnly(r.startDate),
      feastDate: isoDateOnly(r.feastDate),
    };
  });

  // Sort by start date then title for stable UI
  out.sort((a, b) => {
    const c = a.startDate.localeCompare(b.startDate);
    if (c !== 0) return c;
    return a.title.localeCompare(b.title);
  });

  return out;
}

/**
 * Convenience: build lookup maps for fast rendering.
 */
export function buildCalendarMapsForYear(year: number): {
  startsMap: Map<string, CalendarEntry[]>;
  feastsMap: Map<string, CalendarEntry[]>;
  entries: CalendarEntry[];
} {
  const entries = buildCalendarForYear(year);

  const startsMap = new Map<string, CalendarEntry[]>();
  const feastsMap = new Map<string, CalendarEntry[]>();

  for (const e of entries) {
    if (!startsMap.has(e.startDate)) startsMap.set(e.startDate, []);
    startsMap.get(e.startDate)!.push(e);

    if (!feastsMap.has(e.feastDate)) feastsMap.set(e.feastDate, []);
    feastsMap.get(e.feastDate)!.push(e);
  }

  return { startsMap, feastsMap, entries };
}
