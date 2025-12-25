// scripts/build-novenas-index.ts
import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

const SOURCE_URL = "https://catholicnovenaapp.com/list-of-all-novenas/";

type FixedRule = { type: "fixed"; month: number; day: number };
type AnchorRule = { type: "anchor"; anchor: string };

// Simple relative offset from an anchor date (optionally snap to a weekday)
type RelativeRule = {
  type: "relative";
  anchor: string;
  offsetDays: number;
  weekday?: number; // 0=Sun .. 6=Sat (snap forward to this weekday)
};

// Nth occurrence of a weekday after an anchor (e.g., 2nd Friday after Pentecost)
type NthWeekdayAfterRule = {
  type: "nth_weekday_after";
  anchor: string;
  weekday: number; // 0=Sun .. 6=Sat
  n: number; // 1 = first occurrence after anchor, 2 = second, ...
};

type BeforeFeastRule = {
  type: "before_feast";
  daysBefore: number;
};

type RawRule = { type: "raw"; text: string };

type Rule =
  | FixedRule
  | AnchorRule
  | RelativeRule
  | NthWeekdayAfterRule
  | BeforeFeastRule
  | RawRule;

type NovenaIndexEntry = {
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

  source: { url: string };
};

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const MONTH_NAMES = new Set(Object.keys(MONTHS).map((m) => m.toLowerCase()));

function toSnakeCaseId(s: string) {
  return s
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTitle(raw: string) {
  return raw.replace(/\s+Novena$/i, "").trim();
}

function isJunkTitle(title: string) {
  const t = title.trim().toLowerCase();
  if (!t) return true;
  if (t.includes("permalink")) return true;
  if (t.includes("browse by month")) return true;
  if (t.includes("quick links")) return true;
  if (t.includes("novenas starting today")) return true;
  if (t === "about" || t === "list of novenas" || t === "list of saints")
    return true;
  if (MONTH_NAMES.has(t)) return true; // ✅ prevents “January” etc becoming a novena title
  if (t.length < 3) return true;
  return false;
}

function parseMonthDay(s: string): FixedRule | null {
  const m = s.trim().match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  const day = Number(m[2]);
  if (!month || !day) return null;
  return { type: "fixed", month, day };
}

function parseRule(text: string): Rule {
  const t = text.trim();

  // ✅ Holy Family special case (site uses a long explanatory sentence)
  if (/sunday\s+within\s+the\s+octave\s+of\s+christmas/i.test(t)) {
    return { type: "anchor", anchor: "holy_family" };
  }

  // ✅ Special phrases we know appear on the source site
  if (/^nine\s+days\s+before\s+the\s+feastday$/i.test(t)) {
    return { type: "before_feast", daysBefore: 9 };
  }

  // e.g. "Saturday after Ascension Thursday"
  let m = t.match(
    /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+after\s+(.+)$/i,
  );
  if (m) {
    const weekday = WEEKDAYS[m[1].toLowerCase()];
    const anchorText = m[2].trim();
    // Use Nth occurrence after anchor: "Saturday after X" == 1st Saturday after anchor
    return {
      type: "nth_weekday_after",
      anchor: toSnakeCaseId(anchorText),
      weekday,
      n: 1,
    };
  }

  // e.g. "Second Friday after Pentecost"
  m = t.match(
    /^(first|second|third|fourth|fifth)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+after\s+(.+)$/i,
  );
  if (m) {
    const ordMap: Record<string, number> = {
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
      fifth: 5,
    };
    const n = ordMap[m[1].toLowerCase()];
    const weekday = WEEKDAYS[m[2].toLowerCase()];
    const anchorText = m[3].trim();
    return {
      type: "nth_weekday_after",
      anchor: toSnakeCaseId(anchorText),
      weekday,
      n,
    };
  }

  // ✅ "Thursday of the Fifth Week of Easter"
  // Interpreting "Week of Easter" as week 1 (starting Easter Sunday)
  // "Fifth week Thursday" => Easter + 4 weeks + Thursday offset (Sun=0 => Thu=4) => +32
  if (/^thursday\s+of\s+the\s+fifth\s+week\s+of\s+easter$/i.test(t)) {
    return { type: "relative", anchor: "easter", offsetDays: 32 };
  }

  const fixed = parseMonthDay(t);
  if (fixed) return fixed;

  const lower = t.toLowerCase();

  const anchors: Record<string, string> = {
    "good friday": "good_friday",
    "divine mercy sunday": "divine_mercy_sunday",
    "shrove tuesday": "shrove_tuesday",
    pentecost: "pentecost",
    "on pentecost": "pentecost",
    "ascension thursday": "ascension_thursday",
    "corpus christi": "corpus_christi",
    "ash wednesday": "ash_wednesday",
    easter: "easter",
    "easter sunday": "easter",
    "christmas day": "christmas",
    "new year's day": "mary_mother_of_god",
  };
  if (anchors[lower]) return { type: "anchor", anchor: anchors[lower] };

  // e.g. "10 days before Pentecost"
  m = t.match(/^(\d+)\s+days?\s+before\s+(.+)$/i);
  if (m) {
    return {
      type: "relative",
      anchor: toSnakeCaseId(m[2]),
      offsetDays: -Number(m[1]),
    };
  }

  // e.g. "19 days after Pentecost, on a Friday"
  m = t.match(
    /^(\d+)\s+days?\s+after\s+(.+?)(?:,\s*on\s*a\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday))?$/i,
  );
  if (m) {
    const weekday = m[3] ? WEEKDAYS[m[3].toLowerCase()] : undefined;
    return {
      type: "relative",
      anchor: toSnakeCaseId(m[2]),
      offsetDays: Number(m[1]),
      weekday,
    };
  }

  // e.g. "The Sunday 10 days before Shrove Tuesday"
  m = t.match(
    /^the\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(\d+)\s+days?\s+before\s+(.+)$/i,
  );
  if (m) {
    return {
      type: "relative",
      anchor: toSnakeCaseId(m[3]),
      offsetDays: -Number(m[2]),
      weekday: WEEKDAYS[m[1].toLowerCase()],
    };
  }

  return { type: "raw", text: t };
}

