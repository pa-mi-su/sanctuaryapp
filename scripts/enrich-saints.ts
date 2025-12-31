/* eslint-disable no-console */

/**
 * scripts/enrich-saints.ts
 *
 * MINI README (COMPLETE)
 * ======================
 *
 * PURPOSE
 * -------
 * Resolve each day’s “chosen saint” to a trustworthy reference page (URL + title + confidence),
 * using multiple sources with scoring, caching, rate limiting, and day-aware fallback.
 *
 * INPUTS (2 supported formats)
 * ----------------------------
 * A) Day array (recommended; 366 days)
 *    File: data/saints_input_array.json
 *    Shape: [{ mmdd, feast, featuredSaint, saints[] }]
 *    Behavior: tries featuredSaint first, then (optionally) other saints from SAME day.
 *
 * B) Saint entry array (advanced)
 *    File: any JSON with shape: [{ id, name, mmdd, feast? }]
 *    Behavior: enrich each entry independently (NOT one-per-day).
 *
 * SOURCES USED (in order)
 * -----------------------
 * - catholicsaints.info
 * - mycatholic.life
 * - catholic.org
 * - wikipedia (fallback)
 *
 * KEY FEATURE: DAY-AWARE FALLBACK (scope=featured)
 * -----------------------------------------------
 * Each day has many saints. If the featured saint can’t be resolved confidently, the script
 * tries other saints listed for that same mmdd until it finds a clean, high-confidence match
 * (or hits a per-day cap).
 *
 * OUTPUT FILES
 * ------------
 * 1) data/saints_enriched.json
 *    - scope=featured: exactly 366 rows (one per mmdd)
 *    - scope=all: one row per input entry
 *    Each row includes:
 *      { id, name, mmdd, feast, resolved{source,url,title,confidence}, extracted{...}, sources[...] }
 *
 * 2) data/saints_enrich_report.json
 *    - Run metadata + per-day/per-entry trace
 *    - Includes:
 *      - which names were tried for the day
 *      - which one was chosen
 *      - candidate sources considered
 *      - flags used for the run
 *
 * 3) data/saints_audit.json   (only when --writeAudit; default true)
 *    - Automated QA pass that categorizes each day as:
 *        pass / review / fail
 *      counts: { pass, review, fail }
 *      audit[] entries include reasons like:
 *        - wiki_generic_title
 *        - wiki_low_confidence
 *        - chosen_not_in_day_saints_list
 *        - fallback_used_not_featured
 *        - no_resolved
 *
 * IMPORTANT NOTE ABOUT “OK=366”
 * -----------------------------
 * ok:366 only means “a URL was found for each day.”
 * It does NOT guarantee the saint is the best/expected one for the app.
 * That’s why saints_audit.json exists.
 *
 * COMMANDS (RUN MODES)
 * --------------------
 * 1) Full 366-day run (recommended)
 *    npx tsx scripts/enrich-saints.ts --input=data/saints_input_array.json --scope=featured
 *
 * 2) Only fill missing (fast; reuses prior resolved mmdd)
 *    npx tsx scripts/enrich-saints.ts --input=data/saints_input_array.json --scope=featured --onlyMissing
 *
 * 3) Force refresh cache (refetch pages)
 *    npx tsx scripts/enrich-saints.ts --input=data/saints_input_array.json --scope=featured --refreshCache
 *
 * 4) Safety valve: cap saints tried per day
 *    npx tsx scripts/enrich-saints.ts --input=data/saints_input_array.json --scope=featured --maxCandidatesPerDay=10
 *
 * 5) Disable day fallback (debug)
 *    npx tsx scripts/enrich-saints.ts --input=data/saints_input_array.json --scope=featured --noFallbackToOtherSaints
 *
 * 6) Disable mmdd resume (debug; forces re-evaluation)
 *    npx tsx scripts/enrich-saints.ts --input=data/saints_input_array.json --scope=featured --noResumeByMmdd
 *
 * 7) “All entries” mode (advanced; input must be saintArray format)
 *    npx tsx scripts/enrich-saints.ts --input=data/some_saint_entries.json --scope=all
 *
 * CHECKS / AUDITS (HOW TO VERIFY)
 * -------------------------------
 * A) Quick counts:
 *    node -e 'const a=require("./data/saints_audit.json"); console.log(a.counts);'
 *
 * B) List review items:
 *    node -e '
 *      const a=require("./data/saints_audit.json").audit||[];
 *      const r=a.filter(x=>x.verdict==="review");
 *      console.log("review:", r.length);
 *      for(const x of r) console.log(x.mmdd,"->",x.chosen?.name,"|",x.chosen?.resolved?.source,"|",x.reasons?.join(","));
 *    '
 *
 * C) List fail items:
 *    node -e '
 *      const a=require("./data/saints_audit.json").audit||[];
 *      const f=a.filter(x=>x.verdict==="fail");
 *      console.log("fail:", f.length);
 *      for(const x of f) console.log(x.mmdd,"->",x.reasons?.join(","), "| chosen:", x.chosen?.name);
 *    '
 *
 * D) Spot-check important/high-risk days:
 *    node -e '
 *      const j=require("./data/saints_enriched.json");
 *      const pick=(mmdd)=>j.find(x=>x.mmdd===mmdd);
 *      for(const d of ["01-01","01-03","06-29","12-25","12-27"]) {
 *        const x=pick(d);
 *        console.log(d,"->",x?.name,"|",x?.resolved?.source,"|",x?.resolved?.url);
 *      }
 *    '
 *
 * E) Find “Wikipedia picks” (useful sanity scan):
 *    node -e '
 *      const j=require("./data/saints_enriched.json");
 *      const w=j.filter(x=>x?.resolved?.source==="wikipedia");
 *      console.log("wikipedia:", w.length);
 *      for(const x of w.slice(0,30)) console.log(x.mmdd, "->", x.name, "|", x.resolved?.confidence, "|", x.resolved?.url);
 *    '
 *
 * FLAGS (ALL)
 * -----------
 * --input=PATH                 (default: data/saints_input_array.json)
 * --scope=featured|all         (default: featured)
 *
 * Networking / speed:
 * --concurrency=N              (default: 2)
 * --sleepMs=N                  (default: 500)
 * --minIntervalMs=N            (default: 900)
 * --maxRetries=N               (default: 6)
 * --refreshCache               (default: false)
 *
 * Resume / selection behavior:
 * --onlyMissing                (default: false)
 * --resumeByMmdd / --noResumeByMmdd              (default: true in featured)
 * --fallbackToOtherSaints / --noFallbackToOtherSaints (default: true in featured)
 * --maxCandidatesPerDay=N      (default: 20)
 *
 * Scoring / quality gates:
 * --threshold=N                (default: 48) minimum score to accept a candidate
 * --minWikiConfidence=N        (default: 65) wikipedia under this is flagged review-ish
 *
 * Audit output:
 * --writeAudit / --noWriteAudit (default: true)
 *
 * INTERPRETING RESULTS
 * --------------------
 * - saints_enriched.json: what the app will use.
 * - saints_enrich_report.json: what was tried, what was chosen, and why (debug trail).
 * - saints_audit.json:
 *     pass  = looks good automatically
 *     review= usable but suspicious; likely needs overrides or better fallback target
 *     fail  = unresolved; needs manual fix/override
 */

