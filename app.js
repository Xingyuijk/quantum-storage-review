const payload = window.QM_DATA;
const allResults = payload.results;
const plottedResults = allResults.filter((d) => Number.isFinite(d.storageTimeS) && Number.isFinite(d.efficiencyPct) && d.efficiencyPct > 0);
const authorIndex = window.QM_AUTHOR_INDEX || {};
const sourceIndex = window.QM_SOURCE_LOCATIONS || {};

const ION_COLORS = {
  "Eu3+": "#1b6d77",
  "Pr3+": "#a85f2a",
  "Er3+": "#6d5aa8",
  "Yb3+": "#2d7c4b",
  "Tm3+": "#b34a6f",
  "Nd3+": "#6d7378"
};

const ION_MARKERS = {
  "Eu3+": "circle",
  "Pr3+": "square",
  "Er3+": "diamond",
  "Yb3+": "triangle-up",
  "Tm3+": "triangle-down",
  "Nd3+": "hexagon"
};

const PROTOCOL_COLORS = {
  AFC: "#1b6d77",
  NLPE: "#b34a6f",
  CRIB: "#2f6f8f",
  GEM: "#2d7c4b",
  EIT: "#4f6f31",
  "4-level RASE": "#7a5b2e",
  "material coherence": "#6d7378"
};

const PROTOCOL_ORDER = ["AFC", "NLPE", "GEM", "EIT", "CRIB", "4-level RASE", "material coherence"];
const IMPLEMENTATION_ORDER = ["bulk", "chip"];
const CAVITY_ORDER = ["fiber microcavity", "bulk cavity", "multi-pass", "nanobeam cavity", "on-chip resonator", "waveguide cavity", "no cavity"];

const state = {
  selectedId: plottedResults[0]?.id || "",
  search: "",
  yScale: "log",
  recentOnly: false,
  filters: {
    protocol: new Set(),
    ion: new Set(),
    architecture: new Set(),
    cavity: new Set()
  }
};

const svg = document.getElementById("memorySvg");
const tooltip = document.getElementById("tooltip");
const tableBody = document.getElementById("resultsTable");
const detailContent = document.getElementById("detailContent");
const emptyDetail = document.getElementById("emptyDetail");
const visibleCount = document.getElementById("visibleCount");
const totalCount = document.getElementById("totalCount");

const W = 1020;
const H = 600;
const margin = { top: 34, right: 28, bottom: 70, left: 76 };
const plotW = W - margin.left - margin.right;
const plotH = H - margin.top - margin.bottom;
const xMin = 1e-9;
const xMax = 4000;
const yMin = 0.01;
const yLinearMin = 0;
const yMax = 100;
const xTicks = [1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1, 10, 60, 600, 3600];
const yLogTicks = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 50, 80, 100];
const yLinearTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const NON_AFC_LABEL_OFFSETS = {
  "hedges-2010-gem": { dx: -58, dy: -28 },
  "stuart-2025-four-level-rase": { dx: 16, dy: -30 },
  "liu-2025-ms-integrated": { dx: 18, dy: -28 },
  "lauritzen-2010-er-crib": { dx: 16, dy: 20 },
  "schraft-2016-pr-eit-high-eff": { dx: 16, dy: -30 },
  "jin-2022-faithful-nlpe-pol": { dx: 18, dy: 22 },
  "zhu-2024-integrated-nlpe": { dx: -58, dy: -28 },
  "hain-2022-pr-eit-10s": { dx: -48, dy: -28 }
};