/**
 * Taxonomy
 */
function computeCategory(title: string): string {
  const t = title.toLowerCase();

  if (
    t.includes("our lady") ||
    t.includes("immaculate") ||
    t.includes("mary,") ||
    t.includes("mother of god") ||
    t.includes("rosary") ||
    t.includes("fatima") ||
    t.includes("guadalupe") ||
    t.includes("la salette") ||
    t.includes("miraculous medal") ||
    t.includes("perpetual help") ||
    t.includes("good counsel") ||
    t.includes("queen of") ||
    t.includes("visitation")
  )
    return "Marian";

  if (
    t.includes("holy face") ||
    t.includes("holy name") ||
    t.includes("divine mercy") ||
    t.includes("sacred heart") ||
    t.includes("corpus christi") ||
    t.includes("epiphany") ||
    t.includes("annunciation") ||
    t.includes("assumption") ||
    t.includes("all saints") ||
    t.includes("holy family") ||
    t.includes("holy innocents") ||
    t.includes("holy spirit") ||
    t.includes("holy cross")
  )
    return "Feast";

  if (
    t.includes("respect life") ||
    t.includes("election") ||
    t.includes("fertility") ||
    t.includes("for pope") ||
    t.includes("new pope") ||
    t.includes("impossible requests") ||
    t.includes("surrender") ||
    t.includes("repose")
  )
    return "Intention";

  if (
    t.startsWith("st ") ||
    t.startsWith("st.") ||
    t.startsWith("bl ") ||
    t.includes("saint") ||
    t.includes("martyrs") ||
    t.includes("apostle") ||
    t.includes("blessed")
  )
    return "Saint";

  return "Devotion";
}

function computeTags(title: string, category: string): string[] {
  const tags = new Set<string>();
  tags.add("Novena");
  tags.add(category);

  const t = title.toLowerCase();
  if (category === "Saint") tags.add("Saint");
  if (category === "Marian") tags.add("Mary");

  if (t.includes("joseph")) tags.add("St Joseph");
  if (t.includes("rosary")) tags.add("Rosary");
  if (t.includes("holy spirit")) tags.add("Holy Spirit");
  if (t.includes("election")) tags.add("Election");
  if (t.includes("fertility")) tags.add("Fertility");

  tags.add(title);
  return Array.from(tags);
}

