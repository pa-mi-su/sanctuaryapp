// scripts/build-saints-calendar.ts
//
// Build a fixed-date saints calendar by scraping a Roman Martyrology website (month pages),
// with a deterministic fallback for missing days.
//
// Primary (month pages):
//   https://www.ecatholic2000.com/roman-martyrology/01-jan.shtml
//   ...
//   https://www.ecatholic2000.com/roman-martyrology/12-dec.shtml
//
// Fallback (per-day Martyrology text):
//   Divinum Officium (Tridentine - 1888, English) Prime output contains a “Martyrology {anticip.}” section.
//   We fetch just for days that the primary scrape is missing.
//
// Writes:
//   data/saints_by_mmdd.json
//
// Run:
//   npx tsx scripts/build-saints-calendar.ts
//

import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

type DaySaints = {
  feast: string | null;
  saints: string[];
  featuredSaint: string | null;
  source: {
    kind: "roman_martyrology_site";
    site: string;
    pages: string[];
    fetchedAtISO: string;
    fallback?: {
      kind: "divinum_officium";
      site: string;
      version: string;
      lang: string;
      usedFor: string[]; // mmdd keys where fallback populated saints
    };
  };
};

type SaintsByMmdd = Record<string, DaySaints>;

const SITE_BASE = "https://www.ecatholic2000.com/roman-martyrology";

const MONTH_PAGES: Array<{ month: number; url: string }> = [
  { month: 1, url: `${SITE_BASE}/01-jan.shtml` },
  { month: 2, url: `${SITE_BASE}/02-feb.shtml` },
  { month: 3, url: `${SITE_BASE}/03-mar.shtml` },
  { month: 4, url: `${SITE_BASE}/04-apr.shtml` },
  { month: 5, url: `${SITE_BASE}/05-may.shtml` },
  { month: 6, url: `${SITE_BASE}/06-jun.shtml` },
  { month: 7, url: `${SITE_BASE}/07-jul.shtml` },
  { month: 8, url: `${SITE_BASE}/08-aug.shtml` },
  { month: 9, url: `${SITE_BASE}/09-sep.shtml` },
  { month: 10, url: `${SITE_BASE}/10-oct.shtml` },
  { month: 11, url: `${SITE_BASE}/11-nov.shtml` },
  { month: 12, url: `${SITE_BASE}/12-dec.shtml` },
];

// Fallback source (per-day). This mirror is consistently reachable in practice.
const DO_SITE_BASE = "https://isidore.co/divinum/cgi-bin/horas/Pofficium.pl";
const DO_VERSION = "Tridentine - 1888";
const DO_LANG = "English";

// Use a leap template year so 02-29 exists as a key.
const TEMPLATE_YEAR = 2024;

const MONTH_NUM_TO_NAME: Record<number, string> = {
  1: "January",
  2: "February",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "August",
  9: "September",
  10: "October",
  11: "November",
  12: "December",
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function mmdd(month: number, day: number) {
  return `${pad2(month)}-${pad2(day)}`;
}

function cleanText(s: string) {
  return (s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function uniq(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of arr) {
    const k = cleanText(a);
    if (!k) continue;
    const kk = k.toLowerCase();
    if (seen.has(kk)) continue;
    seen.add(kk);
    out.push(k);
  }
  return out;
}

function safeAtomicWrite(outPath: string, contents: string) {
  const tmpPath = outPath + ".tmp";
  fs.writeFileSync(tmpPath, contents, "utf8");
  fs.renameSync(tmpPath, outPath);
}

function daysInMonth(m: number) {
  return new Date(Date.UTC(TEMPLATE_YEAR, m, 0)).getUTCDate(); // m is 1..12
}

function makeEmptyYear(source: DaySaints["source"]): SaintsByMmdd {
  const out: SaintsByMmdd = {};
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= daysInMonth(m); d++) {
      out[mmdd(m, d)] = {
        feast: null,
        saints: [],
        featuredSaint: null,
        source,
      };
    }
  }
  // Make 02-29 explicit in UI even if it stays empty.
  if (out["02-29"]) out["02-29"].feast = "Leap Day (Feb 29)";
  return out;
}

