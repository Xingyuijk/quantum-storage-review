#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const [stateDirArg, siteDirArg] = process.argv.slice(2);
if (!stateDirArg || !siteDirArg) {
  throw new Error("usage: build-triage-report.mjs <automation-state-dir> <site-dir>");
}

const stateDir = path.resolve(stateDirArg);
const siteDir = path.resolve(siteDirArg);
const snapshotPath = path.join(stateDir, "zotero", "current-snapshot.json");
const deltaPath = path.join(stateDir, "zotero", "current-delta.json");
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const delta = JSON.parse(fs.readFileSync(deltaPath, "utf8"));

function loadSiteData() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(siteDir, "data.js"), "utf8"), context);
  return context.window.QM_DATA;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/doi\.org\//g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const data = loadSiteData();
const results = Array.isArray(data?.results) ? data.results : [];
const byDoi = new Map(results.filter((item) => item.doi).map((item) => [normalize(item.doi), item.id]));
const byTitle = new Map(results.map((item) => [normalize(item.title), item.id]));
const itemsByKey = new Map((snapshot.items || []).map((item) => [item.key, item]));
const reviewedKeys = [...new Set(delta.unseenRelevantKeys || [])];
const candidates = reviewedKeys.map((key) => {
  const item = itemsByKey.get(key);
  const meta = item?.data || {};
  const doiMatch = meta.DOI ? byDoi.get(normalize(meta.DOI)) : null;
  const titleMatch = meta.title ? byTitle.get(normalize(meta.title)) : null;
  return {
    key,
    title: meta.title || "(untitled)",
    year: meta.date || meta.dateAdded || "",
    doi: meta.DOI || "",
    authors: (meta.creators || [])
      .map((creator) => creator.name || [creator.firstName, creator.lastName].filter(Boolean).join(" "))
      .filter(Boolean)
      .slice(0, 3)
      .join(", "),
    attachmentHint: Number(item?.meta?.numChildren || 0) > 0 ? "child/attachment metadata present" : "no child/attachment metadata",
    siteMatch: doiMatch || titleMatch || "new/pending full-text review",
  };
});

const lines = [
  "## Local Zotero triage",
  "",
  `- Library version: ${snapshot.libraryVersion}`,
  `- Top-level items: ${snapshot.totalTopLevelItems}`,
  `- Heuristic relevance hits: ${(snapshot.relevantItemKeys || []).length}`,
  `- Unseen/modified relevance keys: ${reviewedKeys.length}`,
  "- Attachment full text inspected: no (deferred to manual Codex CLI review)",
  "- Website files changed: no",
  "",
  "The table below is metadata triage only. No candidate is publication-ready until a manually reviewed Codex CLI session inspects the original full text and pairs storage time with efficiency under the same conditions.",
  "",
  "| Zotero key | Title | DOI | Site match | Attachment hint |",
  "| --- | --- | --- | --- | --- |",
];

for (const candidate of candidates) {
  const cell = (value) => String(value || "").replaceAll("|", "\\|").replaceAll("\n", " ");
  lines.push(`| ${cell(candidate.key)} | ${cell(candidate.title)} | ${cell(candidate.doi)} | ${cell(candidate.siteMatch)} | ${cell(candidate.attachmentHint)} |`);
}

if (!candidates.length) {
  lines.push("No unseen or modified relevance keys were reported by the current Zotero delta.");
}

console.log(lines.join("\n"));

