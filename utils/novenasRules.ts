// utils/novenasRules.ts
//
// Canonical Novena Rules + Resolver
//
// POLICY (this is the key):
// - feastRule is authoritative.
// - durationDays is authoritative (default 9).
// - startRule is OPTIONAL and treated as "scraped hint":
//     - If it matches feast - (durationDays - 1), we accept it.
//     - If it does NOT match, we IGNORE it and compute start from feast.
//   This avoids endless crashes caused by off-by-one scraped "Starts:" dates.
//
// - Also handles fixed-date year boundary (Dec -> Jan) safely.
// - All internal math uses UTC midnight to avoid DST edge cases.

export type RuleType =
  | "fixed"
  | "anchor"
  | "relative"
  | "nth_weekday_after"
  | "before_feast";

export type AnchorKey = string;

export type FixedRule = { type: "fixed"; month: number; day: number };
export type AnchorRule = { type: "anchor"; anchor: AnchorKey };
export type RelativeRule = {
  type: "relative";
  anchor: AnchorKey;
  offsetDays: number;
  weekday?: number; // 0=Sun..6=Sat
  weekdayPolicy?: "onOrAfter" | "onOrBefore";
};
export type NthWeekdayAfterRule = {
  type: "nth_weekday_after";
  anchor: AnchorKey;
  weekday: number; // 0=Sun..6=Sat
  n: number;
};
export type BeforeFeastRule = {
  type: "before_feast";
  daysBefore: number;
  anchor?: AnchorKey;
};

export type NovenaRule =
  | FixedRule
  | AnchorRule
  | RelativeRule
  | NthWeekdayAfterRule
  | BeforeFeastRule;

export type NovenaCategory =
  | "Devotion"
  | "Marian"
  | "Feast"
  | "Saint"
  | "Intention";

export type NovenaDef = {
  id: string;
  title: string;

  feastRule: NovenaRule;
  startRule?: NovenaRule;

  // inclusive duration (start..feast inclusive)
  durationDays?: number;

  category: NovenaCategory;
  tags?: string[];
  description?: string | null;
  patronage?: string[];
  image?: string | null;
  notes?: string | null;
  source?: { url?: string };
};

export type Anchors = Record<AnchorKey, Date>;

