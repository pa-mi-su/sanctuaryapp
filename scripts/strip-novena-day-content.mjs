// scripts/strip-novena-day-content.mjs
// Mode A (safe): only clears per-day content fields.
// Keeps novena metadata intact (id/title/description/rules/source/etc).
//
// Run:
//   node scripts/strip-novena-day-content.mjs data/novenas
//
// Creates a one-time .bak backup for each file before writing.

import fs from "node:fs";
import path from "node:path";

const targetDirArg = process.argv[2];
if (!targetDirArg) {
  console.error(
    "Usage: node scripts/strip-novena-day-content.mjs data/novenas",
  );
  process.exit(1);
}

const targetDir = path.resolve(process.cwd(), targetDirArg);

if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
  console.error(`❌ Not a directory: ${targetDir}`);
  process.exit(1);
}

const DAY_FIELDS_TO_CLEAR = ["title", "prayer", "scripture", "reflection"];

function stripDayFields(dayObj) {
  if (!dayObj || typeof dayObj !== "object") return dayObj;
  const out = { ...dayObj };
  for (const k of DAY_FIELDS_TO_CLEAR) {
    if (k in out) out[k] = null;
  }
  return out;
}

function processDoc(doc, filename) {
  if (!doc || typeof doc !== "object") return { doc, changed: false };

  // Most files: doc.days
  if (Array.isArray(doc.days)) {
    const before = JSON.stringify(doc.days);
    doc.days = doc.days.map(stripDayFields);
    const after = JSON.stringify(doc.days);
    return { doc, changed: before !== after };
  }

  // Fallback: if some files nest days under doc.content.days
  if (doc.content && Array.isArray(doc.content.days)) {
    const before = JSON.stringify(doc.content.days);
    doc.content.days = doc.content.days.map(stripDayFields);
    const after = JSON.stringify(doc.content.days);
    return { doc, changed: before !== after };
  }

  console.warn(`⚠️  No days array found in ${filename} (skipped)`);
  return { doc, changed: false };
}

const files = fs
  .readdirSync(targetDir)
  .filter((f) => f.endsWith(".json"))
  .sort();
let updatedCount = 0;

for (const file of files) {
  const fullPath = path.join(targetDir, file);
  const raw = fs.readFileSync(fullPath, "utf8");

  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    console.error(`❌ JSON parse failed: ${file}\n${e}`);
    process.exit(1);
  }

  const { doc: newDoc, changed } = processDoc(doc, file);
  if (!changed) continue;

  // Backup once
  const bakPath = fullPath + ".bak";
  if (!fs.existsSync(bakPath)) fs.writeFileSync(bakPath, raw, "utf8");

  fs.writeFileSync(fullPath, JSON.stringify(newDoc, null, 2) + "\n", "utf8");
  updatedCount++;
  console.log(`✅ Stripped day content: ${file}`);
}

console.log(
  `\nDone. Updated ${updatedCount} file(s). Backups saved as *.json.bak`,
);
