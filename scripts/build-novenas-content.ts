import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

const LIST_URL = "https://catholicnovenaapp.com/list-of-all-novenas/";

type Rule =
  | { type: "fixed"; month: number; day: number }
  | { type: "anchor"; anchor: string }
  | { type: "relative"; anchor: string; offsetDays: number; weekday?: number }
  | { type: "nth_weekday_after"; anchor: string; weekday: number; n: number }
  | { type: "before_feast"; daysBefore: number }
  | { type: "raw"; text: string };

type NovenaIndexEntry = {
  id: string;
  title: string;
  startRule?: Rule;
  feastRule: Rule;
  durationDays?: number;
  category: string;
  tags: string[];
  description: string | null;
  patronage: string[];
  image: string | null;
  notes: string | null;
  source?: { url: string };
};

type NovenaDay = {
  day: number;
  title?: string | null;
  prayer?: string | null;
  reflection?: string | null;
  scripture?: string | null;
};

type NovenaContent = {
  id: string;
  title: string;
  description: string | null;
  category?: string;
  tags?: string[];

  // optional now
  startRule?: Rule;
  feastRule?: Rule;

  // inclusive duration (optional; runtime can default to 9)
  durationDays?: number;

  source?: { url: string; pageUrl?: string };
  days: NovenaDay[];
};

function normalizeTitleForMatch(t: string) {
  return t
    .trim()
    .toLowerCase()
    .replace(/\s+novena$/i, "")
    .replace(/\s+/g, " ")
    .replace(/[\u2019']/g, "")
    .replace(/&/g, "and");
}

function absUrl(href: string) {
  if (!href) return "";
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) return "https:" + href;
  if (href.startsWith("/")) return "https://catholicnovenaapp.com" + href;
  return "https://catholicnovenaapp.com/" + href.replace(/^\.?\//, "");
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok)
    throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`);
  return await res.text();
}

function safeAtomicWrite(outPath: string, contents: string) {
  const tmp = outPath + ".tmp";
  fs.writeFileSync(tmp, contents, "utf8");
  fs.renameSync(tmp, outPath);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Build map: normalizedTitle -> pageUrl
 * We only accept links that look like /novenas/.../ (the content pages)
 */
function buildTitleToPageUrlMap(listHtml: string): Map<string, string> {
  const $ = cheerio.load(listHtml);
  const map = new Map<string, string>();

  $("a").each((_, a) => {
    const href = String($(a).attr("href") ?? "");
    const text = $(a).text().trim();
    if (!href || !text) return;

    const url = absUrl(href);
    if (!url.includes("catholicnovenaapp.com/novenas/")) return;

    if (text.toLowerCase().includes("permalink")) return;
    if (text.toLowerCase().includes("browse")) return;
    if (text.toLowerCase().includes("quick links")) return;

    const key = normalizeTitleForMatch(text);
    if (!key) return;

    if (!map.has(key)) map.set(key, url);
  });

  return map;
}

/**
 * Extract days from a novena page:
 * - find headings like "Day 1", "Day 2", ...
 * - collect text until next "Day N" heading
 */
function parseNovenaPage(
  pageUrl: string,
  html: string,
): { title: string; description: string | null; days: NovenaDay[] } {
  const $ = cheerio.load(html);

  const title = ($("h1").first().text() || "").trim() || "Untitled";
  const description =
    $("h1").first().nextAll("p").first().text().trim() || null;

  const dayHeadings = $("h2, h3")
    .toArray()
    .filter((el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      return /^day\s+\d+$/i.test(t);
    });

  const days: NovenaDay[] = [];

  for (let i = 0; i < dayHeadings.length; i++) {
    const h = dayHeadings[i];
    const hText = $(h).text().trim();
    const dayNum = Number(hText.match(/\d+/)?.[0] ?? NaN);
    if (!Number.isFinite(dayNum)) continue;

    const start = $(h);
    const endEl = i + 1 < dayHeadings.length ? dayHeadings[i + 1] : null;

    const chunkParts: string[] = [];
    let cursor = start.next();

    while (cursor.length) {
      if (endEl && cursor[0] === endEl) break;

      const text = cursor.text().replace(/\s+/g, " ").trim();
      if (text) chunkParts.push(text);

      cursor = cursor.next();
    }

    const block = chunkParts
      .join("\n\n")
      .replace(/Continue this novena.*OPEN\s*→/gi, "")
      .replace(/Today's prayer complete!\s*/gi, "")
      .replace(/Share this novena.*$/gim, "")
      .trim();

    if (!block) continue;

    days.push({
      day: dayNum,
      title: null,
      prayer: block,
      scripture: null,
      reflection: null,
    });
  }

  return { title, description, days };
}

async function main() {
  const root = process.cwd();
  const indexPath = path.join(root, "data", "novenas_index.json");
  const outDir = path.join(root, "data", "novenas");
  fs.mkdirSync(outDir, { recursive: true });

  if (!fs.existsSync(indexPath)) {
    throw new Error(`Missing index: ${indexPath}`);
  }

  const index: NovenaIndexEntry[] = JSON.parse(
    fs.readFileSync(indexPath, "utf8"),
  );

  console.log("Fetching list page:", LIST_URL);
  const listHtml = await fetchHtml(LIST_URL);
  const titleToUrl = buildTitleToPageUrlMap(listHtml);

  console.log("Index entries:", index.length);
  console.log("Candidate novena page links found:", titleToUrl.size);

  let wrote = 0;
  let skippedNoUrl = 0;
  let skippedParse = 0;

  for (const e of index) {
    const key = normalizeTitleForMatch(e.title);
    const pageUrl = titleToUrl.get(key);

    if (!pageUrl) {
      skippedNoUrl++;
      continue;
    }

    const outPath = path.join(outDir, `${e.id}.json`);
    if (fs.existsSync(outPath)) {
      continue; // keep curated
    }

    try {
      const pageHtml = await fetchHtml(pageUrl);
      const parsed = parseNovenaPage(pageUrl, pageHtml);

      if (!parsed.days.length) {
        skippedParse++;
        continue;
      }

      const doc: NovenaContent = {
        id: e.id,
        title: parsed.title || e.title,
        description: parsed.description ?? e.description ?? null,
        category: e.category,
        tags: e.tags,

        // New model fields
        durationDays: e.durationDays,
        startRule: e.startRule,
        feastRule: e.feastRule,

        source: { url: LIST_URL, pageUrl },
        days: parsed.days.sort((a, b) => a.day - b.day),
      };

      safeAtomicWrite(outPath, JSON.stringify(doc, null, 2));
      wrote++;

      await sleep(150);
    } catch (err) {
      skippedParse++;
    }
  }

  console.log(`Wrote novena content files: ${wrote}`);
  console.log(`Skipped (no page url match): ${skippedNoUrl}`);
  console.log(`Skipped (parse/fetch issues): ${skippedParse}`);
  console.log(`Output dir: ${outDir}`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