export type NovenaInstance = {
  id: string;
  title: string;
  category: NovenaCategory;
  tags: string[];
  startDate: Date;
  feastDate: Date;
  durationDays: number;
  sourceUrl?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function assert(cond: any, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function isValidDate(d: any): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

function toUTCDate(y: number, m1: number, d: number): Date {
  return new Date(Date.UTC(y, m1 - 1, d, 0, 0, 0, 0));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function diffDays(a: Date, b: Date): number {
  const aa = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bb = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((bb - aa) / MS_PER_DAY);
}

function clampWeekday(d: number): number {
  assert(
    Number.isInteger(d) && d >= 0 && d <= 6,
    `weekday must be 0..6, got ${d}`,
  );
  return d;
}

function weekdayUTC(date: Date): number {
  return date.getUTCDay();
}

function alignToWeekday(
  base: Date,
  targetWeekday: number,
  policy: "onOrAfter" | "onOrBefore",
): Date {
  const w = weekdayUTC(base);
  const target = clampWeekday(targetWeekday);
  if (w === target) return base;

  if (policy === "onOrAfter") {
    const delta = (target - w + 7) % 7;
    return addDays(base, delta);
  } else {
    const deltaBack = (w - target + 7) % 7;
    return addDays(base, -deltaBack);
  }
}

export function normalizeAnchors(anchors: Anchors): Anchors {
  const out: Anchors = {};
  for (const [k, v] of Object.entries(anchors)) {
    if (!isValidDate(v)) continue;
    out[k] = toUTCDate(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }
  return out;
}

function resolveRule(
  rule: NovenaRule,
  year: number,
  anchorsRaw: Anchors,
  ctx?: { feastRule?: NovenaRule },
): Date {
  const anchors = normalizeAnchors(anchorsRaw);

  switch (rule.type) {
    case "fixed": {
      assert(
        rule.month >= 1 && rule.month <= 12,
        `fixed.month must be 1..12, got ${rule.month}`,
      );
      assert(
        rule.day >= 1 && rule.day <= 31,
        `fixed.day must be 1..31, got ${rule.day}`,
      );
      return toUTCDate(year, rule.month, rule.day);
    }

    case "anchor": {
      const a = anchors[rule.anchor];
      assert(isValidDate(a), `Missing/invalid anchor: ${rule.anchor}`);
      return toUTCDate(a.getUTCFullYear(), a.getUTCMonth() + 1, a.getUTCDate());
    }

    case "relative": {
      const base = resolveRule(
        { type: "anchor", anchor: rule.anchor },
        year,
        anchors,
      );
      const moved = addDays(base, rule.offsetDays);
      if (typeof rule.weekday === "number") {
        const policy = rule.weekdayPolicy ?? "onOrAfter";
        return alignToWeekday(moved, rule.weekday, policy);
      }
      return moved;
    }

    case "nth_weekday_after": {
      const base = resolveRule(
        { type: "anchor", anchor: rule.anchor },
        year,
        anchors,
      );
      const target = clampWeekday(rule.weekday);
      assert(
        rule.n >= 1 && Number.isInteger(rule.n),
        `nth_weekday_after.n must be integer >=1, got ${rule.n}`,
      );

      let d = addDays(base, 1);
      let count = 0;
      while (true) {
        if (weekdayUTC(d) === target) {
          count++;
          if (count === rule.n) return d;
        }
        d = addDays(d, 1);
      }
    }

    case "before_feast": {
      // Inclusive rule:
      // If feast day is included in the 9 days, start = feast - (9 - 1)
      assert(
        Number.isInteger(rule.daysBefore) && rule.daysBefore >= 1,
        `before_feast.daysBefore must be integer >=1, got ${rule.daysBefore}`,
      );

      const anchor =
        rule.anchor ??
        (ctx?.feastRule?.type === "anchor" ? ctx.feastRule.anchor : undefined);

      assert(
        anchor,
        `before_feast requires anchor or feastRule must be type=anchor`,
      );

      const feast = resolveRule({ type: "anchor", anchor }, year, anchors);
      return addDays(feast, -(rule.daysBefore - 1));
    }

    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

/**
 * Fixed/fixed year boundary helper:
 * If start is fixed and resolves AFTER feast (e.g. Dec 29 vs Jan 6),
 * roll start back to year-1.
 */
function maybeRollFixedStartAcrossYear(
  n: NovenaDef,
  year: number,
  startDate: Date,
  feastDate: Date,
): Date {
  if (n.startRule?.type !== "fixed") return startDate;
  if (startDate.getTime() > feastDate.getTime()) {
    return toUTCDate(year - 1, n.startRule.month, n.startRule.day);
  }
  return startDate;
}

function normalizeDurationDays(n: NovenaDef): number {
  const d = n.durationDays ?? 9;
  assert(
    Number.isInteger(d) && d >= 1 && d <= 4000,
    `durationDays invalid for ${n.id}: ${d}`,
  );
  return d;
}

export function resolveNovenaForYear(
  n: NovenaDef,
  year: number,
  anchors: Anchors,
): NovenaInstance {
  const durationDays = normalizeDurationDays(n);

  // 1) resolve feast/end date (authoritative)
  const feastDate = resolveRule(n.feastRule, year, anchors);

  // 2) compute canonical start from feast + duration (authoritative)
  const computedStart = addDays(feastDate, -(durationDays - 1));

  // 3) if we have a startRule, only accept it if it matches computedStart
  let startDate = computedStart;

  if (n.startRule) {
    let hinted = resolveRule(n.startRule, year, anchors, {
      feastRule: n.feastRule,
    });
    hinted = maybeRollFixedStartAcrossYear(n, year, hinted, feastDate);

    if (hinted.getTime() === computedStart.getTime()) {
      startDate = hinted; // matches: accept
    } else {
      // mismatch: ignore startRule (scraped data is often off-by-one)
      startDate = computedStart;
    }
  }

  // 4) validate
  assert(
    startDate.getTime() <= feastDate.getTime(),
    `Novena ${n.id} invalid: start after feast (${startDate.toISOString()} > ${feastDate.toISOString()})`,
  );

  const span = diffDays(startDate, feastDate) + 1;
  assert(
    span === durationDays,
    `Novena ${n.id} duration mismatch: computed inclusive span=${span} but durationDays=${durationDays}`,
  );

  return {
    id: n.id,
    title: n.title,
    category: n.category,
    tags: n.tags ?? [],
    startDate,
    feastDate,
    durationDays,
    sourceUrl: n.source?.url,
  };
}

export function resolveNovenasForYear(
  novenas: NovenaDef[],
  year: number,
  anchors: Anchors,
): NovenaInstance[] {
  const out: NovenaInstance[] = [];
  for (const n of novenas) out.push(resolveNovenaForYear(n, year, anchors));

  out.sort((a, b) => {
    const d = a.startDate.getTime() - b.startDate.getTime();
    if (d !== 0) return d;
    return a.title.localeCompare(b.title);
  });
  return out;
}

/**
 * Optional: if you want to clean data on load in the future,
 * you can drop startRule entirely for scraped entries and rely on computedStart.
 */
export function autoFixLegacyNovena(n: NovenaDef): NovenaDef {
  return { ...n };
}