import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import * as cheerio from "cheerio";

type SaintEntry = {
  id: string;
  name: string;
  mmdd: string;
  feast?: string;
};

type DayInput = {
  mmdd: string;
  feast?: string;
  featuredSaint?: string;
  saints?: string[];
};

type OverrideRule =
  | {
      preferred: "mycatholic" | "catholic_org" | "catholicsaints" | "wikipedia";
      url: string;
    }
  | { preferred: "wikipedia"; title: string };

type OverridesFile = Record<string, OverrideRule>;

type EnrichedSaint = SaintEntry & {
  resolved: {
    source: string;
    url: string;
    title?: string;
    confidence: number;
  } | null;
  extracted?: {
    displayName?: string;
    feastDayText?: string;
    shortBio?: string;
    imageUrl?: string;
    born?: string;
    died?: string;
    patronage?: string;
    canonized?: string;
  };
  sources?: Array<{ source: string; url: string; title?: string }>;
};

type Candidate = {
  source: string;
  url: string;
  title?: string;
  score: number;
  reasons: string[];
  feastDayText?: string;
  shortBio?: string;
  imageUrl?: string;
};

type Flags = {
  concurrency: number;
  sleepMs: number;
  minIntervalMs: number;
  maxRetries: number;
  refreshCache: boolean;
  onlyMissing: boolean;

  scope: "featured" | "all";

  // Featured/day-array behavior:
  resumeByMmdd: boolean;
  fallbackToOtherSaints: boolean;
  maxCandidatesPerDay: number;

  // Candidate acceptance:
  threshold: number; // minimum score for acceptance
  minWikiConfidence: number; // if wikipedia below this, mark for review / prefer other sources

  // Audit:
  writeAudit: boolean;
};

function parseArgs(): Flags & { input?: string } {
  const argv = process.argv.slice(2);
  const flags: any = {
    concurrency: 2,
    sleepMs: 500,
    minIntervalMs: 900,
    maxRetries: 6,
    refreshCache: false,
    onlyMissing: false,

    scope: "featured",

    resumeByMmdd: true,
    fallbackToOtherSaints: true,
    maxCandidatesPerDay: 20,

    threshold: 48,
    minWikiConfidence: 65,

    writeAudit: true,
  };

  for (const a of argv) {
    const [k, v] = a.includes("=") ? a.split("=") : [a, ""];
    if (k === "--concurrency") flags.concurrency = Number(v);
    else if (k === "--sleepMs") flags.sleepMs = Number(v);
    else if (k === "--minIntervalMs") flags.minIntervalMs = Number(v);
    else if (k === "--maxRetries") flags.maxRetries = Number(v);
    else if (k === "--refreshCache") flags.refreshCache = true;
    else if (k === "--onlyMissing") flags.onlyMissing = true;
    else if (k === "--input") flags.input = v;
    else if (k === "--scope") flags.scope = v === "all" ? "all" : "featured";
    else if (k === "--resumeByMmdd") flags.resumeByMmdd = true;
    else if (k === "--noResumeByMmdd") flags.resumeByMmdd = false;
    else if (k === "--fallbackToOtherSaints")
      flags.fallbackToOtherSaints = true;
    else if (k === "--noFallbackToOtherSaints")
      flags.fallbackToOtherSaints = false;
    else if (k === "--maxCandidatesPerDay")
      flags.maxCandidatesPerDay = Number(v);
    else if (k === "--threshold") flags.threshold = Number(v);
    else if (k === "--minWikiConfidence") flags.minWikiConfidence = Number(v);
    else if (k === "--writeAudit") flags.writeAudit = true;
    else if (k === "--noWriteAudit") flags.writeAudit = false;
  }

  // In "all" mode, mmdd-resume isn’t safe (many entries share mmdd)
  if (flags.scope === "all") flags.resumeByMmdd = false;

  return flags as any;
}

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".cache", "saints_enrich");
const DATA_DIR = path.join(ROOT, "data");
const OVERRIDES_PATH = path.join(DATA_DIR, "saints_overrides.json");

const OUT_ENRICHED = path.join(DATA_DIR, "saints_enriched.json");
const OUT_REPORT = path.join(DATA_DIR, "saints_enrich_report.json");
const OUT_AUDIT = path.join(DATA_DIR, "saints_audit.json");

