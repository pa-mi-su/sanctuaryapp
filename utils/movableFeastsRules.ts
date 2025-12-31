// utils/movableFeastsRules.ts
//
// YEAR-AWARE liturgical observances + season framework + colors.
// This file intentionally returns MANY entries so the Liturgical tab is not empty.
//
// All dates use UTC noon to avoid DST issues.

import {
  computeEasterSunday,
  toYmd,
  addDaysUTC,
  utcNoonDate,
  nextWeekday,
  prevWeekday,
} from "./liturgicalEngine";

export type LiturgicalRank =
  | "Triduum"
  | "Solemnity"
  | "Sunday"
  | "Feast"
  | "Memorial"
  | "Optional Memorial"
  | "Weekday";

export type LiturgicalColor = "Purple" | "White" | "Red" | "Green" | "Rose";

export type LiturgicalSeason =
  | "Advent"
  | "Christmas"
  | "Lent"
  | "Easter"
  | "Ordinary Time";

export type MovableObservance = {
  id: string;
  title: string;
  rank: LiturgicalRank;

  // gives the UI what a liturgical calendar must show
  color?: LiturgicalColor;
  season?: LiturgicalSeason;

  // optional: season boundary markers that help the tab feel complete
  kind?: "Celebration" | "SeasonMarker";
};

/** Helper: add an observance into map */
function push(
  out: Record<string, MovableObservance[]>,
  date: Date,
  obs: MovableObservance,
) {
  const key = toYmd(date);
  if (!out[key]) out[key] = [];
  out[key].push(obs);
}

/** Sort / dedupe by id per day, with rank priority */
function normalize(out: Record<string, MovableObservance[]>) {
  const weight = (r: LiturgicalRank) => {
    switch (r) {
      case "Triduum":
        return 6;
      case "Solemnity":
        return 5;
      case "Sunday":
        return 4;
      case "Feast":
        return 3;
      case "Memorial":
        return 2;
      case "Optional Memorial":
        return 1;
      case "Weekday":
      default:
        return 0;
    }
  };

  for (const k of Object.keys(out)) {
    const seen = new Set<string>();
    out[k] = out[k]
      .filter((x) => {
        if (seen.has(x.id)) return false;
        seen.add(x.id);
        return true;
      })
      .sort((a, b) => {
        const dw = weight(b.rank) - weight(a.rank);
        if (dw !== 0) return dw;
        return a.title.localeCompare(b.title);
      });
  }
}

/** Find the Sunday on/after a date */
function sundayOnOrAfter(d: Date): Date {
  return nextWeekday(d, 0, true);
}

/** Find the Sunday on/before a date */
function sundayOnOrBefore(d: Date): Date {
  return prevWeekday(d, 0, true);
}

