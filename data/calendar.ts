// data/calendar.ts
//
// Canonical calendar builder for Novenas
// - Uses data/novenas_index.json (rules)
// - Uses utils/liturgicalDates.ts to build anchors per year
// - Uses utils/novenasRules.ts to resolve instances
//
// Provides:
//   - NOVENAS (raw defs)
//   - getNovenasForYear(year)
//   - buildCalendarMapsForYear(year)  ✅ used by app/(tabs)/novenas.tsx

import novenasIndex from "./novenas_index.json";
import { resolveNovenasForYear } from "../utils/novenasRules";
import type { NovenaDef, NovenaInstance } from "../utils/novenasRules";
import { buildNovenaAnchorsForYear } from "../utils/liturgicalDates";

// Raw novena definitions (rules + metadata)
export const NOVENAS: NovenaDef[] = novenasIndex as unknown as NovenaDef[];

// --- small helpers ---
function toYmdUTC(d: Date): string {
  // novenasRules.ts normalizes to UTC midnight; ISO slice is stable.
  return d.toISOString().slice(0, 10);
}

export function getNovenasForYear(year: number): NovenaInstance[] {
  const anchors = buildNovenaAnchorsForYear(year);
  return resolveNovenasForYear(NOVENAS, year, anchors);
}

/**
 * Builds maps used by the Novenas tab UI:
 * - startsMap: Map(YYYY-MM-DD -> novenas starting that day)
 * - feastsMap: Map(YYYY-MM-DD -> novenas ending/feast that day)
 *
 * IMPORTANT:
 * Your UI code (old novenas.tsx) calls src.entries() so these MUST be Maps.
 */
export function buildCalendarMapsForYear(year: number): {
  startsMap: Map<string, NovenaInstance[]>;
  feastsMap: Map<string, NovenaInstance[]>;
} {
  const instances = getNovenasForYear(year);

  const startsMap = new Map<string, NovenaInstance[]>();
  const feastsMap = new Map<string, NovenaInstance[]>();

  for (const n of instances) {
    const startKey = toYmdUTC(n.startDate);
    const feastKey = toYmdUTC(n.feastDate);

    if (!startsMap.has(startKey)) startsMap.set(startKey, []);
    startsMap.get(startKey)!.push(n);

    if (!feastsMap.has(feastKey)) feastsMap.set(feastKey, []);
    feastsMap.get(feastKey)!.push(n);
  }

  // Stable ordering (nice UI + deterministic)
  for (const arr of startsMap.values()) {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  }
  for (const arr of feastsMap.values()) {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  }

  return { startsMap, feastsMap };
}