function ensureDirs() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function sha1(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let lastRequestAt = 0;
async function rateLimit(minIntervalMs: number) {
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + minIntervalMs - now);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function fetchWithCache(
  url: string,
  refresh: boolean,
  maxRetries: number,
  minIntervalMs: number,
): Promise<string> {
  const key = sha1(url);
  const fp = path.join(CACHE_DIR, `${key}.txt`);

  if (!refresh && fs.existsSync(fp)) {
    return fs.readFileSync(fp, "utf8");
  }

  let lastErr: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await rateLimit(minIntervalMs);
      const res = await fetch(url, {
        headers: {
          "user-agent":
            "novenasapp-saints-enricher/1.0 (non-commercial; contact: local-script)",
          accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      fs.writeFileSync(fp, text, "utf8");
      return text;
    } catch (e) {
      lastErr = e;
      const backoff = 250 * attempt * attempt;
      await sleep(backoff);
    }
  }
  throw lastErr;
}

function readJson<T>(fp: string, fallback: T): T {
  if (!fs.existsSync(fp)) return fallback;
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

function writeJson(fp: string, obj: any) {
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

/** -----------------------------
 *  Normalization + query variants
 *  ----------------------------- */

function normalizeName(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/^saint\s+/, "")
    .replace(/^st\.?\s+/, "")
    .replace(/^blessed\s+/, "")
    .replace(/^our\s+lady\s+/, "lady ")
    .replace(/[’'"]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Aggressive cleanup for “sentence saints”
function normalizeForQuery(s: string) {
  let t = String(s || "").trim();

  t = t.replace(/^saint\s+/i, "");
  t = t.replace(/^st\.?\s+/i, "");
  t = t.replace(/^blessed\s+/i, "");

  t = t.replace(/\b(is not announced today)\b/i, "");
  t = t.replace(/\b(to martyrdom)\b/i, "");
  t = t.replace(/\b(baptized whilst he was detained in prison)\b/i, "");
  t = t.replace(/\b(wrote to philemon)\b/i, "");

  t = t.replace(/\bconfessor\b/i, "");
  t = t.replace(/\bmartyrs?\b/i, "");

  t = t.replace(/\s+/g, " ").trim();
  return t.length ? t : String(s || "").trim();
}

function buildQueryVariants(name: string): string[] {
  const raw = String(name || "").trim();
  const a = normalizeForQuery(raw);
  const b = a
    .replace(/\b(of|before|to|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const c = normalizeName(a);

  const uniq: string[] = [];
  for (const q of [raw, a, b, c]) {
    const s = String(q || "").trim();
    if (!s) continue;
    if (!uniq.includes(s)) uniq.push(s);
  }

  const tokens = a.split(/\s+/).filter(Boolean);
  if (tokens.length >= 4) {
    const short = tokens.slice(0, 3).join(" ");
    if (!uniq.includes(short)) uniq.push(short);
  }

  return uniq.slice(0, 6);
}

function tokenSet(s: string): Set<string> {
  return new Set(normalizeName(s).split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>) {
  const inter = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

function looksNonPersonTitle(title: string) {
  const t = title.toLowerCase();
  const bad = [
    "cathedral",
    "church",
    "basilica",
    "liturgy",
    "mass",
    "chaplet",
    "prayer",
    "order",
    "station",
    "mount",
    "village",
    "city",
    "municipal",
    "history",
    "incident",
    "cuisine",
    "painting",
    "in visual arts",
    "festival",
    "statue",
    "collectivity",
    "eparchy",
    "diocese",
    "parish",
    "calendar",
    "novena",
    "lessons from saint",
  ];
  return bad.some((w) => t.includes(w));
}

function looksSaintyText(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("saint") ||
    t.includes("martyr") ||
    t.includes("bishop") ||
    t.includes("pope") ||
    t.includes("confessor") ||
    t.includes("virgin") ||
    t.includes("abbot") ||
    t.includes("monk") ||
    t.includes("nun") ||
    t.includes("canonized")
  );
}

function extractMmddFromText(text: string): string | null {
  const t = String(text || "").toLowerCase();
  const months: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };

  for (const [m, mm] of Object.entries(months)) {
    const re = new RegExp(`${m}\\s+(\\d{1,2})`, "i");
    const match = t.match(re);
    if (match) {
      const dd = match[1].padStart(2, "0");
      return `${mm}-${dd}`;
    }
  }

  for (const [m, mm] of Object.entries(months)) {
    const re = new RegExp(`(\\d{1,2})\\s+${m}`, "i");
    const match = t.match(re);
    if (match) {
      const dd = match[1].padStart(2, "0");
      return `${mm}-${dd}`;
    }
  }

  return null;
}

function slugifyIdPart(name: string) {
  return normalizeName(name).replace(/\s+/g, "_").replace(/_+/g, "_").trim();
}

/** -----------------------------
 *  Input loader (supports both formats)
 *  ----------------------------- */

function detectInputKind(raw: any): "dayArray" | "saintArray" | "unknown" {
  if (!Array.isArray(raw) || raw.length === 0) return "unknown";
  const first = raw[0];
  if (!first || typeof first !== "object") return "unknown";
  if ("mmdd" in first && ("featuredSaint" in first || "saints" in first))
    return "dayArray";
  if ("id" in first && "name" in first && "mmdd" in first) return "saintArray";
  return "unknown";
}

function loadDays(inputPath: string): {
  days: DayInput[];
  inputInvalidRows: number;
} {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const kind = detectInputKind(raw);
  if (kind !== "dayArray") {
    return { days: [], inputInvalidRows: Array.isArray(raw) ? raw.length : 1 };
  }

  const days = raw as DayInput[];
  const cleaned: DayInput[] = [];
  let bad = 0;

  for (const d of days) {
    const mmdd = String(d?.mmdd || "").trim();
    if (!mmdd) {
      bad++;
      continue;
    }
    cleaned.push({
      mmdd,
      feast: d?.feast,
      featuredSaint: d?.featuredSaint ? String(d.featuredSaint) : undefined,
      saints: Array.isArray(d?.saints) ? d.saints.map((x) => String(x)) : [],
    });
  }

  // de-dupe by mmdd (keep first)
  const seen = new Set<string>();
  const deduped: DayInput[] = [];
  for (const d of cleaned) {
    if (seen.has(d.mmdd)) continue;
    seen.add(d.mmdd);
    deduped.push(d);
  }

  return { days: deduped, inputInvalidRows: bad };
}

function loadSaintEntries(inputPath: string): {
  entries: SaintEntry[];
  inputInvalidRows: number;
} {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const kind = detectInputKind(raw);
  if (kind !== "saintArray") {
    return {
      entries: [],
      inputInvalidRows: Array.isArray(raw) ? raw.length : 1,
    };
  }

  const arr = raw as any[];
  const entries: SaintEntry[] = [];
  let bad = 0;
  for (const r of arr) {
    const id = String(r?.id || "").trim();
    const name = String(r?.name || "").trim();
    const mmdd = String(r?.mmdd || "").trim();
    if (!id || !name || !mmdd) {
      bad++;
      continue;
    }
    entries.push({ id, name, mmdd, feast: r?.feast });
  }
  return { entries, inputInvalidRows: bad };
}

function buildDayCandidateNames(day: DayInput, flags: Flags): string[] {
  const out: string[] = [];
  const push = (s?: string) => {
    const t = String(s || "").trim();
    if (!t) return;
    if (!out.includes(t)) out.push(t);
  };

  // featured first
  push(day.featuredSaint);

  if (flags.fallbackToOtherSaints) {
    for (const s of day.saints || []) push(s);
  }

  return out.slice(0, Math.max(1, flags.maxCandidatesPerDay || 1));
}

function dedupeLinks(links: Array<{ url: string; title: string }>) {
  const seen = new Set<string>();
  const out: Array<{ url: string; title: string }> = [];
  for (const l of links) {
    const u = l.url.split("#")[0];
    if (seen.has(u)) continue;
    seen.add(u);
    out.push({ url: u, title: l.title });
  }
  return out;
}

/** -----------------------------
 *  Source resolvers
 *  ----------------------------- */

async function candidatesFromCatholicSaintsInfo(
  entry: SaintEntry,
  flags: Flags,
): Promise<Candidate[]> {
  const queries = buildQueryVariants(entry.name);
  const out: Candidate[] = [];

  for (const q of queries.slice(0, 3)) {
    const searchUrl = `https://catholicsaints.info/?s=${encodeURIComponent(q)}`;
    try {
      const html = await fetchWithCache(
        searchUrl,
        flags.refreshCache,
        flags.maxRetries,
        flags.minIntervalMs,
      );
      const $ = cheerio.load(html);

      const links: Array<{ url: string; title: string }> = [];
      $("a").each((_, el) => {
        const href = String($(el).attr("href") || "");
        const title = $(el).text().trim();
        if (!title) return;
        if (!href.includes("catholicsaints.info")) return;
        if (href.includes("?s=")) return;
        if (!/saint|st\.|blessed|our lady|pope|martyr|bishop/i.test(title))
          return;
        links.push({ url: href, title });
      });

      const uniq = dedupeLinks(links).slice(0, 6);
      for (const l of uniq) {
        try {
          const page = await fetchWithCache(
            l.url,
            flags.refreshCache,
            flags.maxRetries,
            flags.minIntervalMs,
          );
          const $$ = cheerio.load(page);

          const title =
            $$("h1").first().text().trim() ||
            $$("title").text().trim() ||
            l.title;
          if (looksNonPersonTitle(title)) continue;

          const bodyText = $$("body").text().replace(/\s+/g, " ").trim();

          const feast =
            bodyText
              .match(/Feast\s*day\s*:\s*([^|]+?)(?:\s{2,}|\||$)/i)?.[1]
              ?.trim() ||
            bodyText
              .match(/Feastday\s*:\s*([^|]+?)(?:\s{2,}|\||$)/i)?.[1]
              ?.trim();

          const mmddFound = feast
            ? extractMmddFromText(feast)
            : extractMmddFromText(bodyText);

          const score = scoreCandidate(
            entry,
            {
              source: "catholicsaints",
              url: l.url,
              title,
              feastDayText: feast || undefined,
              shortBio:
                $$("article p").first().text().trim() ||
                $$(".entry-content p").first().text().trim() ||
                undefined,
              imageUrl: $$("article img").first().attr("src") || undefined,
            },
            mmddFound,
          );

          out.push(score);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  // slug fallback
  const slug = normalizeName(entry.name).replace(/\s+/g, "-");
  const guessUrls = [
    `https://catholicsaints.info/saint-${slug}/`,
    `https://catholicsaints.info/st-${slug}/`,
  ];
  for (const url of guessUrls) {
    try {
      const html = await fetchWithCache(
        url,
        flags.refreshCache,
        flags.maxRetries,
        flags.minIntervalMs,
      );
      const $ = cheerio.load(html);
      const title = $("h1").first().text().trim() || $("title").text().trim();
      if (looksNonPersonTitle(title)) continue;

      const bodyText = $("body").text().replace(/\s+/g, " ").trim();

      const feast =
        bodyText
          .match(/Feast\s*day\s*:\s*([^|]+?)(?:\s{2,}|\||$)/i)?.[1]
          ?.trim() ||
        bodyText.match(/Feastday\s*:\s*([^|]+?)(?:\s{2,}|\||$)/i)?.[1]?.trim();

      const mmddFound = feast
        ? extractMmddFromText(feast)
        : extractMmddFromText(bodyText);

      out.push(
        scoreCandidate(
          entry,
          {
            source: "catholicsaints",
            url,
            title,
            feastDayText: feast || undefined,
            shortBio: $(".entry-content p").first().text().trim() || undefined,
          },
          mmddFound,
        ),
      );
    } catch {
      // ignore
    }
  }

  return out;
}

async function candidatesFromMyCatholicLife(
  entry: SaintEntry,
  flags: Flags,
): Promise<Candidate[]> {
  const queries = buildQueryVariants(entry.name);
  const out: Candidate[] = [];

  for (const q of queries.slice(0, 3)) {
    const searchUrl = `https://mycatholic.life/?s=${encodeURIComponent(q)}`;
    try {
      const html = await fetchWithCache(
        searchUrl,
        flags.refreshCache,
        flags.maxRetries,
        flags.minIntervalMs,
      );
      const $ = cheerio.load(html);

      const links: Array<{ url: string; title: string }> = [];
      $("a").each((_, el) => {
        const href = String($(el).attr("href") || "");
        const title = $(el).text().trim();
        if (!title) return;
        if (!href.includes("mycatholic.life")) return;
        if (href.includes("?s=")) return;

        // avoid non-saint content
        if (/novena/i.test(title)) return;
        if (/lessons from saint/i.test(title)) return;

        if (!/saint|st\.|blessed|our lady|pope|martyr|bishop/i.test(title))
          return;

        links.push({ url: href, title });
      });

      const uniq = dedupeLinks(links).slice(0, 6);
      for (const l of uniq) {
        try {
          const page = await fetchWithCache(
            l.url,
            flags.refreshCache,
            flags.maxRetries,
            flags.minIntervalMs,
          );
          const $$ = cheerio.load(page);

          const h1 = $$("h1").first().text().trim() || l.title;
          if (looksNonPersonTitle(h1)) continue;

          const bodyText = $$("body").text().replace(/\s+/g, " ").trim();

          const feast =
            bodyText
              .match(/Feast\s*Day\s*:\s*([A-Za-z]+\s+\d{1,2})/i)?.[1]
              ?.trim() ||
            bodyText
              .match(/Feast\s*day\s*:\s*([A-Za-z]+\s+\d{1,2})/i)?.[1]
              ?.trim();

          const mmddFound = feast
            ? extractMmddFromText(feast)
            : extractMmddFromText(bodyText);

          out.push(
            scoreCandidate(
              entry,
              {
                source: "mycatholic",
                url: l.url,
                title: h1,
                feastDayText: feast || undefined,
                shortBio: $$("article p").first().text().trim() || undefined,
                imageUrl: $$("article img").first().attr("src") || undefined,
              },
              mmddFound,
            ),
          );
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  return out;
}

async function candidatesFromCatholicOrg(
  entry: SaintEntry,
  flags: Flags,
): Promise<Candidate[]> {
  const queries = buildQueryVariants(entry.name);
  const out: Candidate[] = [];

  for (const q of queries.slice(0, 3)) {
    const searchUrl = `https://www.catholic.org/search/?query=${encodeURIComponent(q)}`;
    try {
      const html = await fetchWithCache(
        searchUrl,
        flags.refreshCache,
        flags.maxRetries,
        flags.minIntervalMs,
      );
      const $ = cheerio.load(html);

      const links: Array<{ url: string; title: string }> = [];
      $("a").each((_, el) => {
        const href = String($(el).attr("href") || "");
        const title = $(el).text().trim();
        if (!title) return;
        if (!href.includes("/saints/saint.php")) return;

        links.push({
          url: href.startsWith("http")
            ? href
            : `https://www.catholic.org${href}`,
          title,
        });
      });

      const uniq = dedupeLinks(links).slice(0, 6);
      for (const l of uniq) {
        try {
          const page = await fetchWithCache(
            l.url,
            flags.refreshCache,
            flags.maxRetries,
            flags.minIntervalMs,
          );
          const $$ = cheerio.load(page);

          const h1 = $$("h1").first().text().trim() || l.title;
          if (looksNonPersonTitle(h1)) continue;

          const bodyText = $$("body").text().replace(/\s+/g, " ").trim();

          const feast =
            bodyText
              .match(/Feastday\s*:\s*([A-Za-z]+\s+\d{1,2})/i)?.[1]
              ?.trim() ||
            bodyText
              .match(/Feast\s*day\s*:\s*([A-Za-z]+\s+\d{1,2})/i)?.[1]
              ?.trim();

          const mmddFound = feast
            ? extractMmddFromText(feast)
            : extractMmddFromText(bodyText);

          out.push(
            scoreCandidate(
              entry,
              {
                source: "catholic_org",
                url: l.url,
                title: h1,
                feastDayText: feast || undefined,
                shortBio: $$(".content p").first().text().trim() || undefined,
              },
              mmddFound,
            ),
          );
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  return out;
}

async function candidatesFromWikipedia(
  entry: SaintEntry,
  flags: Flags,
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const queries = buildQueryVariants(entry.name);

  // Bias towards saint-y disambiguation terms
  const searchTerms = [
    `${normalizeForQuery(entry.name)} saint`,
    `${normalizeForQuery(entry.name)} (saint)`,
    `${queries[0]} saint`,
  ].filter(Boolean);

  for (const term of searchTerms.slice(0, 2)) {
    const q = encodeURIComponent(term);
    const openSearch = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${q}&limit=12&namespace=0&format=json`;

    try {
      const jsonText = await fetchWithCache(
        openSearch,
        flags.refreshCache,
        flags.maxRetries,
        flags.minIntervalMs,
      );
      const data = JSON.parse(jsonText);
      const titles: string[] = Array.isArray(data?.[1]) ? data[1] : [];

      for (const title of titles) {
        const t = String(title || "");
        if (!t) continue;
        if (looksNonPersonTitle(t)) continue;

        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`;
        try {
          const sText = await fetchWithCache(
            summaryUrl,
            flags.refreshCache,
            flags.maxRetries,
            flags.minIntervalMs,
          );
          const s = JSON.parse(sText);

          const extract = String(s?.extract || "");
          const pageUrl = String(
            s?.content_urls?.desktop?.page ||
              `https://en.wikipedia.org/wiki/${encodeURIComponent(t)}`,
          );
          const imageUrl = String(s?.thumbnail?.source || "");

          const mmddFound = extractMmddFromText(extract);

          out.push(
            scoreCandidate(
              entry,
              {
                source: "wikipedia",
                url: pageUrl,
                title: t,
                shortBio: extract || undefined,
                imageUrl: imageUrl || undefined,
              },
              mmddFound,
            ),
          );
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  return out;
}

/** -----------------------------
 *  Candidate scoring
 *  ----------------------------- */

function scoreCandidate(
  entry: SaintEntry,
  c: {
    source: string;
    url: string;
    title?: string;
    feastDayText?: string;
    shortBio?: string;
    imageUrl?: string;
  },
  mmddFound: string | null,
): Candidate {
  const reasons: string[] = [];
  let score = 0;

  const targetTokens = tokenSet(entry.name);
  const titleTokens = tokenSet(c.title || "");
  const sim = jaccard(targetTokens, titleTokens);
  score += sim * 60;
  reasons.push(`name_sim=${sim.toFixed(2)}`);

  const text = `${c.title || ""} ${c.shortBio || ""} ${c.feastDayText || ""}`;
  if (looksSaintyText(text)) {
    score += 22;
    reasons.push("sainty_text=+22");
  }

  if (mmddFound) {
    reasons.push(`found_mmdd=${mmddFound}`);
    if (mmddFound === entry.mmdd) {
      score += 45;
      reasons.push("mmdd_match=+45");
    } else {
      score -= 8;
      reasons.push("mmdd_mismatch=-8");
    }
  }

  const title = (c.title || "").trim();
  if (title && looksNonPersonTitle(title)) {
    score -= 60;
    reasons.push("non_person_title=-60");
  }

  if (
    c.source === "catholicsaints" ||
    c.source === "mycatholic" ||
    c.source === "catholic_org"
  ) {
    score += 10;
    reasons.push("catholic_source=+10");
  }

  // Penalize super-generic wikipedia pages by title
  if (c.source === "wikipedia") {
    const tt = String(c.title || "").trim();
    // One-word titles are extremely risky: John / Mary / Peter / Paul / etc.
    if (tt && tt.split(/\s+/).length === 1) {
      score -= 25;
      reasons.push("wiki_generic_title=-25");
    }
  }

  return {
    source: c.source,
    url: c.url,
    title: c.title,
    score,
    reasons,
    feastDayText: c.feastDayText,
    shortBio: c.shortBio,
    imageUrl: c.imageUrl,
  };
}

/** -----------------------------
 *  Enrichment (single saint)
 *  ----------------------------- */

async function enrichOne(
  entry: SaintEntry,
  overrides: OverridesFile,
  flags: Flags,
): Promise<EnrichedSaint> {
  const rule = overrides[entry.id];
  if (rule) {
    if ("url" in rule) {
      return {
        ...entry,
        resolved: { source: rule.preferred, url: rule.url, confidence: 100 },
        extracted: {},
        sources: [{ source: rule.preferred, url: rule.url }],
      };
    }
    if ("title" in rule) {
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(rule.title)}`;
      return {
        ...entry,
        resolved: {
          source: "wikipedia",
          url,
          title: rule.title,
          confidence: 100,
        },
        extracted: {},
        sources: [{ source: "wikipedia", url, title: rule.title }],
      };
    }
  }

  const [c1, c2, c3] = await Promise.all([
    candidatesFromCatholicSaintsInfo(entry, flags),
    candidatesFromMyCatholicLife(entry, flags),
    candidatesFromCatholicOrg(entry, flags),
  ]);
  const c4 = await candidatesFromWikipedia(entry, flags);

  const all = [...c1, ...c2, ...c3, ...c4]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const best = all[0];
  const threshold = flags.threshold;

  if (!best || best.score < threshold) {
    return {
      ...entry,
      resolved: null,
      sources: all.map((x) => ({
        source: x.source,
        url: x.url,
        title: x.title,
      })),
    };
  }

  return {
    ...entry,
    resolved: {
      source: best.source,
      url: best.url,
      title: best.title,
      confidence: Math.max(0, Math.min(100, best.score)),
    },
    extracted: {
      displayName: best.title || entry.name,
      feastDayText: best.feastDayText,
      shortBio: best.shortBio,
      imageUrl: best.imageUrl,
    },
    sources: all.map((x) => ({ source: x.source, url: x.url, title: x.title })),
  };
}

/** -----------------------------
 *  Day-aware enrichment:
 *  Try multiple saints for a single day until one resolves.
 *  ----------------------------- */

function isChosenSuspiciousForDay(
  day: DayInput,
  chosen: EnrichedSaint,
  flags: Flags,
): string[] {
  const reasons: string[] = [];
  if (!chosen.resolved?.url) return ["no_resolved"];

  const chosenNorm = normalizeName(chosen.name);
  const dayNorms = new Set((day.saints || []).map(normalizeName));
  const featuredNorm = normalizeName(day.featuredSaint || "");

  // If chosen isn't even one of the day's saints list, huge red flag
  if (dayNorms.size > 0 && !dayNorms.has(chosenNorm)) {
    reasons.push("chosen_not_in_day_saints_list");
  }

  // If it resolved to Wikipedia but title is generic or confidence low, review
  if (chosen.resolved.source === "wikipedia") {
    const title = String(
      chosen.resolved.title || chosen.extracted?.displayName || "",
    ).trim();
    if (title && title.split(/\s+/).length === 1)
      reasons.push("wiki_generic_title");
    if (chosen.resolved.confidence < flags.minWikiConfidence)
      reasons.push("wiki_low_confidence");
  }

  // If the chosen is not the featured saint, that's okay, but record it
  if (featuredNorm && chosenNorm !== featuredNorm) {
    reasons.push("fallback_used_not_featured");
  }

  return reasons;
}

async function enrichOneDay(
  day: DayInput,
  overrides: OverridesFile,
  flags: Flags,
): Promise<{
  chosen: EnrichedSaint | null;
  tried: Array<{
    id: string;
    name: string;
    resolved: boolean;
    suspicious?: string[];
  }>;
}> {
  const names = buildDayCandidateNames(day, flags);
  const tried: Array<{
    id: string;
    name: string;
    resolved: boolean;
    suspicious?: string[];
  }> = [];

  for (const name of names) {
    const id = `${day.mmdd}_${slugifyIdPart(name)}`;
    const entry: SaintEntry = { id, name, mmdd: day.mmdd, feast: day.feast };

    const enriched = await enrichOne(entry, overrides, flags);
    const ok = !!enriched.resolved?.url;

    const suspicious = ok ? isChosenSuspiciousForDay(day, enriched, flags) : [];
    tried.push({
      id,
      name,
      resolved: ok,
      suspicious: suspicious.length ? suspicious : undefined,
    });

    // Accept if resolved AND not obviously bogus
    // (If it resolves but is suspicious, keep trying others—this is how we avoid "John" / "Marcellus on 06-29")
    if (ok && suspicious.length === 0) return { chosen: enriched, tried };

    // If it resolved but is suspicious, keep looking for a better saint in the same day.
    // Still allow as last resort after we exhaust the list.
    if (ok) {
      // keep going
    }
  }

  // If none were clean, accept the first resolved (even if suspicious),
  // otherwise null.
  const firstResolved = tried.find((t) => t.resolved);
  if (firstResolved) {
    const id = firstResolved.id;
    const name = firstResolved.name;
    const entry: SaintEntry = { id, name, mmdd: day.mmdd, feast: day.feast };
    const enriched = await enrichOne(entry, overrides, flags);
    return { chosen: enriched.resolved?.url ? enriched : null, tried };
  }

  return { chosen: null, tried };
}

/** -----------------------------
 *  Audit writer
 *  ----------------------------- */

function auditFeaturedRun(
  days: DayInput[],
  enriched: EnrichedSaint[],
  flags: Flags,
) {
  const byMmdd = new Map(enriched.map((e) => [e.mmdd, e]));
  const audit: any[] = [];

  let pass = 0;
  let review = 0;
  let fail = 0;

  for (const day of days) {
    const chosen = byMmdd.get(day.mmdd);
    if (!chosen) {
      fail++;
      audit.push({
        mmdd: day.mmdd,
        verdict: "fail",
        reasons: ["missing_output_row"],
        chosen: null,
      });
      continue;
    }
    if (!chosen.resolved?.url) {
      fail++;
      audit.push({
        mmdd: day.mmdd,
        verdict: "fail",
        reasons: ["no_resolved"],
        chosen,
      });
      continue;
    }

    const suspicious = isChosenSuspiciousForDay(day, chosen, flags);
    if (suspicious.length) {
      review++;
      audit.push({
        mmdd: day.mmdd,
        verdict: "review",
        reasons: suspicious,
        chosen,
      });
    } else {
      pass++;
      audit.push({ mmdd: day.mmdd, verdict: "pass", reasons: [], chosen });
    }
  }

  return { counts: { pass, review, fail }, audit };
}

/** -----------------------------
 *  Main
 *  ----------------------------- */

async function run() {
  const flags = parseArgs();
  ensureDirs();

  const inputPath = flags.input
    ? path.resolve(flags.input)
    : path.join(DATA_DIR, "saints_input_array.json");

  const overrides: OverridesFile = readJson(OVERRIDES_PATH, {});
  const existing: EnrichedSaint[] = fs.existsSync(OUT_ENRICHED)
    ? JSON.parse(fs.readFileSync(OUT_ENRICHED, "utf8"))
    : [];

  const existingById = new Map(existing.map((e) => [e.id, e]));
  const existingResolvedByMmdd = new Map<string, EnrichedSaint>();
  for (const e of existing) {
    if (e?.mmdd && e?.resolved?.url && !existingResolvedByMmdd.has(e.mmdd)) {
      existingResolvedByMmdd.set(e.mmdd, e);
    }
  }

  if (flags.scope === "featured") {
    const { days, inputInvalidRows } = loadDays(inputPath);

    console.log(
      `Enriching saints (featured/day mode): days=${days.length} onlyMissing=${flags.onlyMissing} resumeByMmdd=${flags.resumeByMmdd} fallbackToOtherSaints=${flags.fallbackToOtherSaints} maxCandidatesPerDay=${flags.maxCandidatesPerDay} threshold=${flags.threshold} minWikiConfidence=${flags.minWikiConfidence} concurrency=${flags.concurrency} refreshCache=${flags.refreshCache}`,
    );

    const resultsByMmdd = new Map<string, EnrichedSaint>();
    const report: any[] = [];
    let idx = 0;

    async function worker() {
      while (true) {
        const i = idx++;
        if (i >= days.length) return;

        const day = days[i];
        const prefix = `[${i + 1}/${days.length}]`;

        // Fast reuse by mmdd
        if (flags.resumeByMmdd || flags.onlyMissing) {
          const prev = existingResolvedByMmdd.get(day.mmdd);
          if (prev?.resolved?.url) {
            resultsByMmdd.set(day.mmdd, prev);
            report.push({
              mmdd: day.mmdd,
              reused: true,
              id: prev.id,
              name: prev.name,
              resolved: prev.resolved,
            });
            console.log(
              `${prefix} ↩️  ${day.mmdd} reuse -> ${prev.id} (${prev.resolved.source})`,
            );
            continue;
          }
        }

        try {
          const { chosen, tried } = await enrichOneDay(day, overrides, flags);

          if (chosen?.resolved?.url) {
            resultsByMmdd.set(day.mmdd, chosen);
            existingResolvedByMmdd.set(day.mmdd, chosen);

            const extra =
              tried.length > 1
                ? ` (tried ${tried.length}, picked "${chosen.name}")`
                : "";

            const suspicious = isChosenSuspiciousForDay(day, chosen, flags);
            const suspiciousTag = suspicious.length
              ? ` ⚠️ suspicious=${suspicious.join(",")}`
              : "";

            console.log(
              `${prefix} ✅ ${day.mmdd} -> ${chosen.resolved.source} (${chosen.resolved.confidence.toFixed(
                1,
              )}) ${chosen.resolved.url}${extra}${suspiciousTag}`,
            );

            report.push({
              mmdd: day.mmdd,
              feast: day.feast,
              chosen: {
                id: chosen.id,
                name: chosen.name,
                resolved: chosen.resolved,
                suspicious,
              },
              tried,
            });
          } else {
            const placeholderName = day.featuredSaint
              ? String(day.featuredSaint)
              : `Unknown Saint (${day.mmdd})`;

            const placeholder: EnrichedSaint = {
              id: `${day.mmdd}_${slugifyIdPart(placeholderName)}`,
              name: placeholderName,
              mmdd: day.mmdd,
              feast: day.feast,
              resolved: null,
              sources: [],
            };

            resultsByMmdd.set(day.mmdd, placeholder);
            console.log(
              `${prefix} ⚠️  ${day.mmdd} -> no_match (tried ${tried.length})`,
            );

            report.push({
              mmdd: day.mmdd,
              feast: day.feast,
              chosen: null,
              tried,
            });
          }
        } catch (e: any) {
          console.log(
            `${prefix} ❌ ${day.mmdd} -> error: ${e?.message || String(e)}`,
          );
          report.push({ mmdd: day.mmdd, error: e?.message || String(e) });
        }

        if (flags.sleepMs) await sleep(flags.sleepMs);
      }
    }

    const workers = Array.from({ length: flags.concurrency }, () => worker());
    await Promise.all(workers);

    const results = [...resultsByMmdd.values()].sort((a, b) =>
      a.mmdd.localeCompare(b.mmdd),
    );
    const ok = results.filter((r) => r.resolved?.url).length;
    const noMatch = results.filter((r) => !r.resolved?.url).length;

    writeJson(OUT_ENRICHED, results);
    writeJson(OUT_REPORT, {
      ok,
      noMatch,
      total: results.length,
      inputInvalidRows,
      input: path.relative(ROOT, inputPath),
      generatedAt: new Date().toISOString(),
      flags,
      report,
    });

    if (flags.writeAudit) {
      const audited = auditFeaturedRun(days, results, flags);
      writeJson(OUT_AUDIT, {
        ...audited,
        input: path.relative(ROOT, inputPath),
        generatedAt: new Date().toISOString(),
        flags,
      });
    }

    console.log("---- Done ----");
    console.log({ ok, noMatch, inputInvalidRows });
    console.log(`Wrote: ${OUT_ENRICHED}`);
    console.log(`Wrote: ${OUT_REPORT}`);
    if (flags.writeAudit) console.log(`Wrote: ${OUT_AUDIT}`);
    return;
  }

  // scope=all (enrich a saintArray input)
  const { entries, inputInvalidRows } = loadSaintEntries(inputPath);

  console.log(
    `Enriching saints (all-entry mode): entries=${entries.length} onlyMissing=${flags.onlyMissing} concurrency=${flags.concurrency} sleepMs=${flags.sleepMs} minIntervalMs=${flags.minIntervalMs} maxRetries=${flags.maxRetries} refreshCache=${flags.refreshCache}`,
  );

  const results: EnrichedSaint[] = [];
  const report: any[] = [];
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= entries.length) return;

      const entry = entries[i];
      const prefix = `[${i + 1}/${entries.length}]`;

      if (flags.onlyMissing) {
        const prev = existingById.get(entry.id);
        if (prev?.resolved?.url) {
          results.push(prev);
          report.push({
            id: prev.id,
            name: prev.name,
            mmdd: prev.mmdd,
            reused: true,
          });
          console.log(`${prefix} ↩️  ${entry.id} already resolved -> reuse`);
          continue;
        }
      }

      try {
        const enriched = await enrichOne(entry, overrides, flags);
        results.push(enriched);

        if (enriched.resolved) {
          console.log(
            `${prefix} ✅ ${entry.id} -> ${enriched.resolved.source} (${enriched.resolved.confidence.toFixed(
              1,
            )}) ${enriched.resolved.url}`,
          );
        } else {
          console.log(`${prefix} ⚠️  ${entry.id} -> no_match`);
        }

        report.push({
          id: entry.id,
          name: entry.name,
          mmdd: entry.mmdd,
          resolved: enriched.resolved,
          sources: enriched.sources,
        });
      } catch (e: any) {
        console.log(
          `${prefix} ❌ ${entry.id} -> error: ${e?.message || String(e)}`,
        );
        results.push({ ...entry, resolved: null });
        report.push({ id: entry.id, error: e?.message || String(e) });
      }

      if (flags.sleepMs) await sleep(flags.sleepMs);
    }
  }

  const workers = Array.from({ length: flags.concurrency }, () => worker());
  await Promise.all(workers);

  results.sort((a, b) =>
    a.mmdd === b.mmdd ? a.id.localeCompare(b.id) : a.mmdd.localeCompare(b.mmdd),
  );

  const ok = results.filter((r) => r.resolved?.url).length;
  const noMatch = results.filter((r) => !r.resolved?.url).length;

  writeJson(OUT_ENRICHED, results);
  writeJson(OUT_REPORT, {
    ok,
    noMatch,
    total: results.length,
    inputInvalidRows,
    input: path.relative(ROOT, inputPath),
    generatedAt: new Date().toISOString(),
    flags,
    report,
  });

  console.log("---- Done ----");
  console.log({ ok, noMatch, inputInvalidRows });
  console.log(`Wrote: ${OUT_ENRICHED}`);
  console.log(`Wrote: ${OUT_REPORT}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
