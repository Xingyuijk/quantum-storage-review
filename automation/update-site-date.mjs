#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [today, siteDirArg] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(today || "")) {
  throw new Error(`expected date in YYYY-MM-DD format, got ${today || "<missing>"}`);
}

const siteDir = path.resolve(siteDirArg || process.cwd());
const files = ["index.html", "3d.html"];
const datePattern = /(<time\s+id="updatedDate"\s+datetime=")\d{4}-\d{2}-\d{2}(">)\d{4}-\d{2}-\d{2}(<\/time>)/g;

for (const filename of files) {
  const fullPath = path.join(siteDir, filename);
  const source = fs.readFileSync(fullPath, "utf8");
  const matches = source.match(datePattern) || [];
  if (matches.length !== 1) {
    throw new Error(`${filename}: expected exactly one updatedDate marker, found ${matches.length}`);
  }
  const updated = source.replace(datePattern, `$1${today}$2${today}$3`);
  if (updated !== source) fs.writeFileSync(fullPath, updated, "utf8");
}

console.log(`SITE DATE UPDATED: ${today}`);
