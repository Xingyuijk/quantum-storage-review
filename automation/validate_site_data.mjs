#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const defaultSiteDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const siteDir = path.resolve(process.argv[2] || defaultSiteDir);
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function loadScript(filename) {
  const fullPath = path.join(siteDir, filename);
  if (!fs.existsSync(fullPath)) {
    fail(`missing ${filename}`);
    return;
  }
  try {
    const source = fs.readFileSync(fullPath, "utf8");
    vm.runInContext(source, context, { filename: fullPath });
  } catch (error) {
    fail(`${filename} could not be evaluated: ${error.message}`);
  }
}

const context = vm.createContext({ window: {}, console });
for (const filename of [
  "data.js",
  "author-index.js",
  "source-locations.js",
  "experimental-conditions.js",
]) {
  loadScript(filename);
}

const data = context.window.QM_DATA;
const authorIndex = context.window.QM_AUTHOR_INDEX;
const sourceLocations = context.window.QM_SOURCE_LOCATIONS;
const experimentalConditions = context.window.QM_EXPERIMENTAL_CONDITIONS;

if (!data || !Array.isArray(data.results) || !Array.isArray(data.reviews)) {
  fail("QM_DATA must contain results and reviews arrays");
}
if (!authorIndex || typeof authorIndex !== "object") fail("QM_AUTHOR_INDEX is missing");
if (!sourceLocations || typeof sourceLocations !== "object") fail("QM_SOURCE_LOCATIONS is missing");
if (!experimentalConditions || typeof experimentalConditions !== "object") {
  fail("QM_EXPERIMENTAL_CONDITIONS is missing");
}

const results = Array.isArray(data?.results) ? data.results : [];
const resultIds = results.map((result) => result?.id);
const duplicateIds = resultIds.filter((id, index) => id && resultIds.indexOf(id) !== index);
if (resultIds.some((id) => typeof id !== "string" || !id.trim())) fail("every result must have a non-empty string id");
if (duplicateIds.length) fail(`duplicate result ids: ${[...new Set(duplicateIds)].join(", ")}`);

const requiredFields = [
  "id", "title", "authors", "year", "venue", "url", "ion", "host", "protocol",
  "architecture", "cavity", "storageTimeS", "storageTimeLabel", "efficiencyPct",
  "efficiencyLabel", "efficiencyType", "confidence", "note",
];
const validConfidence = new Set(["high", "medium", "low"]);

for (const result of results) {
  const id = result?.id || "<missing-id>";
  for (const field of requiredFields) {
    if (!(field in result)) fail(`${id}: missing field ${field}`);
  }
  if (typeof result?.year !== "number" || !Number.isInteger(result.year) || result.year < 1900 || result.year > 2100) {
    fail(`${id}: year must be an integer between 1900 and 2100`);
  }
  if (typeof result?.url !== "string" || !/^https?:\/\//.test(result.url)) fail(`${id}: url must be http(s)`);
  if (result?.storageTimeS !== null &&
      (typeof result.storageTimeS !== "number" || !Number.isFinite(result.storageTimeS) || result.storageTimeS <= 0)) {
    fail(`${id}: storageTimeS must be null or a positive finite number`);
  }
  if (result?.efficiencyPct !== null &&
      (typeof result.efficiencyPct !== "number" || !Number.isFinite(result.efficiencyPct) || result.efficiencyPct < 0)) {
    fail(`${id}: efficiencyPct must be null or a finite non-negative number`);
  }
  if (!validConfidence.has(result?.confidence)) fail(`${id}: confidence must be high, medium, or low`);
  if (result?.efficiencyPct === null && typeof result?.efficiencyLabel !== "string") {
    fail(`${id}: efficiencyLabel must remain a string when efficiencyPct is null`);
  }
}

const idSet = new Set(resultIds);
function checkExactCoverage(name, mapping) {
  if (!mapping || typeof mapping !== "object") return;
  const keys = Object.keys(mapping);
  const missing = resultIds.filter((id) => !Object.prototype.hasOwnProperty.call(mapping, id));
  const extra = keys.filter((id) => !idSet.has(id));
  if (missing.length) fail(`${name}: missing ids: ${missing.join(", ")}`);
  if (extra.length) fail(`${name}: orphan ids: ${extra.join(", ")}`);
}

checkExactCoverage("QM_AUTHOR_INDEX", authorIndex);
checkExactCoverage("QM_SOURCE_LOCATIONS", sourceLocations);
checkExactCoverage("QM_EXPERIMENTAL_CONDITIONS", experimentalConditions);

for (const id of resultIds) {
  const author = authorIndex?.[id];
  if (!author || typeof author.authorsFull !== "string" || !author.authorsFull.trim() ||
      typeof author.searchTerms !== "string" || !author.searchTerms.trim()) {
    fail(`${id}: author index needs authorsFull and searchTerms`);
  }

  const source = sourceLocations?.[id];
  for (const field of ["locator", "extractionMethod", "verifiedDate"]) {
    if (!source || typeof source[field] !== "string" || !source[field].trim()) fail(`${id}: source location needs ${field}`);
  }
  if (source?.verifiedDate && !/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedDate)) {
    fail(`${id}: source verifiedDate must be YYYY-MM-DD`);
  }

  const condition = experimentalConditions?.[id];
  for (const field of ["temperature", "magneticField", "locator", "extractionMethod", "verifiedDate"]) {
    if (!condition || typeof condition[field] !== "string" || !condition[field].trim()) {
      fail(`${id}: experimental condition needs ${field}`);
    }
  }
  if (condition?.verifiedDate && !/^\d{4}-\d{2}-\d{2}$/.test(condition.verifiedDate)) {
    fail(`${id}: condition verifiedDate must be YYYY-MM-DD`);
  }
}

const plotted = results.filter((result) => Number.isFinite(result.storageTimeS) &&
  result.storageTimeS > 0 && Number.isFinite(result.efficiencyPct) && result.efficiencyPct > 0);
if (!plotted.length) warnings.push("no results are currently plottable");

if (errors.length) {
  console.error(`SITE DATA INVALID (${errors.length} error${errors.length === 1 ? "" : "s"})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`SITE DATA OK: ${results.length} results, ${plotted.length} plotted, ${data.reviews.length} reviews`);
for (const warning of warnings) console.warn(`warning: ${warning}`);
