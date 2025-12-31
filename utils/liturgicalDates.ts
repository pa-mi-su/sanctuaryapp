// utils/liturgicalDates.ts
//
// Canonical liturgical anchor builder for novenasRules.ts
// - Uses UTC noon everywhere to avoid DST edge cases
// - Provides stable anchor keys referenced by novenas_index.json parsing
//
// IMPORTANT:
// - If a rule references an anchor that is missing here, novenasRules.ts will throw
//   `Missing/invalid anchor: <key>`.
// - So we keep this file generous with common Roman-calendar anchors.

import {
  utcNoonDate,
  addDaysUTC,
  computeEasterSunday,
  nextWeekday,
  prevWeekday,
} from "./liturgicalEngine";
import type { Anchors } from "./novenasRules";

/**
 * Holy Family (Roman Rite, simplified but correct enough for app logic):
 * - Sunday within the Octave of Christmas (Dec 26–31)
 * - If no Sunday occurs in that range (when Christmas is Sunday), it's Dec 30
 */
function holyFamily(year: number): Date {
  const dec26 = utcNoonDate(year, 11, 26);
  for (let i = 0; i <= 5; i++) {
    const d = addDaysUTC(dec26, i);
    if (d.getUTCDay() === 0) return d; // Sunday
  }
  return utcNoonDate(year, 11, 30);
}

/**
 * Advent 1 (simplified but standard):
 * - Sunday on or after Nov 27
 */
function firstSundayOfAdvent(year: number): Date {
  const nov27 = utcNoonDate(year, 10, 27); // month is 0-based
  return nextWeekday(nov27, 0, true); // Sunday on/after
}

/**
 * Christ the King:
 * - Sunday before Advent 1
 */
function christTheKing(year: number): Date {
  return addDaysUTC(firstSundayOfAdvent(year), -7);
}

export function buildNovenaAnchorsForYear(year: number): Anchors {
  // Core movable cycle
  const easter = computeEasterSunday(year);

  const ash_wednesday = addDaysUTC(easter, -46);
  const shrove_tuesday = addDaysUTC(ash_wednesday, -1);

  const palm_sunday = addDaysUTC(easter, -7);
  const holy_thursday = addDaysUTC(easter, -3);
  const good_friday = addDaysUTC(easter, -2);
  const holy_saturday = addDaysUTC(easter, -1);

  const divine_mercy_sunday = addDaysUTC(easter, 7);

  // Ascension (both forms)
  const ascension_thursday = addDaysUTC(easter, 39);
  const ascension_sunday = addDaysUTC(easter, 42);

  const pentecost = addDaysUTC(easter, 49);

  // Trinity + Corpus Christi (both forms)
  const trinity_sunday = addDaysUTC(easter, 56);
  // Corpus Christi Thursday = Easter + 60; transferred Sunday = +63
  const corpus_christi = addDaysUTC(easter, 60);
  const corpus_christi_sunday = addDaysUTC(easter, 63);

  // Sacred Heart / Immaculate Heart
  const sacred_heart = addDaysUTC(easter, 68);
  const immaculate_heart = addDaysUTC(easter, 69);

  // Fixed anchors commonly referenced
  const christmas = utcNoonDate(year, 11, 25);
  const mary_mother_of_god = utcNoonDate(year, 0, 1);
  const epiphany = utcNoonDate(year, 0, 6);

  // Baptism of the Lord (simplified: Sunday after Jan 6)
  const baptism_of_the_lord = nextWeekday(epiphany, 0, false);

  const holy_family = holyFamily(year);

  // “Season-ish” anchors that often show up in devotion rules / future parsing
  const advent_1 = firstSundayOfAdvent(year);
  const christ_king = christTheKing(year);

  // A few very common fixed feast anchors (harmless to include)
  const annunciation = utcNoonDate(year, 2, 25); // Mar 25
  const assumption = utcNoonDate(year, 7, 15); // Aug 15
  const all_saints = utcNoonDate(year, 10, 1); // Nov 1
  const immaculate_conception = utcNoonDate(year, 11, 8); // Dec 8

  // Useful helpers if a future rule says "Sunday before X" etc.
  // (These are not used directly today, but are safe anchors.)
  const christmas_eve = utcNoonDate(year, 11, 24);
  const new_years_eve = utcNoonDate(year, 11, 31);

  return {
    // core
    easter,
    ash_wednesday,
    shrove_tuesday,
    palm_sunday,
    holy_thursday,
    good_friday,
    holy_saturday,
    divine_mercy_sunday,
    ascension_thursday,
    ascension_sunday,
    pentecost,
    trinity_sunday,
    corpus_christi,
    corpus_christi_sunday,
    sacred_heart,
    immaculate_heart,

    // christmas cycle + holy family
    christmas,
    christmas_eve,
    mary_mother_of_god,
    new_years_eve,
    epiphany,
    baptism_of_the_lord,
    holy_family,

    // season markers
    advent_1,
    christ_king,

    // common fixed feasts
    annunciation,
    assumption,
    all_saints,
    immaculate_conception,
  };
}
