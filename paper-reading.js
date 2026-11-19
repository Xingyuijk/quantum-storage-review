window.QMPaperReading = (() => {
  const { results, paperReadings = {} } = window.QM_DATA;
  const sources = window.QM_SOURCE_LOCATIONS;
  const conditions = window.QM_EXPERIMENTAL_CONDITIONS;
  const papers = new Map();

  function paperKey(record) {
    return record.doi?.trim().toLowerCase() || JSON.stringify([record.title, record.year]);
  }

  for (const record of results) {
    const key = paperKey(record);
    if (!papers.has(key)) papers.set(key, []);
    papers.get(key).push(record);
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function recordLink(record, text) {
    const link = element("a", text);
    link.href = `index.html?result=${encodeURIComponent(record.id)}#resultsTable`;
    return link;
  }

  function guideSection(guide) {
    const section = element("section", "", "paper-reading");
    const source = element("a", guide.locator);
    source.href = guide.url;
    source.target = "_blank";
    source.rel = "noreferrer";
    section.append(element("h3", guide.question), element("p", guide.finding),
      element("p", guide.interpretation), source);
    return section;
  }

  function compareRecords(records, selectedId) {
    const comparison = element("details", "", "paper-comparison");
    comparison.append(element("summary", `Compare ${records.length} records from this paper`));
    const list = element("ul");
    // Show the device and protocol features that distinguish this paper's settings.
    const fields = [
      (r) => r.isotope || r.ion, (r) => r.host, (r) => r.architecture,
      (r) => r.cavity, (r) => r.protocol,
      (r) => conditions[r.id]?.temperature && `Temperature: ${conditions[r.id].temperature}`,
      (r) => conditions[r.id]?.magneticField && `Field: ${conditions[r.id].magneticField}`
    ].filter((read) => new Set(records.map(read)).size > 1);
    for (const record of records) {
      const row = element("li");
      const measure = element("div", "", "paper-measure");
      const values = `${record.storageTimeLabel} · ${record.efficiencyLabel}`;
      measure.append(element("strong", values));
      if (record.id === selectedId) {
        row.setAttribute("aria-current", "true");
        measure.append(element("small", "Selected"));
      }
      if (!window.QMRecords.canPlot(record)) measure.append(element("small", "Table only"));
      const setting = [record.inputState, ...fields.map((read) => read(record))].filter(Boolean);
      row.append(measure, element("p", record.efficiencyType), element("p", setting.join(" · "), "paper-setting"));
      const locator = sources[record.id]?.locator;
      if (locator) row.append(element("p", locator, "paper-source"));
      if (record.id !== selectedId) row.append(recordLink(record, "Open record in 2D table"));
      list.append(row);
    }
    comparison.append(list);
    return comparison;
  }

  function addToDetail(container, record) {
    const key = paperKey(record);
    const content = document.createDocumentFragment();
    if (paperReadings[key]) content.append(guideSection(paperReadings[key]));
    const rows = papers.get(key);
    if (rows.length > 1) content.append(compareRecords(rows, record.id));
    container.querySelector(".detail-heading").after(content);
  }

  function addIndex(container) {
    const list = element("ul");
    const curated = [...papers.entries()].filter(([key]) => paperReadings[key]);
    curated.sort(([, [a]], [, [b]]) => b.year - a.year || a.authors.localeCompare(b.authors));
    for (const [key, [record]] of curated) {
      const item = element("li");
      const link = recordLink(record, "");
      link.append(element("strong", `${record.authors} (${record.year})`),
        element("span", paperReadings[key].question));
      item.append(link);
      list.append(item);
    }
    if (curated.length) {
      container.append(element("summary", `Paper reading guides (${curated.length})`), list);
      container.hidden = false;
    }
  }

  return { addToDetail, addIndex };
})();