function isJunkName(name: string) {
  const n = cleanText(name).toLowerCase();
  if (!n) return true;
  if (n === "all saints for today") return true;
  if (n === "all saints") return true;
  if (n === "saint") return true;
  if (n === "saints") return true;
  return false;
}

function stripBracketedAndParens(s: string): string {
  let out = s ?? "";
  out = out.replace(/\[[^\]]*]/g, " ");
  out = out.replace(/\([^)]*\)/g, " ");
  // unmatched bracket fragments like "Eudocia [of Samaria" -> "Eudocia"
  out = out.replace(/\[[^\n]*$/g, " ");
  return cleanText(out);
}

const BAD_FIRST_WORDS = new Set<string>([
  "their",
  "who",
  "whom",
  "whose",
  "which",
  "that",
  "then",
  "also",
  "and",
  "or",
  "on",
  "in",
  "at",
  "under",
  "now",
  "where",
  "whereafter",
  "so",
  "to",
  "of",
  "for",
  "from",
  "as",
  "by",
  "with",
  "without",
  "before",
  "after",
  "during",
  "among",
  "mother",
  "father",
  "brother",
  "sister",
  "son",
  "daughter",
  "companions",
  "others",
  "another",
  "nine",
  "ten",
  "eleven",
  "twelve",
]);

// If a "name" begins with a title, require it to be "Title ProperName"
// and never allow title-only fragments like "Bishop" / "Abbot and"
const TITLE_FIRST_WORDS = new Set<string>([
  "abbot",
  "bishop",
  "pope",
  "deacon",
  "priest",
  "virgin",
  "confessor",
  "martyr",
  "cardinal",
  "emperor",
  "king",
  "queen",
  "monk",
  "nun",
  "anchorite",
  "hermit",
]);

function looksLikePersonNameCore(core: string): boolean {
  const s = cleanText(core);
  if (!s) return false;

  // Must start with a letter, and strongly prefer uppercase
  if (!/^[A-Za-z]/.test(s)) return false;
  if (!/^[A-Z]/.test(s)) return false;

  const tokens = s.split(/\s+/).filter(Boolean);
  const first = (tokens[0] ?? "").toLowerCase();

  if (BAD_FIRST_WORDS.has(first)) return false;

  // Reject obvious narrative fragments
  if (/\b(their|who|whom|which|that|then|whereafter|now|under)\b/i.test(s)) {
    return false;
  }

  // If title-first, require at least 2 tokens and next token must look like a proper name
  if (TITLE_FIRST_WORDS.has(first)) {
    if (tokens.length < 2) return false;
    const second = tokens[1] ?? "";
    if (!/^[A-Z]/.test(second)) return false;
    if (/^(and|or|the)$/i.test(second)) return false;
  }

  // Reject endings that are almost always junk
  if (/\b(and|or)$/i.test(s)) return false;

  return true;
}

/**
 * Normalize common prefixes to a consistent “Saint …” style.
 * Also strips bracketed/parenthetical editorial text and common trailing location/narrative fragments.
 */
