#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const [stateDirArg, siteDirArg, status, timestamp, reason = "", beforeDataPath = ""] = process.argv.slice(2);
if (!stateDirArg || !siteDirArg || !status || !timestamp) {
  throw new Error("usage: write-research-history.mjs <state-dir> <site-dir> <status> <timestamp> [reason] [before-data]");
}

const stateDir = path.resolve(stateDirArg);
const siteDir = path.resolve(siteDirArg);
const historyPath = path.join(stateDir, "research-history.log");

function clean(value) {
  return String(value ?? "")
    .replace(/[|\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadData(filename) {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  const data = context.window.QM_DATA;
  if (!data || !Array.isArray(data.results)) throw new Error(`invalid site data in ${filename}`);
  return data;
}

function resultMap(data) {
  return new Map(data.results.map((result) => [result.id, result]));
}

function formatNew(results) {
  if (!results.length) return "none";
  return results
    .map((result) => `${clean(result.id)}:${clean(result.title)}`)
    .join("; ");
}

let line;
if (status === "success") {
  if (!beforeDataPath || !fs.existsSync(beforeDataPath)) {
    throw new Error("success history entry requires a before-data snapshot");
  }
  const before = loadData(path.resolve(beforeDataPath));
  const after = loadData(path.join(siteDir, "data.js"));
  const beforeMap = resultMap(before);
  const afterMap = resultMap(after);
  const added = after.results.filter((result) => !beforeMap.has(result.id));
  const changed = after.results.filter((result) => {
    const previous = beforeMap.get(result.id);
    return previous && JSON.stringify(previous) !== JSON.stringify(result);
  });
  const removed = before.results.filter((result) => !afterMap.has(result.id));
  const plotted = after.results.filter((result) => Number.isFinite(result.storageTimeS) &&
    result.storageTimeS > 0 && Number.isFinite(result.efficiencyPct) && result.efficiencyPct > 0);
  line = `${timestamp} | success | new=${added.length ? `${added.length} [${formatNew(added)}]` : "none"} | changed=${changed.length} | removed=${removed.length} | total=${after.results.length} | plotted=${plotted.length}${reason ? ` | ${clean(reason)}` : ""}`;
} else {
  line = `${timestamp} | ${clean(status)}${reason ? ` | ${clean(reason)}` : ""}`;
}

fs.mkdirSync(stateDir, { recursive: true });
fs.appendFileSync(historyPath, `${line}\n`, "utf8");
console.log(line);
