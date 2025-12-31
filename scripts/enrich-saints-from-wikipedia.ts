/**
 * Enrich saint JSON docs using Wikipedia, with Wikidata-first disambiguation.
 *
 * Reads:   data/saints_index.json
 * Writes:  data/saints/<id>.json  (merges summary/biography/sources)
 *
 * Notes:
 * - Wikipedia text is CC BY-SA. You MUST attribute (we store the page URL).
 * - Wikidata is CC0 and used only for entity resolution/validation.
 *
 * Run:
 *   npx tsx scripts/enrich-saints-from-wikipedia.ts --concurrency=2 --sleepMs=300 --minIntervalMs=900 --maxRetries=6
 *
 * Options:
 *   --only-missing
 *   --limit=50
 *   --concurrency=3
 *   --sleepMs=250
 *   --minIntervalMs=900
 *   --maxRetries=6
 *   --refreshCache
 */

import fs from "fs";
import path from "path";

type SaintIndexEntry = {
  id: string;
  name: string;
  mmdd: string;
  feast?: string;
};

type SaintDoc = {
  id: string;
  name: string;
  mmdd: string;
  feast?: string | null;
  summary?: string;
  biography?: string;
  prayers?: string[];
  sources?: string[];
};

type WikiSummary = {
  title: string;
  extract?: string;
  url?: string;
  description?: string;
};

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, "data", "saints_index.json");
const SAINTS_DIR = path.join(ROOT, "data", "saints");

const CACHE_DIR = path.join(ROOT, "data", ".cache");
const CACHE_WD_RESOLVE = path.join(CACHE_DIR, "wikidata_resolve.json"); // entryKey -> enwiki title|null
const CACHE_WIKI_SUMMARY = path.join(CACHE_DIR, "wiki_summary.json"); // title -> summary payload

const argv = process.argv.slice(2);
const ONLY_MISSING = argv.includes("--only-missing");
const LIMIT = getArgNumber("--limit");
const CONCURRENCY = getArgNumber("--concurrency") ?? 3;
const SLEEP_MS = getArgNumber("--sleepMs") ?? 250;
const MIN_INTERVAL_MS = getArgNumber("--minIntervalMs") ?? 0;
const MAX_RETRIES = getArgNumber("--maxRetries") ?? 3;
const REFRESH_CACHE = argv.includes("--refreshCache");

function getArgNumber(prefix: string): number | undefined {
  const hit = argv.find((a) => a.startsWith(prefix + "="));
  if (!hit) return undefined;
  const n = Number(hit.split("=")[1]);
  return Number.isFinite(n) ? n : undefined;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p: string, obj: any) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function safeFileForId(id: string) {
  return path.join(SAINTS_DIR, `${id}.json`);
}

function normalizeName(name: string): string {
  return name
    .replace(/^Saint\s+/i, "")
    .replace(/^St\.\s+/i, "")
    .replace(/^St\s+/i, "")
    .replace(/^Blessed\s+/i, "Blessed ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickSummaryAndBio(extract: string): {
  summary: string;
  biography: string;
} {
  const bio = extract.trim();
  const sentences = bio.split(/(?<=[.!?])\s+/).filter(Boolean);

  let summary = sentences.slice(0, 2).join(" ").trim();
  if (summary.length < 120 && sentences.length >= 3)
    summary = sentences.slice(0, 3).join(" ").trim();
  if (summary.length > 420) summary = summary.slice(0, 420).trim() + "…";

  return { summary, biography: bio };
}

function loadCache<T extends object>(p: string): T {
  if (REFRESH_CACHE) return {} as T;
  if (!fs.existsSync(p)) return {} as T;
  try {
    return readJson<T>(p);
  } catch {
    return {} as T;
  }
}

function saveCache(p: string, obj: any) {
  writeJson(p, obj);
}

/**
 * Global rate limiter.
 */
let lastRequestAt = 0;
async function rateLimitedFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  if (MIN_INTERVAL_MS > 0) {
    const now = Date.now();
    const wait = lastRequestAt + MIN_INTERVAL_MS - now;
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  }
  return fetch(url, init);
}

/**
 * Fetch with retry/backoff.
 */
