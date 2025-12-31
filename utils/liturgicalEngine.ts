// utils/liturgicalEngine.ts
//
// Small, deterministic liturgical date helpers.
// NOTE: We keep all dates in UTC at noon to avoid DST edge cases.
//

/**
 * Create a date at UTC noon (stable across DST boundaries).
 * Exported so other modules (movable rules, etc.) can share the same primitive.
 */
export function utcNoonDate(y: number, m0: number, d: number) {
  return new Date(Date.UTC(y, m0, d, 12, 0, 0, 0));
}

export function toYmd(d: Date) {
  // ISO string is UTC-based, so this is safe and deterministic.
  return d.toISOString().slice(0, 10);
}

/**
 * Adds N days in UTC (stable across DST changes).
 * Assumes input date is already normalized (we use UTC noon everywhere).
 */
export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Alias with clearer name for the liturgical rules files.
 */
export const addDaysUTC = addDays;

/**
 * Move date forward to next weekday (0=Sun..6=Sat).
 * If `includeSameDay` is true and d already matches, returns d unchanged.
 */
export function nextWeekday(d: Date, weekday: number, includeSameDay = false) {
  const cur = d.getUTCDay();
  let delta = (weekday - cur + 7) % 7;
  if (delta === 0 && !includeSameDay) delta = 7;
  return addDays(d, delta);
}

/**
 * Move date backward to previous weekday (0=Sun..6=Sat).
 * If `includeSameDay` is true and d already matches, returns d unchanged.
 */
export function prevWeekday(d: Date, weekday: number, includeSameDay = false) {
  const cur = d.getUTCDay();
  let delta = (cur - weekday + 7) % 7;
  if (delta === 0 && !includeSameDay) delta = 7;
  return addDays(d, -delta);
}

/**
 * Gregorian computus for Easter Sunday.
 * Returns a Date at UTC noon.
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
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return utcNoonDate(year, month - 1, day);
}

/**
 * Build a map of movable feast/season anchors for a year.
 * (Keep whatever you already had; this is a minimal, safe structure.)
 */
export function buildMoveableMapForYear(year: number) {
  const easter = computeEasterSunday(year);

  const ashWednesday = addDays(easter, -46);
  const palmSunday = addDays(easter, -7);
  const holyThursday = addDays(easter, -3);
  const goodFriday = addDays(easter, -2);
  const holySaturday = addDays(easter, -1);
  const pentecost = addDays(easter, 49);

  // Christmas fixed (UTC noon)
  const christmas = utcNoonDate(year, 11, 25);

  return {
    year,
    easter,
    ashWednesday,
    palmSunday,
    holyThursday,
    goodFriday,
    holySaturday,
    pentecost,
    christmas,
  };
}

/**
 * Optional: a simple helper if you already use this elsewhere.
 * If you already had a richer implementation, keep your original logic;
 * this is just a safe placeholder that won't crash.
 */
export function getLiturgicalDay(date: Date) {
  return {
    date: toYmd(date),
  };
}