function logMap(value, min, max) {
  return (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
}

function sx(value) {
  return margin.left + logMap(value, xMin, xMax) * plotW;
}

function sy(value) {
  if (state.yScale === "linear") {
    return margin.top + (1 - ((value - yLinearMin) / (yMax - yLinearMin))) * plotH;
  }
  return margin.top + (1 - logMap(value, yMin, yMax)) * plotH;
}

function h(tag, attrs = {}, parent = svg) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "text") el.textContent = value;
    else if (value !== undefined && value !== null) el.setAttribute(key, value);
  });
  parent.appendChild(el);
  return el;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uniq(key) {
  return [...new Set(allResults.map((d) => d[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function protocolGroup(d) {
  if (["AFC", "spin-wave AFC", "ZEFOZ spin-wave AFC", "AFC / feed-forward", "AFC / Stark control", "on-demand AFC", "SMAFC"].includes(d.protocol)) return "AFC";
  if (d.protocol === "NLPE / spin-wave") return "NLPE";
  return d.protocol || "other";
}

function implementationGroup(d) {
  return ["integrated chip", "integrated membrane", "integrated waveguide", "nanophotonic resonator", "nanophotonic waveguide"].includes(d.architecture) ? "chip" : "bulk";
}

function cavityGroup(d) {
  const value = String(d.cavity || "").toLowerCase();
  if (value === "no cavity") return "no cavity";
  if (value.includes("fiber microcavity")) return "fiber microcavity";
  if (value.includes("impedance-matched")) return "bulk cavity";
  if (value.includes("multi-pass")) return "multi-pass";
  if (value.includes("nanobeam") || value.includes("nanocavity")) return "nanobeam cavity";
  if (value.includes("on-chip")) return "on-chip resonator";
  if (value.includes("waveguide cavity")) return "waveguide cavity";
  return d.cavity || "other";
}

function filterValue(d, key) {
  if (key === "protocol") return protocolGroup(d);
  if (key === "architecture") return implementationGroup(d);
  if (key === "cavity") return cavityGroup(d);
  return d[key] || "";
}

function orderedFilterValues(order, mapper) {
  const present = new Set(allResults.map(mapper).filter(Boolean));
  return order.filter((value) => present.has(value)).concat([...present].filter((value) => !order.includes(value)).sort());
}

function protocolLabel(d) {
  const group = protocolGroup(d);
  return group === d.protocol ? group : `${group} (${d.protocol})`;
}

function normalizeSearch(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function timeLabel(value) {
  const fmt = (n) => Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, "");
  if (value < 1e-6) return `${fmt(value * 1e9)} ns`;
  if (value < 1e-3) return `${fmt(value * 1e6)} us`;
  if (value < 1) return `${fmt(value * 1e3)} ms`;
  if (value < 60) return `${fmt(value)} s`;
  if (value < 3600) return `${fmt(value / 60)} min`;
  return `${fmt(value / 3600)} h`;
}

function colorFor(d) {
  return ION_COLORS[d.ion] || "#596067";
}

function protocolColor(protocol) {
  return PROTOCOL_COLORS[protocol] || "#596067";
}

function authorMeta(d) {
  return authorIndex[d.id] || {};
}

function sourceMeta(d) {
  return sourceIndex[d.id] || {};
}

function authorSearchText(d) {
  const meta = authorMeta(d);
  return normalizeSearch([d.authors, d.authorsFull, d.searchTerms, meta.authorsFull, meta.searchTerms].join(" "));
}

function hostAliases(d) {
  const text = normalizeSearch([d.host, d.title, d.note].join(" "));
  const aliases = [];
  if (text.includes("y2sio5")) aliases.push("YSO yttrium orthosilicate Y2SiO5");
  if (text.includes("linbo3") || text.includes("lithium niobate")) aliases.push("LN LiNbO3 lithium niobate");
  return aliases.join(" ");
}

function generalSearchText(d) {
  return normalizeSearch([d.title, d.year, d.venue, d.ion, d.isotope, d.host, hostAliases(d), protocolGroup(d), d.protocol, implementationGroup(d), d.architecture, cavityGroup(d), d.cavity, d.inputState, d.note].join(" "));
}

function hasToken(text, token) {
  return text.split(/\s+/).includes(token);
}

function hasPhrase(text, phrase) {
  const needle = normalizeSearch(phrase);
  return Boolean(needle) && ` ${text} `.includes(` ${needle} `);
}

function hasCompactToken(text, token) {
  return token.length >= 4 && text.replace(/\s+/g, "").includes(token);
}

function markerShape(d) {
  return ION_MARKERS[d.ion] || "circle";
}

function markerPath(shape, x, y, r = 7) {
  if (shape === "square") {
    return `M ${x - r} ${y - r} H ${x + r} V ${y + r} H ${x - r} Z`;
  }
  if (shape === "diamond") {
    return `M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`;
  }
  if (shape === "triangle-up") {
    return `M ${x} ${y - r} L ${x + r * 0.95} ${y + r * 0.72} L ${x - r * 0.95} ${y + r * 0.72} Z`;
  }
  if (shape === "triangle-down") {
    return `M ${x} ${y + r} L ${x + r * 0.95} ${y - r * 0.72} L ${x - r * 0.95} ${y - r * 0.72} Z`;
  }
  if (shape === "hexagon") {
    return `M ${x - r * 0.86} ${y - r * 0.5} L ${x} ${y - r} L ${x + r * 0.86} ${y - r * 0.5} L ${x + r * 0.86} ${y + r * 0.5} L ${x} ${y + r} L ${x - r * 0.86} ${y + r * 0.5} Z`;
  }
  return "";
}

function matchesSearch(d, query) {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;

  const authorText = authorSearchText(d);
  const generalText = generalSearchText(d);
  const combinedText = `${authorText} ${generalText}`.trim();

  if (terms.length === 1) {
    const [term] = terms;
    return hasToken(combinedText, term) || hasCompactToken(combinedText, term);
  }

  const phrase = terms.join(" ");
  const reversedPhrase = terms.length === 2 ? `${terms[1]} ${terms[0]}` : "";
  if (hasPhrase(authorText, phrase) || (reversedPhrase && hasPhrase(authorText, reversedPhrase))) return true;
  if (hasPhrase(generalText, phrase)) return true;
  return terms.every((term) => hasToken(generalText, term) || hasCompactToken(generalText, term));
}

function passesFilters(d) {
  if (state.recentOnly && d.year < 2024) return false;
  if (!matchesSearch(d, state.search)) return false;
  return Object.entries(state.filters).every(([key, values]) => {
    if (!values.size) return true;
    return values.has(filterValue(d, key));
  });
}

function buildFilter(containerId, key, values) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = value;
    button.addEventListener("click", () => {
      const set = state.filters[key];
      if (set.has(value)) set.delete(value);
      else set.add(value);
      button.classList.toggle("active", set.has(value));
      render();
    });
    container.appendChild(button);
  });
}

function initFilters() {
  buildFilter("protocolFilters", "protocol", orderedFilterValues(PROTOCOL_ORDER, protocolGroup));
  buildFilter("ionFilters", "ion", uniq("ion"));
  buildFilter("architectureFilters", "architecture", orderedFilterValues(IMPLEMENTATION_ORDER, implementationGroup));
  buildFilter("cavityFilters", "cavity", orderedFilterValues(CAVITY_ORDER, cavityGroup));

  document.getElementById("searchInput").addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });

  document.getElementById("resetFilters").addEventListener("click", () => {
    state.search = "";
    state.recentOnly = false;
    Object.values(state.filters).forEach((set) => set.clear());
    document.getElementById("searchInput").value = "";
    document.querySelectorAll(".chip, .button-row button").forEach((b) => b.classList.remove("active"));
    render();
  });

  document.getElementById("recentOnly").addEventListener("click", (event) => {
    state.recentOnly = !state.recentOnly;
    event.currentTarget.classList.toggle("active", state.recentOnly);
    render();
  });
}

