// utils/movableFeastsRules.ts
//
// Movable feast rules (YEAR-AWARE).
// Fixed-date observances remain in saints_by_mmdd.json.
//
// NOTE: This file is the renamed home for what used to be saintsRules.ts.
// (Same behavior, corrected naming.)

import { computeEasterSunday, toYmd } from "./liturgicalEngine";

export type MovableFeastRule = {
  id: string;
  title: string;
  rank?: "Solemnity" | "Feast" | "Memorial" | "Optional Memorial";
  computeDate: (year: number) => Date;
};

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function utcNoon(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day, 12, 0, 0));
}

export const MOVABLE_FEAST_RULES: MovableFeastRule[] = [
  {
    id: "baptism_of_the_lord",
    title: "Baptism of the Lord",
    rank: "Feast",
    computeDate: (year) => {
      // Simplified: Sunday after Jan 6
      const jan6 = utcNoon(year, 0, 6);
      const dow = jan6.getUTCDay(); // 0=Sun
      const offset = dow === 0 ? 7 : 7 - dow;
      return addDaysUTC(jan6, offset);
    },
  },

  {
    id: "easter_sunday",
    title: "Easter Sunday",
    rank: "Solemnity",
    computeDate: (y) => computeEasterSunday(y),
  },

  {
    id: "ash_wednesday",
    title: "Ash Wednesday",
    computeDate: (y) => addDaysUTC(computeEasterSunday(y), -46),
  },

  {
    id: "palm_sunday",
    title: "Palm Sunday",
    computeDate: (y) => addDaysUTC(computeEasterSunday(y), -7),
  },

  {
    id: "holy_thursday",
    title: "Holy Thursday",
    computeDate: (y) => addDaysUTC(computeEasterSunday(y), -3),
  },
  {
    id: "good_friday",
    title: "Good Friday",
    computeDate: (y) => addDaysUTC(computeEasterSunday(y), -2),
  },
  {
    id: "holy_saturday",
    title: "Holy Saturday",
    computeDate: (y) => addDaysUTC(computeEasterSunday(y), -1),
  },

  {
    id: "pentecost",
    title: "Pentecost Sunday",
    rank: "Solemnity",
    computeDate: (y) => addDaysUTC(computeEasterSunday(y), 49),
  },

  {
    id: "trinity_sunday",
    title: "Trinity Sunday",
    rank: "Solemnity",
    computeDate: (y) => addDaysUTC(computeEasterSunday(y), 56),
  },

  {
    id: "corpus_christi",
    title: "Corpus Christi",
    rank: "Solemnity",
    computeDate: (y) => addDaysUTC(computeEasterSunday(y), 60), // Thu after Trinity Sunday
  },
];

export function computeMovableFeastsForYear(
  year: number,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};

  for (const rule of MOVABLE_FEAST_RULES) {
    const d = rule.computeDate(year);
    const key = toYmd(d);
    if (!out[key]) out[key] = [];
    out[key].push(rule.title);
  }

  for (const k of Object.keys(out)) out[k].sort((a, b) => a.localeCompare(b));
  return out;
}
