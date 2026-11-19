import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = {};
await import("../data.js");
await import("../author-index.js");
await import("../result-search.js");

const data = window.QM_DATA.results;
const matches = window.QMRecords.createSearch(data, window.QM_AUTHOR_INDEX);
const idsFor = (query) => data.filter((record) => matches(record, query)).map((record) => record.id);

test("compact author and year retrieve each measurement found with a space", () => {
  for (const [compact, spaced] of [
    ["meng2026", "Meng 2026"], ["MENG２０２６", "Meng 2026"],
    ["Jobez2014", "Jobez 2014"], ["He Qian2026", "He Qian 2026"]
  ]) {
    const expected = idsFor(spaced);
    assert.ok(expected.length > 0, spaced);
    assert.deepEqual(idsFor(compact), expected, compact);
  }
  const mengPaper = idsFor("10.1038/s41566-026-01845-y");
  assert.ok(mengPaper.includes("meng-2026-wgc"));
  assert.deepEqual(idsFor("Meng2026 10.1038/s41566-026-01845-y"), mengPaper);
});

test("a compact citation requires a whole author token and the publication year", () => {
  const records = [
    { id: "coauthor", year: 2026, title: "Optical memory", authors: "Meng et al." },
    { id: "older", year: 2025, authors: "Tang et al." },
    { id: "title", year: 2026, title: "Entanglement storage", authors: "Liang et al." }
  ];
  const search = window.QMRecords.createSearch(records, { coauthor: { authorsFull: "Ruo-Yin Meng, Zhong-Yang Tang" } });
  assert.deepEqual(records.filter((r) => search(r, "Tang2026")).map((r) => r.id), ["coauthor"]);
  assert.ok(records.every((r) => !search(r, "Lian2026")));
});

test("identifiers and material formulas keep their meaning", () => {
  assert.deepEqual(idsFor("meng-2026-fbc-weak"), ["meng-2026-fbc-weak"]);
  // The DOI contains 2014, while the paper was published in 2015.
  const doi = "10.1038/nphoton.2014.311";
  const expected = data.filter((d) => d.doi === doi).map((d) => d.id);
  assert.ok(expected.length > 0);
  assert.deepEqual(idsFor("https://doi.org/" + doi), expected);
  for (const [alias, formula] of [["YSO", "Y2SiO5"], ["LN", "LiNbO3"]]) {
    const results = idsFor(formula);
    const aliasResults = new Set(idsFor(alias));
    assert.ok(results.length > 0);
    assert.ok(results.every((id) => aliasResults.has(id)));
  }
});