function drawAxes() {
  h("line", { x1: margin.left, y1: margin.top + plotH, x2: margin.left + plotW, y2: margin.top + plotH, class: "axis-line" });
  h("line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotH, class: "axis-line" });

  xTicks.forEach((tick) => {
    const x = sx(tick);
    h("line", { x1: x, y1: margin.top, x2: x, y2: margin.top + plotH, class: "grid-line" });
    h("text", { x, y: margin.top + plotH + 24, "text-anchor": "middle", class: "tick-label", text: timeLabel(tick) });
  });

  const yTicks = state.yScale === "log" ? yLogTicks : yLinearTicks;
  yTicks.forEach((tick) => {
    const y = sy(tick);
    h("line", { x1: margin.left, y1: y, x2: margin.left + plotW, y2: y, class: "grid-line" });
    h("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "tick-label", text: `${tick}%` });
  });

  h("text", { x: margin.left + plotW / 2, y: H - 18, "text-anchor": "middle", class: "axis-label", text: "Storage time (log scale)" });
  const yLabel = h("text", {
    x: 20,
    y: margin.top + plotH / 2,
    transform: `rotate(-90 20 ${margin.top + plotH / 2})`,
    "text-anchor": "middle",
    class: "axis-label axis-toggle",
    role: "button",
    tabindex: "0",
    text: `Storage efficiency (${state.yScale} scale)`
  });
  yLabel.addEventListener("click", toggleYScale);
  yLabel.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleYScale();
    }
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawNonAfcAnnotations(data) {
  data
    .filter((d) => protocolGroup(d) !== "AFC")
    .forEach((d) => {
      const label = protocolGroup(d);
      const color = protocolColor(label);
      const x = sx(d.storageTimeS);
      const y = sy(d.efficiencyPct);
      const offset = NON_AFC_LABEL_OFFSETS[d.id] || { dx: 14, dy: -24 };
      const labelWidth = Math.max(36, label.length * 7 + 14);
      const labelHeight = 20;
      const labelX = clamp(x + offset.dx, margin.left + 4, margin.left + plotW - labelWidth - 4);
      const labelY = clamp(y + offset.dy, margin.top + 4, margin.top + plotH - labelHeight - 4);
      const lineX = offset.dx < 0 ? labelX + labelWidth : labelX;
      const lineY = labelY + labelHeight / 2;

      h("circle", { cx: x, cy: y, r: 11, class: "non-afc-ring", stroke: color });
      h("line", { x1: x, y1: y, x2: lineX, y2: lineY, class: "non-afc-leader", stroke: color });
      h("rect", { x: labelX, y: labelY, width: labelWidth, height: labelHeight, rx: 5, class: "non-afc-label-bg", stroke: color });
      h("text", { x: labelX + 7, y: labelY + 14, class: "non-afc-label", text: label });
    });
}

function showTooltip(event, d) {
  tooltip.innerHTML = `<strong>${escapeHtml(d.authors)} ${d.year}</strong><br>${escapeHtml(protocolLabel(d))} | ${escapeHtml(d.ion)}:${escapeHtml(d.host)}<br>${escapeHtml(d.storageTimeLabel)} / ${escapeHtml(d.efficiencyLabel)}`;
  const box = svg.parentElement.getBoundingClientRect();
  tooltip.hidden = false;
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  let left = event.clientX - box.left + 14;
  let top = event.clientY - box.top + 14;
  if (left + width + 8 > box.width) left = event.clientX - box.left - width - 14;
  if (top + height + 8 > box.height) top = event.clientY - box.top - height - 14;
  left = Math.max(8, Math.min(left, box.width - width - 8));
  top = Math.max(8, Math.min(top, box.height - height - 8));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.hidden = false;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function selectResult(id) {
  state.selectedId = id;
  render();
}

function toggleYScale() {
  state.yScale = state.yScale === "log" ? "linear" : "log";
  hideTooltip();
  render();
}

function drawPoint(d) {
  const x = sx(d.storageTimeS);
  const y = sy(d.efficiencyPct);
  const fill = colorFor(d);
  let el;
  const path = markerPath(markerShape(d), x, y);
  if (path) {
    el = h("path", { d: path, fill, stroke: "#fff", "stroke-width": 1.4, class: "point", "data-id": d.id });
  } else {
    el = h("circle", { cx: x, cy: y, r: 7, fill, stroke: "#fff", "stroke-width": 1.4, class: "point", "data-id": d.id });
  }
  if (d.id === state.selectedId) el.classList.add("selected");
  if (d.confidence === "low") el.setAttribute("opacity", "0.62");
  el.addEventListener("mousemove", (event) => showTooltip(event, d));
  el.addEventListener("mouseleave", hideTooltip);
  el.addEventListener("click", () => selectResult(d.id));
}

function legendMarkerSvg(ion) {
  const fill = ION_COLORS[ion];
  const shape = markerShape({ ion });
  const path = markerPath(shape, 8, 8, 5.4);
  if (path) return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}" fill="${fill}"></path></svg>`;
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4" fill="${fill}"></circle></svg>`;
}

function renderLegend() {
  const container = document.getElementById("miniLegend");
  container.innerHTML = "";
  Object.keys(ION_COLORS).forEach((ion) => {
    if (!allResults.some((d) => d.ion === ion)) return;
    const pill = document.createElement("span");
    pill.className = "legend-pill";
    pill.innerHTML = `<span class="legend-marker">${legendMarkerSvg(ion)}</span>${escapeHtml(ion)}`;
    container.appendChild(pill);
  });
}

function renderReviews() {
  const container = document.getElementById("reviewList");
  if (!container) return;
  container.innerHTML = payload.reviews.map((r) => (
    `<a href="${escapeHtml(r.url)}" target="_blank" rel="noreferrer">${escapeHtml(r.authors)} ${escapeHtml(r.year)} - ${escapeHtml(r.title)}</a>`
  )).join("");
}

function renderTable(data) {
  tableBody.innerHTML = "";
  const rows = data.concat(allResults.filter((d) => !Number.isFinite(d.efficiencyPct) && passesFilters(d)));
  rows.sort((a, b) => b.year - a.year || String(a.ion).localeCompare(String(b.ion)));
  rows.forEach((d) => {
    const tr = document.createElement("tr");
    if (d.id === state.selectedId) tr.classList.add("selected");
    if (!Number.isFinite(d.efficiencyPct)) tr.classList.add("missing-row");
    tr.innerHTML = `
      <td>${escapeHtml(d.year)}</td>
      <td>${escapeHtml(d.isotope || d.ion)} / ${escapeHtml(d.host)}</td>
      <td>${escapeHtml(protocolGroup(d))}</td>
      <td>${escapeHtml(d.storageTimeLabel)}</td>
      <td>${escapeHtml(d.efficiencyLabel)}</td>
      <td>${escapeHtml(cavityGroup(d))}</td>
      <td>${escapeHtml(d.authors)}</td>
    `;
    tr.addEventListener("click", () => selectResult(d.id));
    tableBody.appendChild(tr);
  });
}

function renderDetail() {
  const d = allResults.find((item) => item.id === state.selectedId) || allResults[0];
  if (!d) return;
  const meta = authorMeta(d);
  const source = sourceMeta(d);
  const fullAuthors = meta.authorsFull || d.authorsFull || d.authors;
  const tags = [
    implementationGroup(d),
    implementationGroup(d) !== d.architecture ? `implementation detail: ${d.architecture}` : "",
    cavityGroup(d),
    cavityGroup(d) !== d.cavity ? `cavity detail: ${d.cavity}` : "",
    protocolGroup(d) !== d.protocol ? `protocol detail: ${d.protocol}` : "",
    d.inputState ? `input: ${d.inputState}` : "",
    `${d.confidence} confidence`
  ].filter(Boolean);
  emptyDetail.hidden = true;
  detailContent.hidden = false;
  detailContent.innerHTML = `
    <div class="detail-heading">
      <p class="eyebrow">${escapeHtml(d.authors)} ${escapeHtml(d.year)}</p>
      <h2>${escapeHtml(d.title)}</h2>
      <p>${escapeHtml(d.venue)}</p>
    </div>
    <div class="detail-grid">
      <div class="metric"><span>Storage time</span><strong>${escapeHtml(d.storageTimeLabel)}</strong></div>
      <div class="metric"><span>Efficiency</span><strong>${escapeHtml(d.efficiencyLabel)}</strong></div>
      <div class="metric"><span>Ion / host</span><strong>${escapeHtml(d.isotope || d.ion)} / ${escapeHtml(d.host)}</strong></div>
      <div class="metric"><span>Protocol</span><strong>${escapeHtml(protocolGroup(d))}</strong></div>
    </div>
    <div class="tag-row">
      ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
    </div>
    <p class="detail-note">${escapeHtml(d.note)}</p>
    <div class="link-list">
      <span>Authors: ${escapeHtml(fullAuthors)}</span>
      <a href="${escapeHtml(d.url)}" target="_blank" rel="noreferrer">Open DOI / source page</a>
      <span>DOI: ${escapeHtml(d.doi || "n/a")}</span>
      <span>Zotero key: ${escapeHtml(d.zoteroKey || "not in local library yet")}</span>
      <span>Efficiency definition: ${escapeHtml(d.efficiencyType)}</span>
      ${source.locator ? `<span><strong>Source location:</strong> ${escapeHtml(source.locator)}</span>` : ""}
      ${source.extractionMethod ? `<span><strong>Extraction:</strong> ${escapeHtml(source.extractionMethod)}</span>` : ""}
      ${source.verifiedDate ? `<span><strong>Verified:</strong> ${escapeHtml(source.verifiedDate)}</span>` : ""}
    </div>
  `;
}

function render() {
  hideTooltip();
  const filteredAll = allResults.filter(passesFilters);
  const visible = plottedResults.filter(passesFilters);
  if (filteredAll.length && !filteredAll.some((d) => d.id === state.selectedId)) {
    state.selectedId = visible[0]?.id || filteredAll[0].id;
  }
  totalCount.textContent = plottedResults.length;
  visibleCount.textContent = visible.length;

  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  drawAxes();
  visible.forEach(drawPoint);
  drawNonAfcAnnotations(visible.filter((d) => d.confidence !== "low"));
  renderTable(visible);
  renderDetail();
}

initFilters();
renderLegend();
renderReviews();
render();