function parseStartsFeastLine(
  line: string,
): { startText: string; feastText: string } | null {
  const m = line.match(/📆\s*Starts:\s*([^•]+)\s*•\s*Feast:\s*(.+)\s*$/);
  if (!m) return null;
  return { startText: m[1].trim(), feastText: m[2].trim() };
}

function findTitleForCalendarLine(
  $: cheerio.CheerioAPI,
  el: cheerio.Element,
): string {
  const container = $(el).closest("li, p, div, section, article");
  if (container.length) {
    const anchors = container.find("a").toArray();
    for (const a of anchors) {
      const txt = $(a).text().trim();
      if (txt && !isJunkTitle(txt)) return txt;
    }
  }

  const prev = $(el).prevAll("a").first();
  if (prev.length) {
    const txt = prev.text().trim();
    if (txt && !isJunkTitle(txt)) return txt;
  }

  return "";
}

function safeAtomicWrite(outPath: string, contents: string) {
  const tmpPath = outPath + ".tmp";
  fs.writeFileSync(tmpPath, contents, "utf8");
  fs.renameSync(tmpPath, outPath);
}

async function main() {
  console.log("Fetching:", SOURCE_URL);

  const res = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  console.log("Status:", res.status, res.statusText);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const html = await res.text();
  console.log("HTML length:", html.length);

  const $ = cheerio.load(html);

  const nodes = $(":contains('📆 Starts:')").toArray();
  const raw: Array<{ title: string; startText: string; feastText: string }> =
    [];

  for (const el of nodes) {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text.includes("📆 Starts:")) continue;

    // ✅ Guard: if this node includes multiple novenas, skip
    const startsCount = (text.match(/📆\s*Starts:/g) ?? []).length;
    if (startsCount !== 1) continue;

    const parsed = parseStartsFeastLine(text);
    if (!parsed) continue;

    const titleRaw = findTitleForCalendarLine($, el);
    const title = normalizeTitle(titleRaw);
    if (!title || isJunkTitle(title)) continue;

    raw.push({
      title,
      startText: parsed.startText,
      feastText: parsed.feastText,
    });
  }

  console.log("Parsed entries (raw DOM hits):", raw.length);
  if (raw.length === 0) {
    throw new Error(
      "Parsed 0 entries — page structure changed or selector failed.",
    );
  }

  // De-dupe by exact triple
  const seen = new Set<string>();
  const uniqueTriples: typeof raw = [];
  for (const r of raw) {
    const key = `${r.title}|||${r.startText}|||${r.feastText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueTriples.push(r);
  }

  const entries: NovenaIndexEntry[] = uniqueTriples.map((r) => {
    const category = computeCategory(r.title);
    const tags = computeTags(r.title, category);
    return {
      id: toSnakeCaseId(r.title),
      title: r.title,
      startRule: parseRule(r.startText),
      feastRule: parseRule(r.feastText),
      category,
      tags,
      description: null,
      patronage: [],
      image: null,
      notes: null,
      source: { url: SOURCE_URL },
    };
  });

  entries.sort((a, b) => a.title.localeCompare(b.title));

  // Ensure unique IDs
  const idCounts = new Map<string, number>();
  const final: NovenaIndexEntry[] = entries.map((e) => {
    const base = e.id;
    const n = (idCounts.get(base) ?? 0) + 1;
    idCounts.set(base, n);
    return n === 1 ? e : { ...e, id: `${base}_${n}` };
  });

  const rawRuleCount = final.filter(
    (e) => e.startRule.type === "raw" || e.feastRule.type === "raw",
  ).length;

  console.log("Unique triples:", uniqueTriples.length);
  console.log("Final entries:", final.length);
  console.log("Entries with raw rules:", rawRuleCount);

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const outPath = path.join(dataDir, "novenas_index.json");
  safeAtomicWrite(outPath, JSON.stringify(final, null, 2));
  console.log("Wrote:", outPath);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
