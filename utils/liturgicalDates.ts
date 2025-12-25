// utils/liturgicalDates.ts

export type FixedRule = { type: "fixed"; month: number; day: number };
export type AnchorRule = { type: "anchor"; anchor: string };
export type RelativeRule = {
  type: "relative";
  anchor: string;
  offsetDays: number;
  weekday?: number; // if provided, snap FORWARD to this weekday
};
export type NthWeekdayAfterRule = {
  type: "nth_weekday_after";
  anchor: string;
  weekday: number; // 0=Sun..6=Sat
  n: number; // 1 = first occurrence after anchor
};
export type BeforeFeastRule = { type: "before_feast"; daysBefore: number };
export type RawRule = { type: "raw"; text: string };

export type Rule =
  | FixedRule
  | AnchorRule
  | RelativeRule
  | NthWeekdayAfterRule
  | BeforeFeastRule
  | RawRule;

export type NovenaIndexEntry = {
  id: string;
  title: string;
  startRule: Rule;
  feastRule: Rule;
  category: string;
  tags: string[];
  description: string | null;
  patronage: string[];
  image: string | null;
  notes: string | null;
  source?: { url: string };
};

export type ComputedNovenaDates = {
  startDate: Date;
  feastDate: Date;
};

function utcDate(y: number, m: number, d: number): Date {
  // m is 1..12
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dayOfWeekUTC(date: Date): number {
  return date.getUTCDay(); // 0..6
}

function snapForwardToWeekday(date: Date, weekday: number): Date {
  const cur = dayOfWeekUTC(date);
  const delta = (weekday - cur + 7) % 7;
  return addDays(date, delta);
}

/**
 * Meeus/Jones/Butcher algorithm for Gregorian Easter Sunday.
 */
export function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Apr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

/**
 * Anchor map.
 * NOTE: We choose the "Thursday" version of Ascension (Easter+39) because your rules say "Ascension Thursday".
 */
export function computeAnchorDate(anchor: string, year: number): Date {
  const a = anchor.toLowerCase();

  const easter = computeEasterSunday(year);

  switch (a) {
    case "easter":
    case "easter_sunday":
      return easter;

    case "good_friday":
      return addDays(easter, -2);

    case "divine_mercy_sunday":
      return addDays(easter, 7);

    case "pentecost":
      return addDays(easter, 49);

    case "ascension_thursday":
      return addDays(easter, 39);

    case "corpus_christi":
      // Traditional: Thursday after Trinity Sunday => Easter + 60
      return addDays(easter, 60);

    case "ash_wednesday":
      // 46 days before Easter (40 fasting days + 6 Sundays)
      return addDays(easter, -46);

    case "shrove_tuesday":
      // Day before Ash Wednesday
      return addDays(easter, -47);

    case "christmas":
    case "christmas_day":
      return utcDate(year, 12, 25);

    case "mary_mother_of_god":
      return utcDate(year, 1, 1);

    // ✅ NEW: Holy Family (Sunday within the Octave of Christmas)
    // Sunday between Dec 26 and Dec 31 inclusive, otherwise Dec 30.
    case "holy_family": {
      const dec26 = utcDate(year, 12, 26);
      for (let i = 0; i <= 5; i++) {
        const d = addDays(dec26, i); // Dec 26..Dec 31
        if (dayOfWeekUTC(d) === 0) return d; // Sunday
      }
      return utcDate(year, 12, 30);
    }

    default:
      throw new Error(`Unknown anchor: ${anchor}`);
  }
}

function computeDateForRule(
  rule: Rule,
  year: number,
  ctx: { feastDate?: Date },
): Date {
  switch (rule.type) {
    case "fixed":
      return utcDate(year, rule.month, rule.day);

    case "anchor":
      return computeAnchorDate(rule.anchor, year);

    case "relative": {
      const base = computeAnchorDate(rule.anchor, year);
      const shifted = addDays(base, rule.offsetDays);
      if (typeof rule.weekday === "number")
        return snapForwardToWeekday(shifted, rule.weekday);
      return shifted;
    }

    case "nth_weekday_after": {
      const base = computeAnchorDate(rule.anchor, year);
      // Start from the NEXT day after anchor, then find the first desired weekday.
      const firstWindow = addDays(base, 1);
      const first = snapForwardToWeekday(firstWindow, rule.weekday);
      return addDays(first, (rule.n - 1) * 7);
    }

    case "before_feast": {
      if (!ctx.feastDate)
        throw new Error("before_feast used but feastDate not provided");
      return addDays(ctx.feastDate, -rule.daysBefore);
    }

    case "raw":
      throw new Error(`Unrecognized raw rule: ${rule.text}`);

    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

/**
 * Strict computation:
 * - Compute feast first (so start can reference it)
 * - Then compute start
 * - Enforce start <= feast (not required for every novena, but sane default)
 *
 * ✅ FIX: Handle cross-year novenas:
 * If start (computed in same year) is after feast, retry start using (year-1).
 */
export function computeNovenaDatesForYearStrict(
  entry: NovenaIndexEntry,
  year: number,
): ComputedNovenaDates {
  const feastDate = computeDateForRule(entry.feastRule, year, {});

  // attempt 1: same year
  let startDate = computeDateForRule(entry.startRule, year, { feastDate });

  // ✅ cross-year fix: if start > feast, retry start in previous year
  if (startDate.getTime() > feastDate.getTime()) {
    const startPrevYear = computeDateForRule(entry.startRule, year - 1, {
      feastDate,
    });

    if (startPrevYear.getTime() <= feastDate.getTime()) {
      startDate = startPrevYear;
    }
  }

  // sanity: if start still comes after feast, that's a real rule/data bug
  if (startDate.getTime() > feastDate.getTime()) {
    throw new Error(
      `Start date is after feast date (${startDate.toISOString()} > ${feastDate.toISOString()})`,
    );
  }

  return { startDate, feastDate };
}
