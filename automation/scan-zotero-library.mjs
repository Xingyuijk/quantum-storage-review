#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const stateDir = path.resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("usage: scan-zotero-library.mjs <automation-state-dir>");

const zoteroDir = path.join(stateDir, "zotero");
const pendingPath = path.join(zoteroDir, "current-snapshot.json");
const deltaPath = path.join(zoteroDir, "current-delta.json");
const baselineFilename = process.env.QUANTUM_ZOTERO_BASELINE_FILENAME || "last-success-snapshot.json";
const baselinePath = path.join(zoteroDir, baselineFilename);
const pageSize = 100;
const baseUrl = "http://127.0.0.1:23119/api/users/0/items/top";
const headers = {
  "Zotero-Allowed-Request": "true",
  "Zotero-API-Version": "3",
};

const relevancePattern = new RegExp([
  "quantum memor", "optical memor", "photon storage", "light storage",
  "quantum storage", "photon echo", "atomic frequency comb", "spin-wave",
  "rare-earth", "rare earth", "erbium", "europium", "praseodymium",
  "ytterbium", "thulium", "neodymium", "y2sio5", "linbo3", "zefoz",
  "noiseless photon echo", "gradient echo memory", "rephasing efficiency",
].join("|"), "i");

function atomicWrite(filename, value) {
  const temporary = `${filename}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, filename);
}

function searchableText(item) {
  const data = item?.data || {};
  return [
    data.title, data.abstractNote, data.publicationTitle, data.proceedingsTitle,
    data.DOI, data.url, ...(data.tags || []).map((tag) => tag.tag),
    ...(data.creators || []).flatMap((creator) => [creator.firstName, creator.lastName, creator.name]),
  ].filter(Boolean).join(" ");
}

fs.mkdirSync(zoteroDir, { recursive: true });

const items = [];
let start = 0;
let totalResults = null;
let libraryVersion = null;

while (totalResults === null || start < totalResults) {
  const url = new URL(baseUrl);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(pageSize));
  url.searchParams.set("start", String(start));
  url.searchParams.set("sort", "dateModified");
  url.searchParams.set("direction", "asc");

  let response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  } catch (error) {
    throw new Error(`Zotero Desktop local API is unavailable: ${error.message}`);
  }
  if (!response.ok) throw new Error(`Zotero local API returned HTTP ${response.status}`);

  const page = await response.json();
  if (!Array.isArray(page)) throw new Error("Zotero local API returned a non-array item page");
  if (totalResults === null) {
    totalResults = Number(response.headers.get("total-results"));
    libraryVersion = Number(response.headers.get("last-modified-version"));
    if (!Number.isInteger(totalResults) || totalResults < 0) {
      throw new Error("Zotero response omitted a valid Total-Results header");
    }
    if (!Number.isInteger(libraryVersion) || libraryVersion < 0) {
      throw new Error("Zotero response omitted a valid Last-Modified-Version header");
    }
  } else if (Number(response.headers.get("last-modified-version")) !== libraryVersion) {
    throw new Error("Zotero library changed during pagination; retry the full scan");
  }
  items.push(...page);
  start += page.length;
  if (page.length === 0 && start < totalResults) throw new Error("Zotero pagination ended early");
}

if (items.length !== totalResults) {
  throw new Error(`Zotero full scan incomplete: expected ${totalResults}, received ${items.length}`);
}
if (new Set(items.map((item) => item.key)).size !== items.length) {
  throw new Error("Zotero full scan returned duplicate item keys; retry the full scan");
}

const snapshot = {
  schemaVersion: 1,
  scannedAt: new Date().toISOString(),
  libraryVersion,
  totalTopLevelItems: items.length,
  relevantItemKeys: items.filter((item) => relevancePattern.test(searchableText(item))).map((item) => item.key),
  items,
};

let baseline = null;
if (fs.existsSync(baselinePath)) baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const oldByKey = new Map((baseline?.items || []).map((item) => [item.key, item]));
const newByKey = new Map(items.map((item) => [item.key, item]));
const addedKeys = items.filter((item) => !oldByKey.has(item.key)).map((item) => item.key);
const modifiedKeys = items
  .filter((item) => oldByKey.has(item.key) && item.version !== oldByKey.get(item.key).version)
  .map((item) => item.key);
const removedKeys = [...oldByKey.keys()].filter((key) => !newByKey.has(key));
const unseenRelevantKeys = baseline
  ? [...new Set([...addedKeys, ...modifiedKeys])].filter((key) => {
      const item = newByKey.get(key);
      return item && relevancePattern.test(searchableText(item));
    })
  : snapshot.relevantItemKeys;

const delta = {
  schemaVersion: 1,
  scannedAt: snapshot.scannedAt,
  baselineAvailable: Boolean(baseline),
  baselineLibraryVersion: baseline?.libraryVersion ?? null,
  currentLibraryVersion: libraryVersion,
  fullScanCompleted: true,
  addedKeys,
  modifiedKeys,
  removedKeys,
  unseenRelevantKeys,
  note: baseline
    ? "Review unseenRelevantKeys first, then search the complete snapshot for scope-relevant items."
    : "No successful baseline exists; review every relevantItemKey so earlier unscanned Zotero content is recovered.",
};

atomicWrite(pendingPath, snapshot);
atomicWrite(deltaPath, delta);
console.log(`ZOTERO SCAN OK: ${items.length} top-level items, ${snapshot.relevantItemKeys.length} relevance hits, ${unseenRelevantKeys.length} unseen/modified relevance hits`);