async function fetchWithRetries(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let attempt = 0;
  let lastErr: any = null;

  while (attempt <= MAX_RETRIES) {
    try {
      const res = await rateLimitedFetch(url, init);
      if (res.ok) return res;

      const retryable = [429, 500, 502, 503, 504].includes(res.status);
      if (!retryable) return res;

      lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (e) {
      lastErr = e;
    }

    attempt++;
    const backoff = Math.min(1000 + attempt * 750, 8000);
    await sleep(backoff);
  }

  throw lastErr ?? new Error("fetch failed");
}

/**
 * Wikipedia summary endpoint (fast, no scraping HTML).
 */
async function wikiSummary(
  title: string,
  summaryCache: Record<string, WikiSummary>,
): Promise<WikiSummary> {
  if (!REFRESH_CACHE && summaryCache[title]) return summaryCache[title];

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetchWithRetries(url, {
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    const out: WikiSummary = { title };
    summaryCache[title] = out;
    return out;
  }

  const json: any = await res.json();
  const out: WikiSummary = {
    title: json?.title ?? title,
    extract: json?.extract,
    url: json?.content_urls?.desktop?.page,
    description: json?.description,
  };
  summaryCache[title] = out;
  return out;
}

/**
 * Wikidata search (wbsearchentities).
 */
async function wikidataSearch(
  query: string,
): Promise<Array<{ id: string; label?: string; description?: string }>> {
  const url =
    "https://www.wikidata.org/w/api.php" +
    `?action=wbsearchentities&search=${encodeURIComponent(query)}` +
    "&language=en&format=json&limit=15&origin=*";

  const res = await fetchWithRetries(url);
  if (!res.ok) return [];
  const json: any = await res.json();
  const rows = json?.search ?? [];
  return rows.map((r: any) => ({
    id: r?.id,
    label: r?.label,
    description: r?.description,
  }));
}

/**
 * Get a Wikidata entity (claims + sitelinks + description).
 */
async function wikidataGetEntity(qid: string): Promise<any | null> {
  const url =
    "https://www.wikidata.org/w/api.php" +
    `?action=wbgetentities&ids=${encodeURIComponent(qid)}` +
    "&props=claims|descriptions|labels|sitelinks&languages=en&format=json&origin=*";

  const res = await fetchWithRetries(url);
  if (!res.ok) return null;
  const json: any = await res.json();
  return json?.entities?.[qid] ?? null;
}

function wikidataIsHuman(entity: any): boolean {
  const p31 = entity?.claims?.P31;
  if (!Array.isArray(p31)) return false;
  // Q5 = human
  return p31.some((c: any) => c?.mainsnak?.datavalue?.value?.id === "Q5");
}

const SAINT_KEYWORDS = [
  "saint",
  "christian",
  "catholic",
  "martyr",
  "bishop",
  "archbishop",
  "pope",
  "monk",
  "nun",
  "abbot",
  "friar",
  "priest",
  "missionary",
  "hermit",
  "confessor",
  "apostle",
  "evangelist",
];

function looksSaintish(label?: string, description?: string): boolean {
  const l = (label ?? "").toLowerCase();
  const d = (description ?? "").toLowerCase();
  return SAINT_KEYWORDS.some((k) => l.includes(k) || d.includes(k));
}

/**
 * Resolve saint -> best enwiki title using Wikidata FIRST.
 *
 * Why this works:
 * - Wikidata returns actual people entities (Q5 humans).
 * - Those entities link to the correct enwiki page title (sitelink),
 *   even when Wikipedia search is noisy.
 */
async function resolveToEnwikiTitle(
  entry: SaintIndexEntry,
  resolveCache: Record<string, string | null>,
): Promise<string | null> {
  const base = normalizeName(entry.name);
  const key = `${entry.id}::${base}`;

  if (!REFRESH_CACHE && key in resolveCache) return resolveCache[key];

  // Try multiple targeted queries
  const queries = [
    `Saint ${base}`,
    `${base} (saint)`,
    `${base} martyr`,
    `${base} bishop`,
    `${base} pope`,
    `${base} monk`,
    `${base} nun`,
    `${entry.name} saint`,
  ];

  // Collect candidates with a simple score
  const candidates: Array<{
    qid: string;
    score: number;
    label?: string;
    description?: string;
  }> = [];

  for (const q of queries) {
    const rows = await wikidataSearch(q);
    for (const r of rows) {
      if (!r.id) continue;
      let score = 0;

      // Prefer saint-ish descriptions/labels
      if (looksSaintish(r.label, r.description)) score += 50;

      // Prefer direct label match
      const lname = (r.label ?? "").toLowerCase();
      const b = base.toLowerCase();
      if (lname === b) score += 10;
      if (lname.includes(b)) score += 8;

      // Prefer queries that include "Saint"
      if (q.toLowerCase().startsWith("saint ")) score += 5;

      candidates.push({
        qid: r.id,
        score,
        label: r.label,
        description: r.description,
      });
    }

    // If we already have good candidates, stop early
    if (candidates.some((c) => c.score >= 55)) break;
  }

  // De-dupe QIDs by best score
  const bestByQid = new Map<
    string,
    { qid: string; score: number; label?: string; description?: string }
  >();
  for (const c of candidates) {
    const prev = bestByQid.get(c.qid);
    if (!prev || c.score > prev.score) bestByQid.set(c.qid, c);
  }

  const sorted = Array.from(bestByQid.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  for (const c of sorted) {
    const entity = await wikidataGetEntity(c.qid);
    if (!entity) continue;

    // Must be human
    if (!wikidataIsHuman(entity)) continue;

    // Must be saint-ish by entity label/description (more reliable than search snippet)
    const elabel = entity?.labels?.en?.value;
    const edesc = entity?.descriptions?.en?.value;
    if (!looksSaintish(elabel, edesc) && !looksSaintish(c.label, c.description))
      continue;

    // Must have enwiki sitelink
    const enwikiTitle = entity?.sitelinks?.enwiki?.title;
    if (typeof enwikiTitle === "string" && enwikiTitle.trim().length > 0) {
      resolveCache[key] = enwikiTitle.trim();
      return resolveCache[key];
    }
  }

  resolveCache[key] = null;
  return null;
}

async function enrichOne(
  entry: SaintIndexEntry,
  resolveCache: Record<string, string | null>,
  summaryCache: Record<string, WikiSummary>,
) {
  const filePath = safeFileForId(entry.id);

  if (!fs.existsSync(filePath)) {
    const stub: SaintDoc = {
      id: entry.id,
      name: entry.name,
      mmdd: entry.mmdd,
      feast: entry.feast ?? null,
      prayers: [],
      sources: [],
    };
    writeJson(filePath, stub);
  }

  const doc = readJson<SaintDoc>(filePath);

  if (ONLY_MISSING && (doc.summary?.trim() || doc.biography?.trim())) {
    return { id: entry.id, status: "skipped_existing" as const };
  }

  const title = await resolveToEnwikiTitle(entry, resolveCache);
  if (!title) return { id: entry.id, status: "no_match" as const };

  const sum = await wikiSummary(title, summaryCache);
  if (!sum.extract || sum.extract.trim().length < 80) {
    return { id: entry.id, status: "no_extract" as const, match: title };
  }

  const { summary, biography } = pickSummaryAndBio(sum.extract);

  const sources = new Set<string>(doc.sources ?? []);
  if (sum.url) sources.add(sum.url);
  sources.add("Wikipedia (CC BY-SA) — text attribution required.");
  sources.add("Wikidata (CC0) — used for entity resolution/validation.");

  const updated: SaintDoc = {
    ...doc,
    id: entry.id,
    name: entry.name,
    mmdd: entry.mmdd,
    feast: entry.feast ?? doc.feast ?? null,
    summary,
    biography,
    prayers: doc.prayers ?? [],
    sources: Array.from(sources),
  };

  writeJson(filePath, updated);
  return { id: entry.id, status: "ok" as const, match: sum.title ?? title };
}

/**
 * Worker pool.
 */
async function runPool<T>(
  items: T[],
  workerCount: number,
  fn: (item: T, idx: number) => Promise<any>,
) {
  let i = 0;
  const results: any[] = [];
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      const item = items[idx];
      const r = await fn(item, idx);
      results.push(r);
      await sleep(SLEEP_MS);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`Missing: ${INDEX_PATH}`);
  if (!fs.existsSync(SAINTS_DIR)) throw new Error(`Missing: ${SAINTS_DIR}`);

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const resolveCache =
    loadCache<Record<string, string | null>>(CACHE_WD_RESOLVE);
  const summaryCache =
    loadCache<Record<string, WikiSummary>>(CACHE_WIKI_SUMMARY);

  const index = readJson<SaintIndexEntry[]>(INDEX_PATH);
  const entries = typeof LIMIT === "number" ? index.slice(0, LIMIT) : index;

  console.log(
    `Enriching saints: entries=${entries.length} onlyMissing=${ONLY_MISSING} concurrency=${CONCURRENCY} sleepMs=${SLEEP_MS} minIntervalMs=${MIN_INTERVAL_MS} maxRetries=${MAX_RETRIES} refreshCache=${REFRESH_CACHE}`,
  );

  const results = await runPool(entries, CONCURRENCY, async (entry, idx) => {
    try {
      const r = await enrichOne(entry, resolveCache, summaryCache);

      if (r.status === "ok") {
        console.log(
          `[${idx + 1}/${entries.length}] ✅ ${entry.id} -> ${r.match}`,
        );
      } else {
        console.log(
          `[${idx + 1}/${entries.length}] ⚠️  ${entry.id} -> ${r.status}${(r as any).match ? ` (${(r as any).match})` : ""}`,
        );
      }

      return r;
    } catch (e: any) {
      console.log(
        `[${idx + 1}/${entries.length}] ❌ ${entry.id} -> error: ${e?.message ?? String(e)}`,
      );
      return { id: entry.id, status: "error", error: e?.message ?? String(e) };
    } finally {
      // persist caches incrementally
      saveCache(CACHE_WD_RESOLVE, resolveCache);
      saveCache(CACHE_WIKI_SUMMARY, summaryCache);
    }
  });

  const counts = {
    ok: results.filter((r) => r.status === "ok").length,
    skipped: results.filter((r) => r.status === "skipped_existing").length,
    noMatch: results.filter((r) => r.status === "no_match").length,
    noExtract: results.filter((r) => r.status === "no_extract").length,
    error: results.filter((r) => r.status === "error").length,
  };

  console.log("---- Done ----");
  console.log(counts);

  const reportPath = path.join(ROOT, "data", "saints_enrich_report.json");
  writeJson(reportPath, results);
  console.log(`Wrote report: ${reportPath}`);

  const unresolved = results.filter((r) => r.status !== "ok").map((r) => r.id);
  const unresolvedPath = path.join(
    ROOT,
    "data",
    "saints_enrich_unresolved.json",
  );
  writeJson(unresolvedPath, unresolved);
  console.log(`Wrote unresolved list: ${unresolvedPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
