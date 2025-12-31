// scripts/build-novenas-index.ts
import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

const SOURCE_URL = "https://catholicnovenaapp.com/list-of-all-novenas/";

type FixedRule = { type: "fixed"; month: number; day: number };
type AnchorRule = { type: "anchor"; anchor: string };

type RelativeRule = {
  type: "relative";
  anchor: string;
  offsetDays: number;
  weekday?: number; // 0=Sun .. 6=Sat
};

type NthWeekdayAfterRule = {
  type: "nth_weekday_after";
  anchor: string;
  weekday: number; // 0=Sun .. 6=Sat
  n: number;
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
  startRule?: Rule;
  feastRule: Rule;
  durationDays?: number;
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

const MONTH_NAMES = new Set(Object.keys(MONTHS));

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
  const t = title.toLowerCase();
  if (!t) return true;
  if (t.includes("permalink")) return true;
  if (t.includes("browse by month")) return true;
  if (t.includes("quick links")) return true;
  if (t.includes("novenas starting today")) return true;
  if (MONTH_NAMES.has(t)) return true;
  return false;
}

function parseMonthDay(s: string): FixedRule | null {
  const m = s.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  const day = Number(m[2]);
  if (!month || !day) return null;
  return { type: "fixed", month, day };
}

function parseRule(text: string): Rule {
  const t = text.trim();

  if (/nine\s+days\s+before\s+the\s+feastday/i.test(t)) {
    return { type: "before_feast", daysBefore: 9 };
  }

  const fixed = parseMonthDay(t);
  if (fixed) return fixed;

  const m1 = t.match(/^(\d+)\s+days?\s+before\s+(.+)$/i);
  if (m1) {
    return {
      type: "relative",
      anchor: toSnakeCaseId(m1[2]),
      offsetDays: -Number(m1[1]),
    };
  }

  const m2 = t.match(/^(\d+)\s+days?\s+after\s+(.+)$/i);
  if (m2) {
    return {
      type: "relative",
      anchor: toSnakeCaseId(m2[2]),
      offsetDays: Number(m2[1]),
    };
  }

  return { type: "raw", text: t };
}

function deriveDurationDays(
  startRule: Rule | undefined,
  feastRule: Rule,
): number | undefined {
  if (startRule?.type === "before_feast") {
    return startRule.daysBefore + 1;
  }

  if (startRule?.type === "fixed" && feastRule.type === "fixed") {
    const y = 2025;
    const start = Date.UTC(y, startRule.month - 1, startRule.day);
    const feastYear =
      feastRule.month < startRule.month ||
      (feastRule.month === startRule.month && feastRule.day < startRule.day)
        ? y + 1
        : y;

    const feast = Date.UTC(feastYear, feastRule.month - 1, feastRule.day);
    const diff = Math.round((feast - start) / 86400000);
    if (diff >= 0 && diff <= 4000) return diff + 1;
  }

  return undefined;
}

function computeCategory(title: string): string {
  const t = title.toLowerCase();

  if (t.includes("our lady") || t.includes("mary")) return "Marian";
  if (t.includes("holy") || t.includes("sacred")) return "Feast";
  if (t.includes("saint") || t.startsWith("st ")) return "Saint";

  return "Devotion";
}

function computeTags(title: string, category: string): string[] {
  const tags = new Set<string>(["Novena", category]);
  tags.add(title);
  return Array.from(tags);
}

function safeAtomicWrite(outPath: string, contents: string) {
  const tmp = outPath + ".tmp";
  fs.writeFileSync(tmp, contents, "utf8");
  fs.renameSync(tmp, outPath);
}

async function main() {
  console.log("Fetching:", SOURCE_URL);

  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const nodes = $(":contains('📆 Starts:')").toArray();
  const raw: Array<{ title: string; startText: string; feastText: string }> =
    [];

  for (const el of nodes) {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text.includes("📆 Starts:")) continue;

    const m = text.match(/📆\s*Starts:\s*([^•]+)\s*•\s*Feast:\s*(.+)$/);
    if (!m) continue;

    const titleRaw = $(el).closest("li").find("a").first().text();
    const title = normalizeTitle(titleRaw);
    if (!title || isJunkTitle(title)) continue;

    raw.push({
      title,
      startText: m[1].trim(),
      feastText: m[2].trim(),
    });
  }

  const seen = new Set<string>();
  const unique = raw.filter((r) => {
    const k = `${r.title}|${r.startText}|${r.feastText}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const entries: NovenaIndexEntry[] = unique.map((r) => {
    const category = computeCategory(r.title);
    const tags = computeTags(r.title, category);

    const startRule = parseRule(r.startText);
    const feastRule = parseRule(r.feastText);
    const durationDays = deriveDurationDays(startRule, feastRule);

    return {
      id: toSnakeCaseId(r.title),
      title: r.title,
      startRule,
      feastRule,
      durationDays,
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

  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "novenas_index.json");
  safeAtomicWrite(outPath, JSON.stringify(entries, null, 2));

  console.log("Wrote:", outPath);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