function diffDaysUTC(a: Date, b: Date): number {
  // Dates are UTC noon; this is stable.
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

function ordinal(n: number): string {
  // 1..34 is all we need for Ordinary Time Sundays
  const words = [
    "",
    "First",
    "Second",
    "Third",
    "Fourth",
    "Fifth",
    "Sixth",
    "Seventh",
    "Eighth",
    "Ninth",
    "Tenth",
    "Eleventh",
    "Twelfth",
    "Thirteenth",
    "Fourteenth",
    "Fifteenth",
    "Sixteenth",
    "Seventeenth",
    "Eighteenth",
    "Nineteenth",
    "Twentieth",
    "Twenty-First",
    "Twenty-Second",
    "Twenty-Third",
    "Twenty-Fourth",
    "Twenty-Fifth",
    "Twenty-Sixth",
    "Twenty-Seventh",
    "Twenty-Eighth",
    "Twenty-Ninth",
    "Thirtieth",
    "Thirty-First",
    "Thirty-Second",
    "Thirty-Third",
    "Thirty-Fourth",
  ];
  return words[n] || `${n}th`;
}

/** Advent Sunday #1: Sunday on or after Nov 27 */
function firstSundayOfAdvent(year: number): Date {
  const nov27 = utcNoonDate(year, 10, 27);
  return sundayOnOrAfter(nov27);
}

/** Christ the King: Sunday before Advent 1 */
function christTheKing(year: number): Date {
  return addDaysUTC(firstSundayOfAdvent(year), -7);
}

/**
 * Baptism of the Lord:
 * simplified: Sunday after Jan 6.
 */
function baptismOfTheLord(year: number): Date {
  const jan6 = utcNoonDate(year, 0, 6);
  return nextWeekday(jan6, 0, false);
}

/** Ordinary Time begins: Monday after Baptism */
function ordinaryTimeBeginsPart1(year: number): Date {
  return addDaysUTC(baptismOfTheLord(year), 1);
}

/**
 * Ascension:
 * show both Thursday and transferred Sunday.
 */
function ascensionThursday(easter: Date): Date {
  return addDaysUTC(easter, 39);
}
function ascensionSunday(easter: Date): Date {
  return addDaysUTC(easter, 42);
}

/**
 * Corpus Christi:
 * Thursday after Trinity = Easter + 60; transferred Sunday = +63
 */
function corpusChristiThursday(easter: Date): Date {
  return addDaysUTC(easter, 60);
}
function corpusChristiSunday(easter: Date): Date {
  return addDaysUTC(easter, 63);
}

/**
 * Sacred Heart / Immaculate Heart:
 * Sacred Heart commonly = Easter + 68; IHM = +69
 */
function sacredHeart(easter: Date): Date {
  return addDaysUTC(easter, 68);
}
function immaculateHeart(easter: Date): Date {
  return addDaysUTC(easter, 69);
}

export function computeMovableFeastsForYear(
  year: number,
): Record<string, MovableObservance[]> {
  const out: Record<string, MovableObservance[]> = {};

  const easter = computeEasterSunday(year);

  // ---------------------------
  // SEASON FRAMEWORK (markers)
  // ---------------------------

  const a1 = firstSundayOfAdvent(year);
  const christmas = utcNoonDate(year, 11, 25); // fixed, but critical anchor
  const baptism = baptismOfTheLord(year);

  const ashWednesday = addDaysUTC(easter, -46);
  const holyThursday = addDaysUTC(easter, -3);
  const goodFriday = addDaysUTC(easter, -2);
  const holySaturday = addDaysUTC(easter, -1);
  const pentecost = addDaysUTC(easter, 49);

  push(out, a1, {
    id: "season_advent_begins",
    title: "Season begins: Advent",
    rank: "Sunday",
    color: "Purple",
    season: "Advent",
    kind: "SeasonMarker",
  });

  push(out, christmas, {
    id: "season_christmas_begins",
    title: "Season begins: Christmas",
    rank: "Solemnity",
    color: "White",
    season: "Christmas",
    kind: "SeasonMarker",
  });

  push(out, ordinaryTimeBeginsPart1(year), {
    id: "season_ordinary_time_begins_part1",
    title: "Season begins: Ordinary Time (after Baptism)",
    rank: "Weekday",
    color: "Green",
    season: "Ordinary Time",
    kind: "SeasonMarker",
  });

  push(out, ashWednesday, {
    id: "season_lent_begins",
    title: "Season begins: Lent (Ash Wednesday)",
    rank: "Weekday",
    color: "Purple",
    season: "Lent",
    kind: "SeasonMarker",
  });

  push(out, easter, {
    id: "season_easter_begins",
    title: "Season begins: Easter (Easter Sunday)",
    rank: "Solemnity",
    color: "White",
    season: "Easter",
    kind: "SeasonMarker",
  });

  push(out, addDaysUTC(pentecost, 1), {
    id: "season_ordinary_time_begins_part2",
    title: "Season resumes: Ordinary Time (after Pentecost)",
    rank: "Weekday",
    color: "Green",
    season: "Ordinary Time",
    kind: "SeasonMarker",
  });

  // ---------------------------
  // CHRISTMAS CYCLE (important fixed anchors)
  // ---------------------------

  push(out, utcNoonDate(year, 0, 1), {
    id: "mary_mother_of_god",
    title: "Mary, the Holy Mother of God",
    rank: "Solemnity",
    color: "White",
    season: "Christmas",
  });

  push(out, utcNoonDate(year, 0, 6), {
    id: "epiphany",
    title: "Epiphany of the Lord",
    rank: "Solemnity",
    color: "White",
    season: "Christmas",
  });

  push(out, baptism, {
    id: "baptism_of_the_lord",
    title: "Baptism of the Lord",
    rank: "Feast",
    color: "White",
    season: "Christmas",
  });

  // ---------------------------
  // ORDINARY TIME (Part 1) — Sundays after Baptism until Lent
  // ---------------------------

  const ot1Monday = ordinaryTimeBeginsPart1(year);
  const otPart1FirstSunday = sundayOnOrAfter(ot1Monday); // Sunday after OT begins
  const dayBeforeAsh = addDaysUTC(ashWednesday, -1);
  const otPart1LastSunday = sundayOnOrBefore(dayBeforeAsh);

  for (
    let s = otPart1FirstSunday;
    s.getTime() <= otPart1LastSunday.getTime();
    s = addDaysUTC(s, 7)
  ) {
    const week = 1 + Math.floor(diffDaysUTC(s, ot1Monday) / 7);
    const sundayNum = week + 1; // week 1 => "Second Sunday in Ordinary Time"
    push(out, s, {
      id: `ordinary_time_${sundayNum}_sunday_part1`,
      title: `${ordinal(sundayNum)} Sunday in Ordinary Time`,
      rank: "Sunday",
      color: "Green",
      season: "Ordinary Time",
    });
  }

  // ---------------------------
  // LENT / HOLY WEEK / EASTER
  // ---------------------------

  push(out, ashWednesday, {
    id: "ash_wednesday",
    title: "Ash Wednesday",
    rank: "Weekday",
    color: "Purple",
    season: "Lent",
  });

  const lent1 = addDaysUTC(ashWednesday, 4);
  push(out, lent1, {
    id: "lent_1",
    title: "First Sunday of Lent",
    rank: "Sunday",
    color: "Purple",
    season: "Lent",
  });

  push(out, addDaysUTC(lent1, 7), {
    id: "lent_2",
    title: "Second Sunday of Lent",
    rank: "Sunday",
    color: "Purple",
    season: "Lent",
  });

  push(out, addDaysUTC(lent1, 14), {
    id: "lent_3",
    title: "Third Sunday of Lent",
    rank: "Sunday",
    color: "Purple",
    season: "Lent",
  });

  const laetare = addDaysUTC(lent1, 21);
  push(out, laetare, {
    id: "lent_4_laetare",
    title: "Fourth Sunday of Lent (Laetare Sunday)",
    rank: "Sunday",
    color: "Rose",
    season: "Lent",
  });

  push(out, addDaysUTC(lent1, 28), {
    id: "lent_5",
    title: "Fifth Sunday of Lent",
    rank: "Sunday",
    color: "Purple",
    season: "Lent",
  });

  const palmSunday = addDaysUTC(easter, -7);
  push(out, palmSunday, {
    id: "palm_sunday",
    title: "Palm Sunday of the Passion of the Lord",
    rank: "Sunday",
    color: "Red",
    season: "Lent",
  });

  push(out, holyThursday, {
    id: "holy_thursday",
    title: "Holy Thursday (Evening Mass of the Lord’s Supper)",
    rank: "Triduum",
    color: "White",
    season: "Easter",
  });

  push(out, goodFriday, {
    id: "good_friday",
    title: "Good Friday of the Passion of the Lord",
    rank: "Triduum",
    color: "Red",
    season: "Easter",
  });

  push(out, holySaturday, {
    id: "holy_saturday",
    title: "Holy Saturday",
    rank: "Triduum",
    color: "Purple",
    season: "Easter",
  });

  push(out, easter, {
    id: "easter_sunday",
    title: "Easter Sunday of the Resurrection of the Lord",
    rank: "Solemnity",
    color: "White",
    season: "Easter",
  });

  // Easter Octave (Mon–Sat after Easter)
  for (let i = 1; i <= 6; i++) {
    push(out, addDaysUTC(easter, i), {
      id: `easter_octave_day_${i}`,
      title: `Easter Octave (Day ${i + 1})`,
      rank: "Solemnity",
      color: "White",
      season: "Easter",
    });
  }

  push(out, addDaysUTC(easter, 7), {
    id: "divine_mercy_sunday",
    title: "Second Sunday of Easter (Divine Mercy Sunday)",
    rank: "Sunday",
    color: "White",
    season: "Easter",
  });

  push(out, ascensionThursday(easter), {
    id: "ascension_thursday",
    title: "Ascension of the Lord (Thursday)",
    rank: "Solemnity",
    color: "White",
    season: "Easter",
  });
  push(out, ascensionSunday(easter), {
    id: "ascension_sunday",
    title: "Ascension of the Lord (Transferred to Sunday)",
    rank: "Solemnity",
    color: "White",
    season: "Easter",
  });

  push(out, pentecost, {
    id: "pentecost",
    title: "Pentecost Sunday",
    rank: "Solemnity",
    color: "Red",
    season: "Easter",
  });

  // ---------------------------
  // ORDINARY TIME (Part 2) — Sundays after Pentecost until Christ the King
  // ---------------------------

  const ot2Monday = addDaysUTC(pentecost, 1);

  // What OT week number did we reach before Lent?
  const lastOTWeekBeforeLent =
    1 + Math.floor(diffDaysUTC(dayBeforeAsh, ot1Monday) / 7);

  const ot2BaseWeek = lastOTWeekBeforeLent + 1;

  const ot2FirstSunday = sundayOnOrAfter(ot2Monday); // Trinity Sunday lands here
  const ot2LastSunday = christTheKing(year);

  for (
    let s = ot2FirstSunday;
    s.getTime() <= ot2LastSunday.getTime();
    s = addDaysUTC(s, 7)
  ) {
    const week = ot2BaseWeek + Math.floor(diffDaysUTC(s, ot2Monday) / 7);
    const sundayNum = week + 1;

    // Cap at 34 to avoid weirdness in edge cases
    if (sundayNum > 34) break;

    push(out, s, {
      id: `ordinary_time_${sundayNum}_sunday_part2`,
      title: `${ordinal(sundayNum)} Sunday in Ordinary Time`,
      rank: "Sunday",
      color: "Green",
      season: "Ordinary Time",
    });
  }

  // ---------------------------
  // OTHER IMPORTANT MOVEABLES
  // ---------------------------

  const trinity = addDaysUTC(easter, 56);
  push(out, trinity, {
    id: "trinity_sunday",
    title: "Trinity Sunday",
    rank: "Solemnity",
    color: "White",
    season: "Ordinary Time",
  });

  push(out, corpusChristiThursday(easter), {
    id: "corpus_christi_thursday",
    title: "The Most Holy Body and Blood of Christ (Corpus Christi) — Thursday",
    rank: "Solemnity",
    color: "White",
    season: "Ordinary Time",
  });
  push(out, corpusChristiSunday(easter), {
    id: "corpus_christi_sunday",
    title: "The Most Holy Body and Blood of Christ (Corpus Christi) — Sunday",
    rank: "Solemnity",
    color: "White",
    season: "Ordinary Time",
  });

  push(out, sacredHeart(easter), {
    id: "sacred_heart",
    title: "Most Sacred Heart of Jesus",
    rank: "Solemnity",
    color: "White",
    season: "Ordinary Time",
  });
  push(out, immaculateHeart(easter), {
    id: "immaculate_heart",
    title: "Immaculate Heart of Mary",
    rank: "Memorial",
    color: "White",
    season: "Ordinary Time",
  });

  // ---------------------------
  // ADVENT + END OF YEAR SUNDAYS
  // ---------------------------

  const a2 = addDaysUTC(a1, 7);
  const a3 = addDaysUTC(a1, 14);
  const a4 = addDaysUTC(a1, 21);

  push(out, a1, {
    id: "advent_1",
    title: "First Sunday of Advent",
    rank: "Sunday",
    color: "Purple",
    season: "Advent",
  });
  push(out, a2, {
    id: "advent_2",
    title: "Second Sunday of Advent",
    rank: "Sunday",
    color: "Purple",
    season: "Advent",
  });
  push(out, a3, {
    id: "advent_3_gaudete",
    title: "Third Sunday of Advent (Gaudete Sunday)",
    rank: "Sunday",
    color: "Rose",
    season: "Advent",
  });
  push(out, a4, {
    id: "advent_4",
    title: "Fourth Sunday of Advent",
    rank: "Sunday",
    color: "Purple",
    season: "Advent",
  });

  push(out, christTheKing(year), {
    id: "christ_king",
    title: "Our Lord Jesus Christ, King of the Universe (Christ the King)",
    rank: "Solemnity",
    color: "White",
    season: "Ordinary Time",
  });

  normalize(out);
  return out;
}