function normalizeSaintName(raw: string): string {
  let s = cleanText(raw);
  s = stripBracketedAndParens(s);

  // Collapse common abbreviations
  s = s.replace(/^SS\.\s+/i, "Saints ");
  s = s.replace(/^St\.\s+/i, "Saint ");
  s = s.replace(/^Ste\.\s+/i, "Saint ");
  s = s.replace(/^S\.\s+/i, "Saint ");

  // Normalize “Blessed”
  s = s.replace(/^Bl\.\s+/i, "Blessed ");
  s = s.replace(/^B\.\s+/i, "Blessed ");

  // Trim trailing location fragments that are NOT part of the name
  s = s.replace(/\s+\bat\b\s+[A-Z][A-Za-z'’\- ]+$/g, "").trim();
  s = s.replace(/\s+\bnow\b\s+[A-Z][A-Za-z'’\- ]+.*$/g, "").trim();

  // Remove trailing punctuation noise
  s = s.replace(/[.;:,\-–—]+$/g, "").trim();

  return s;
}

/**
 * Expand things like:
 *   "Joshua and holy Gideon" -> ["Saint Joshua", "Saint Gideon"]
 *   "Joshua and Gideon"      -> ["Saint Joshua", "Saint Gideon"]
 *
 * We only split when both sides look like proper-name-ish tokens.
 */
function expandAndList(prefix: "Saint" | "Blessed", raw: string): string[] {
  let s = cleanText(raw);
  s = stripBracketedAndParens(s);

  // Normalize common "and holy" pattern
  s = s.replace(/\band\s+holy\s+/gi, " and ");

  if (!/\s+and\s+/i.test(s)) {
    return [`${prefix} ${s}`];
  }

  const parts = s
    .split(/\s+and\s+/i)
    .map((p) => cleanText(p.replace(/^holy\s+/i, "")))
    .filter(Boolean);

  // Only split if parts look like names (uppercase start)
  if (parts.length >= 2 && parts.every((p) => /^[A-Z]/.test(p))) {
    return parts.map((p) => `${prefix} ${p}`);
  }

  return [`${prefix} ${s}`];
}

/**
 * Final gate: normalize, then reject anything that still doesn't look like a person/devotional name.
 * This is what prevents:
 *  - "Saint Abbot and"
 *  - "Saint Bishop"
 *  - "Saint Altar in the presence..."
 *  - etc.
 */
function finalizeName(candidate: string): string | null {
  let s = normalizeSaintName(candidate);
  s = stripBracketedAndParens(s);
  s = cleanText(s);

  if (!s) return null;
  if (isJunkName(s)) return null;

  // Allow "Our Lady ..." devotional phrases
  if (/^Our Lady\b/i.test(s)) return s;

  const m = s.match(/^(Saints?|Blessed)\s+(.+)$/i);
  if (!m) return null;

  const kind = (m[1] ?? "").toLowerCase();
  const core = cleanText(m[2] ?? "");

  // reject very generic "Saint Bishop" / "Saint Abbot" / etc
  if (TITLE_FIRST_WORDS.has(core.toLowerCase())) return null;

  if (!looksLikePersonNameCore(core)) return null;

  // Disallow explicitly narrative continuations
  if (
    /\b(on his|on her|of whom|in the year|were keeping|was beheaded|was racked|in the presence)\b/i.test(
      core,
    )
  ) {
    return null;
  }

  const prefix = kind.startsWith("blessed")
    ? "Blessed"
    : kind.startsWith("saints")
      ? "Saints"
      : "Saint";

  // Normalize prefix casing deterministically
  return `${prefix} ${core}`.trim();
}

/**
 * Pull saint-ish name phrases out of a line of Martyrology prose.
 * Conservative + deterministic.
 */
function extractSaintsFromLine(line: string): string[] {
  const t = cleanText(line);
  if (!t) return [];

  const out: string[] = [];

  // 1) SS. ... (plural list)
  const ssMatch = t.match(/\bSS\.\s+([^.;]+)[.;]/i);
  if (ssMatch?.[1]) {
    const chunk = cleanText(ssMatch[1]);
    const parts = chunk
      .split(/,|\sand\s/i)
      .map((p) => cleanText(p))
      .filter(Boolean)
      .filter((p) => /^[A-Z]/.test(p));

    for (const p of parts) {
      const nm = finalizeName(`Saint ${p}`);
      if (nm) out.push(nm);
    }
  }

  // 2) St. ... (singular) — can appear multiple times
  // Stop BEFORE "... and holy ..." etc so we don't capture compound narrative.
  const stRe =
    /\bSt\.\s+([A-Z][A-Za-z'’\-\s]+?)(?=,|\s+and\s+(holy|St\.|SS\.|Blessed)\b|\bwho\b|\bvirgin\b|\bbishop\b|\bmartyr\b|\bpriest\b|\babbot\b|\bconfessor\b|[.;])/g;
  for (const m of t.matchAll(stRe)) {
    const raw = cleanText(m[1] ?? "");
    if (!raw) continue;

    for (const cand of expandAndList("Saint", raw)) {
      const nm = finalizeName(cand);
      if (nm) out.push(nm);
    }
  }

  // 3) Blessed ...
  const blRe =
    /\bBlessed\s+([A-Z][A-Za-z'’\-\s]+?)(?=,|\s+and\s+(holy|St\.|SS\.|Blessed)\b|\bwho\b|\bvirgin\b|\bbishop\b|\bmartyr\b|\bpriest\b|\babbot\b|\bconfessor\b|[.;])/g;
  for (const m of t.matchAll(blRe)) {
    const raw = cleanText(m[1] ?? "");
    if (!raw) continue;

    for (const cand of expandAndList("Blessed", raw)) {
      const nm = finalizeName(cand);
      if (nm) out.push(nm);
    }
  }

  // 4) Our Lady ...
  const olMatch = t.match(/\bOur Lady\b[^.;]*/i);
  if (olMatch?.[0]) {
    const phrase = cleanText(olMatch[0]);
    const nm = finalizeName(phrase) ?? phrase;
    if (nm && /^Our Lady\b/i.test(nm)) out.push(nm);
  }

  // 5) Divinum Officium uses “holy NAME”
  const holyRe =
    /\bholy\s+([A-Z][A-Za-z'’\-\s]+?)(?=,|\(|\s+and\s+(holy|St\.|SS\.|Blessed)\b|\bBishop\b|\bAbbot\b|\bVirgin\b|\bMartyr\b|\bConfessor\b|[.;])/g;
  for (const m of t.matchAll(holyRe)) {
    const raw = cleanText(m[1] ?? "");
    if (!raw) continue;

    for (const cand of expandAndList("Saint", raw)) {
      const nm = finalizeName(cand);
      if (nm) out.push(nm);
    }
  }

  // 6) “holy martyrs X, Y, Z ...”
  const martyrsMatch = t.match(/\bholy\s+martyrs?\s+([^.;]+)[.;]/i);
  if (martyrsMatch?.[1]) {
    const chunk = cleanText(martyrsMatch[1]);
    const parts = chunk
      .split(/,|\sand\s/i)
      .map((p) => cleanText(p))
      .filter(Boolean)
      .filter((p) => /^[A-Z]/.test(p));

    for (const p of parts) {
      const nm = finalizeName(`Saint ${p}`);
      if (nm) out.push(nm);
    }
  }

  return uniq(out);
}

// Supports odd spellings found in the wild (ecatholic2000 uses “Nineth”, sometimes “Twenty-Nineth”)
const ORDINAL_WORD_TO_NUM: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  nineth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  twenty_first: 21,
  twenty_second: 22,
  twenty_third: 23,
  twenty_fourth: 24,
  twenty_fifth: 25,
  twenty_sixth: 26,
  twenty_seventh: 27,
  twenty_eighth: 28,
  twenty_ninth: 29,
  // common site misspelling
  twenty_nineth: 29,
  thirtieth: 30,
  thirty_first: 31,
};

const NUM_TO_ORDINAL: Record<number, string> = {
  1: "First",
  2: "Second",
  3: "Third",
  4: "Fourth",
  5: "Fifth",
  6: "Sixth",
  7: "Seventh",
  8: "Eighth",
  9: "Ninth",
  10: "Tenth",
  11: "Eleventh",
  12: "Twelfth",
  13: "Thirteenth",
  14: "Fourteenth",
  15: "Fifteenth",
  16: "Sixteenth",
  17: "Seventeenth",
  18: "Eighteenth",
  19: "Nineteenth",
  20: "Twentieth",
  21: "Twenty-First",
  22: "Twenty-Second",
  23: "Twenty-Third",
  24: "Twenty-Fourth",
  25: "Twenty-Fifth",
  26: "Twenty-Sixth",
  27: "Twenty-Seventh",
  28: "Twenty-Eighth",
  29: "Twenty-Ninth",
  30: "Thirtieth",
  31: "Thirty-First",
};

function ordinalPhraseToDayNum(phrase: string): number | null {
  const p = cleanText(phrase).toLowerCase();
  const m = p.match(/\bthe\s+([a-z\-]+)\s+day\b/i);
  if (!m?.[1]) return null;

  const raw = m[1].toLowerCase();
  const key = raw.replace(/-/g, "_");
  return ORDINAL_WORD_TO_NUM[key] ?? null;
}

function feastHeadingFor(month: number, day: number): string {
  const ord = NUM_TO_ORDINAL[day] ?? String(day);
  const mn = MONTH_NUM_TO_NAME[month] ?? String(month);
  return `The ${ord} Day of ${mn}`;
}

type ParsedDaySection = {
  dayNum: number;
  heading: string;
  bullets: string[];
};

function parseMonthPage(html: string): ParsedDaySection[] {
  const $ = cheerio.load(html);

  const sections: ParsedDaySection[] = [];
  const h2s = $("h2").toArray();

  for (let i = 0; i < h2s.length; i++) {
    const h2 = h2s[i];
    const heading = cleanText($(h2).text());
    if (!heading) continue;
    if (!/\bDay of\b/i.test(heading)) continue;

    const dayNum = ordinalPhraseToDayNum(heading);
    if (!dayNum) continue;

    const bullets: string[] = [];
    let cur = $(h2).next();

    while (cur.length) {
      if (cur.is("h2")) break;

      if (cur.is("ul")) {
        cur
          .find("li")
          .toArray()
          .forEach((li) => {
            const t = cleanText($(li).text());
            if (t) bullets.push(t);
          });
      } else if (cur.is("li")) {
        const t = cleanText(cur.text());
        if (t) bullets.push(t);
      }

      cur = cur.next();
    }

    sections.push({ dayNum, heading, bullets });
  }

  return sections;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`);
  }
  return await res.text();
}

function buildDivinumUrl(month: number, day: number): string {
  const date1 = `${pad2(month)}-${pad2(day)}-${TEMPLATE_YEAR}`;
  const version = encodeURIComponent(DO_VERSION).replace(/%20/g, "+");
  const lang2 = encodeURIComponent(DO_LANG);
  return `${DO_SITE_BASE}?command=prayPrima&date1=${date1}&lang2=${lang2}&version=${version}`;
}

function extractDivinumEnglishMartyrologyLines(html: string): string[] {
  const $ = cheerio.load(html);
  const rawText = cleanText($.text());
  if (!rawText) return [];

  const lines = rawText
    .split("\n")
    .map((l) => cleanText(l))
    .filter(Boolean);

  const idxs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^Martyrology\s*\{anticip\.\}\s*$/i.test(lines[i])) idxs.push(i);
  }
  if (idxs.length === 0) return [];

  const start = idxs[idxs.length - 1] + 1;
  const out: string[] = [];

  for (let i = start; i < lines.length; i++) {
    const l = lines[i];

    if (/^℣\./.test(l) || /^℟\./.test(l)) break;
    if (/^Precious in the sight of the Lord/i.test(l)) break;
    if (/^O God, come to my assistance/i.test(l)) break;

    if (/\bwere born into the better life\b/i.test(l)) continue;

    if (
      /^At\s+/i.test(l) ||
      /^Likewise/i.test(l) ||
      /^In\s+/i.test(l) ||
      /^On\s+/i.test(l) ||
      /^And elsewhere/i.test(l)
    ) {
      out.push(l);
    }
  }

  return out;
}

async function fetchDivinumSaintsForDay(
  month: number,
  day: number,
): Promise<string[]> {
  const url = buildDivinumUrl(month, day);
  const html = await fetchHtml(url);
  const lines = extractDivinumEnglishMartyrologyLines(html);

  const saints = uniq(lines.flatMap((l) => extractSaintsFromLine(l))).filter(
    (s) => !isJunkName(s),
  );

  return saints;
}

function isRealDay(day: DaySaints) {
  return Array.isArray(day?.saints) && day.saints.length > 0;
}

async function main() {
  const fetchedAtISO = new Date().toISOString();

  const source: DaySaints["source"] = {
    kind: "roman_martyrology_site",
    site: SITE_BASE,
    pages: MONTH_PAGES.map((p) => p.url),
    fetchedAtISO,
    fallback: {
      kind: "divinum_officium",
      site: DO_SITE_BASE,
      version: DO_VERSION,
      lang: DO_LANG,
      usedFor: [],
    },
  };

  const out = makeEmptyYear(source);

  // -------- Primary scrape --------
  for (const mp of MONTH_PAGES) {
    console.log(`Fetching month ${pad2(mp.month)}: ${mp.url}`);
    const html = await fetchHtml(mp.url);

    const sections = parseMonthPage(html);

    const expected = daysInMonth(mp.month);
    const got = new Set<number>(sections.map((s) => s.dayNum));
    const missingDays: number[] = [];
    for (let d = 1; d <= expected; d++) {
      if (!got.has(d)) missingDays.push(d);
    }

    console.log(
      `  Parsed sections: ${sections.length} (expected ~${expected})`,
    );
    if (missingDays.length > 0) {
      console.log(
        `  Missing day sections for month ${pad2(mp.month)}:`,
        missingDays,
      );
    }

    for (const sec of sections) {
      const key = mmdd(mp.month, sec.dayNum);

      const saints = uniq(
        sec.bullets.flatMap((b) => extractSaintsFromLine(b)),
      ).filter((s) => !isJunkName(s));

      const featuredSaint = saints.length > 0 ? saints[0] : null;

      const feast =
        cleanText(sec.heading) || feastHeadingFor(mp.month, sec.dayNum);

      out[key] = {
        ...out[key],
        feast,
        saints,
        featuredSaint,
      };
    }
  }

  // -------- Fallback fill --------
  const fallbackUsed: string[] = [];

  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= daysInMonth(m); d++) {
      const key = mmdd(m, d);

      if (isRealDay(out[key])) continue;

      if (key === "02-29") {
        try {
          const saints = await fetchDivinumSaintsForDay(2, 29);
          if (saints.length > 0) {
            out[key] = {
              ...out[key],
              feast: out[key].feast ?? "Leap Day (Feb 29)",
              saints,
              featuredSaint: saints[0] ?? null,
            };
            fallbackUsed.push(key);
          } else {
            out[key] = {
              ...out[key],
              feast: out[key].feast ?? "Leap Day (Feb 29)",
              saints: [],
              featuredSaint: null,
            };
          }
        } catch {
          out[key] = {
            ...out[key],
            feast: out[key].feast ?? "Leap Day (Feb 29)",
            saints: [],
            featuredSaint: null,
          };
        }
        continue;
      }

      try {
        const saints = await fetchDivinumSaintsForDay(m, d);
        if (saints.length > 0) {
          out[key] = {
            ...out[key],
            feast: out[key].feast ?? feastHeadingFor(m, d),
            saints,
            featuredSaint: saints[0] ?? null,
          };
          fallbackUsed.push(key);
        } else {
          out[key] = {
            ...out[key],
            feast: out[key].feast ?? "All Saints for Today",
            saints: [],
            featuredSaint: null,
          };
        }
      } catch {
        out[key] = {
          ...out[key],
          feast: out[key].feast ?? "All Saints for Today",
          saints: [],
          featuredSaint: null,
        };
      }
    }
  }

  // Track fallback usage
  if (out["01-01"]?.source?.fallback) {
    out["01-01"].source.fallback.usedFor = fallbackUsed.slice().sort();
  }

  // Final guarantee + CLEAN PASS
  for (const k of Object.keys(out)) {
    const day = out[k];
    if (!day.feast) day.feast = "All Saints for Today";
    if (!Array.isArray(day.saints)) day.saints = [];

    const cleaned = uniq(
      day.saints
        .map((s) => finalizeName(s) ?? null)
        .filter((s): s is string => !!s),
    ).filter((s) => !isJunkName(s));

    day.saints = cleaned;
    day.featuredSaint = day.saints.length > 0 ? day.saints[0] : null;

    if (k === "02-29" && !day.feast) day.feast = "Leap Day (Feb 29)";
  }

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const outPath = path.join(dataDir, "saints_by_mmdd.json");
  safeAtomicWrite(outPath, JSON.stringify(out, null, 2));
  console.log("Wrote:", outPath);

  const keys = Object.keys(out).sort();
  console.log("Days:", keys.length);
  console.log("Fallback used for:", fallbackUsed.length, "days");
  console.log(
    "Sample:",
    keys.slice(0, 5).map((kk) => [kk, out[kk]]),
  );

  const stillEmpty = keys.filter(
    (kk) => kk !== "02-29" && (!out[kk].saints || out[kk].saints.length === 0),
  );
  if (stillEmpty.length > 0) {
    console.log("WARNING: still-empty days (non-leap):", stillEmpty);
  }
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
