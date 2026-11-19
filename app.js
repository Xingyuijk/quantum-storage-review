const payload = window.QM_DATA;
const allResults = payload.results;
const { canPlot, protocolGroup, implementationGroup, cavityGroup } = window.QMRecords;
const plottedResults = allResults.filter(canPlot);
const authorIndex = window.QM_AUTHOR_INDEX || {};
const matchesSearch = window.QMRecords.createSearch(allResults, authorIndex);
const sourceIndex = window.QM_SOURCE_LOCATIONS || {};
const conditionIndex = window.QM_EXPERIMENTAL_CONDITIONS || {};

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

const ER_PROTOCOL_COLORS = {
  "Two-level AFC": "#1b6d77",
  "Spin-wave AFC": "#a85f2a",
  "Stark/on-demand AFC": "#6d5aa8",
  CRIB: "#2f6f8f",
  "4-level RASE": "#7a5b2e",
  "Material coherence": "#6d7378"
};

const ER_PROTOCOL_ORDER = ["Two-level AFC", "Spin-wave AFC", "Stark/on-demand AFC", "CRIB", "4-level RASE", "Material coherence"];
const ER_HOST_ORDER = ["Y2SiO5", "LiNbO3", "Silica fiber", "TiO2 / SiN"];
const ER_HOST_MARKERS = {
  Y2SiO5: "diamond",
  LiNbO3: "square",
  "Silica fiber": "circle",
  "TiO2 / SiN": "triangle-up"
};

const PROTOCOL_ORDER = ["AFC", "NLPE", "GEM", "EIT", "CRIB", "4-level RASE", "material coherence"];
const IMPLEMENTATION_ORDER = ["bulk", "chip"];
const CAVITY_ORDER = ["fiber microcavity", "bulk cavity", "multi-pass", "nanobeam cavity", "on-chip resonator", "waveguide cavity", "no cavity"];

const state = {
  selectedId: plottedResults[0]?.id || "",
  search: "",
  yScale: "log",
  recentOnly: false,
  erFocus: false,
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
const matchCount = document.getElementById("matchCount");
const tableOnlyCount = document.getElementById("tableOnlyCount");
const chartTitle = document.getElementById("chartTitle");
const chartDescription = document.getElementById("chartDescription");
const readingMapText = document.getElementById("readingMapText");

const mobileLayout = window.matchMedia("(max-width: 800px)");
let W = 1020;
let H = 600;
const margin = { top: 34, right: 28, bottom: 70, left: 76 };
let plotW = W - margin.left - margin.right;
let plotH = H - margin.top - margin.bottom;

function fitChartToScreen() {
  const narrow = mobileLayout.matches;
  const width = narrow ? svg.parentElement.clientWidth : 1020;
  const height = narrow ? svg.parentElement.clientHeight : 600;
  if (width === W && height === H) return;
  W = width;
  H = height;
  Object.assign(margin, narrow
    ? { top: 22, right: 20, bottom: 48, left: 56 }
    : { top: 34, right: 28, bottom: 70, left: 76 });
  plotW = W - margin.left - margin.right;
  plotH = H - margin.top - margin.bottom;
  render();
}
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

function erProtocolClass(d) {
  const protocol = String(d.protocol || "");
  const normalized = protocol.toLowerCase();
  if (normalized.includes("spin-wave") || normalized.includes("zefoz")) return "Spin-wave AFC";
  if (normalized.includes("stark") || normalized.includes("on-demand") || normalized.includes("feed-forward")) return "Stark/on-demand AFC";
  if (protocol === "AFC" || protocol === "SMAFC") return "Two-level AFC";
  if (protocol === "CRIB") return "CRIB";
  if (protocol === "4-level RASE") return "4-level RASE";
  if (protocol === "material coherence") return "Material coherence";
  return protocol || "Other";
}

function erHostGroup(d) {
  const value = String(d.host || "").toLowerCase();
  if (value.includes("y2sio5")) return "Y2SiO5";
  if (value.includes("linbo3")) return "LiNbO3";
  if (value.includes("fiber") || value.includes("fibre") || value.includes("silica")) return "Silica fiber";
  if (value.includes("tio2") || value.includes("sin")) return "TiO2 / SiN";
  return d.host || "Other host";
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

function chartProtocolLabel(d) {
  if (!state.erFocus) return protocolLabel(d);
  const group = erProtocolClass(d);
  return group === d.protocol ? group : `${group} (${d.protocol})`;
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
  if (state.erFocus) return ER_PROTOCOL_COLORS[erProtocolClass(d)] || "#596067";
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

function conditionMeta(d) {
  return conditionIndex[d.id] || {};
}

function markerShape(d) {
  if (state.erFocus) return ER_HOST_MARKERS[erHostGroup(d)] || "hexagon";
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

function passesFilters(d) {
  if (state.erFocus && d.ion !== "Er3+") return false;
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
    button.setAttribute("aria-pressed", "false");
    button.textContent = value;
    button.addEventListener("click", () => {
      const set = state.filters[key];
      if (set.has(value)) set.delete(value);
      else set.add(value);
      button.setAttribute("aria-pressed", String(set.has(value)));
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
    state.erFocus = false;
    Object.values(state.filters).forEach((set) => set.clear());
    document.getElementById("searchInput").value = "";
    document.querySelectorAll(".control-panel [aria-pressed]").forEach((b) => b.setAttribute("aria-pressed", "false"));
    render();
  });

  document.getElementById("recentOnly").addEventListener("click", (event) => {
    state.recentOnly = !state.recentOnly;
    event.currentTarget.setAttribute("aria-pressed", String(state.recentOnly));
    render();
  });

  document.getElementById("focusEr").addEventListener("click", (event) => {
    state.erFocus = !state.erFocus;
    state.search = "";
    state.recentOnly = false;
    Object.values(state.filters).forEach((set) => set.clear());
    document.getElementById("searchInput").value = "";
    document.querySelectorAll(".chip, #recentOnly").forEach((b) => b.setAttribute("aria-pressed", "false"));
    event.currentTarget.setAttribute("aria-pressed", String(state.erFocus));
    state.selectedId = (state.erFocus ? plottedResults.find((d) => d.ion === "Er3+") : plottedResults[0])?.id || "";
    render();
  });
}

function drawAxes() {
  h("line", { x1: margin.left, y1: margin.top + plotH, x2: margin.left + plotW, y2: margin.top + plotH, class: "axis-line" });
  h("line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotH, class: "axis-line" });

  const axisXTicks = mobileLayout.matches ? [1e-9, 1e-6, 1e-3, 1, 3600] : xTicks;
  axisXTicks.forEach((tick) => {
    const x = sx(tick);
    h("line", { x1: x, y1: margin.top, x2: x, y2: margin.top + plotH, class: "grid-line" });
    h("text", { x, y: margin.top + plotH + 24, "text-anchor": "middle", class: "tick-label", text: timeLabel(tick) });
  });

  const yTicks = state.yScale === "log" ? yLogTicks : yLinearTicks;
  const axisYTicks = mobileLayout.matches
    ? (state.yScale === "log" ? [0.01, 0.1, 1, 10, 100] : [0, 25, 50, 75, 100])
    : yTicks;
  axisYTicks.forEach((tick) => {
    const y = sy(tick);
    h("line", { x1: margin.left, y1: y, x2: margin.left + plotW, y2: y, class: "grid-line" });
    h("text", { x: margin.left - 10, y: y + 4, "text-anchor": "end", class: "tick-label", text: `${tick}%` });
  });

  h("text", { x: margin.left + plotW / 2, y: H - (mobileLayout.matches ? 7 : 18), "text-anchor": "middle", class: "axis-label", text: "Storage time (log scale)" });
  const axisLabelX = mobileLayout.matches ? 12 : 20;
  const yLabel = h("text", {
    x: axisLabelX,
    y: margin.top + plotH / 2,
    transform: `rotate(-90 ${axisLabelX} ${margin.top + plotH / 2})`,
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

function drawCategoryAnnotations(data) {
  const labelBoxes = [];
  const labeledProtocols = new Set();
  data
    .filter((d) => state.erFocus ? erProtocolClass(d) !== "Two-level AFC" : protocolGroup(d) !== "AFC")
    .forEach((d) => {
      const label = state.erFocus ? erProtocolClass(d) : protocolGroup(d);
      const color = state.erFocus ? colorFor(d) : protocolColor(label);
      const x = sx(d.storageTimeS);
      const y = sy(d.efficiencyPct);
      const offset = NON_AFC_LABEL_OFFSETS[d.id] || { dx: 14, dy: -24 };
      const labelWidth = Math.max(36, label.length * 7 + 14);
      const labelHeight = 20;
      const labelX = clamp(x + offset.dx, margin.left + 4, margin.left + plotW - labelWidth - 4);
      const labelY = clamp(y + offset.dy, margin.top + 4, margin.top + plotH - labelHeight - 4);
      const lineX = offset.dx < 0 ? labelX + labelWidth : labelX;
      const lineY = labelY + labelHeight / 2;

      h("circle", { cx: x, cy: y, r: mobileLayout.matches ? 7 : 11, class: "non-afc-ring", stroke: color });
      if (mobileLayout.matches) {
        const overlaps = labelBoxes.some((box) => labelX < box.right && labelX + labelWidth > box.left
          && labelY < box.bottom && labelY + labelHeight > box.top);
        if (overlaps || labeledProtocols.has(label)) return;
        labeledProtocols.add(label);
        labelBoxes.push({ left: labelX - 4, right: labelX + labelWidth + 4, top: labelY - 4, bottom: labelY + labelHeight + 4 });
      }
      h("line", { x1: x, y1: y, x2: lineX, y2: lineY, class: "non-afc-leader", stroke: color });
      h("rect", { x: labelX, y: labelY, width: labelWidth, height: labelHeight, rx: 5, class: "non-afc-label-bg", stroke: color });
      h("text", { x: labelX + 7, y: labelY + 14, class: "non-afc-label", text: label });
    });
}

function showTooltip(event, d) {
  tooltip.innerHTML = `<strong>${escapeHtml(d.authors)} ${d.year}</strong><br>${escapeHtml(chartProtocolLabel(d))} | ${escapeHtml(d.ion)}:${escapeHtml(d.host)}<br>${escapeHtml(d.storageTimeLabel)} · ${escapeHtml(d.efficiencyLabel)}<span class="efficiency-definition">${escapeHtml(d.efficiencyType)}</span>`;
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

const detailSheet = document.getElementById("detailSheet");
const sheetContent = document.getElementById("sheetContent");
let sheetReturnSelector = "";

function showMobileDetail(id, trigger) {
  if (!mobileLayout.matches || detailContent.hidden) return;
  const key = CSS.escape(trigger?.dataset.id || id);
  if (trigger?.matches(".point-group-badge")) sheetReturnSelector = `.point-group-badge[data-id="${key}"]`;
  else if (trigger instanceof SVGElement) sheetReturnSelector = `.point[data-id="${key}"]`;
  else sheetReturnSelector = `#resultsTable tr[data-id="${CSS.escape(id)}"] .result-ref`;
  sheetContent.append(detailContent);
  detailSheet.showModal();
  sheetContent.scrollTop = 0;
}

const filterToggle = document.getElementById("filterToggle");
filterToggle.addEventListener("click", () => {
  filterToggle.setAttribute("aria-expanded", String(filterToggle.getAttribute("aria-expanded") !== "true"));
});
document.getElementById("closeDetailSheet").addEventListener("click", () => detailSheet.close());
detailSheet.addEventListener("click", (event) => {
  if (event.target === detailSheet && event.clientY < detailSheet.getBoundingClientRect().top) detailSheet.close();
});
detailSheet.addEventListener("close", () => {
  document.getElementById("desktopDetail").append(detailContent);
  const target = document.querySelector(sheetReturnSelector) || document.getElementById("searchInput");
  if (!target.hasAttribute("tabindex") && target instanceof SVGElement) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
});
mobileLayout.addEventListener("change", () => {
  if (!mobileLayout.matches && detailSheet.open) detailSheet.close();
  fitChartToScreen();
});

function selectResult(id, trigger = document.activeElement) {
  state.selectedId = id;
  hideTooltip();
  drawPlot();
  tableBody.querySelector(".selected")?.classList.remove("selected");
  tableBody.querySelector(`tr[data-id="${CSS.escape(id)}"]`)?.classList.add("selected");
  renderDetail();
  showMobileDetail(id, trigger);
}

function toggleYScale() {
  state.yScale = state.yScale === "log" ? "linear" : "log";
  hideTooltip();
  render();
}

const groupPicker = new PlotGroupPicker(document.getElementById("groupBadges"), selectResult);
let visibleGroups = [];

function positionGroupBadges() {
  const transform = svg.getScreenCTM();
  if (!transform) return;
  const layer = groupPicker.layer.getBoundingClientRect();
  groupPicker.update(visibleGroups, (d) => {
    const point = new DOMPoint(sx(d.storageTimeS), sy(d.efficiencyPct)).matrixTransform(transform);
    return { x: point.x - layer.left, y: point.y - layer.top };
  });
}

function drawPoint(group) {
  const d = group.records.find((record) => record.id === state.selectedId) || group.records[0];
  const x = sx(d.storageTimeS);
  const y = sy(d.efficiencyPct);
  const fill = colorFor(d);
  let el;
  const radius = mobileLayout.matches ? 4.5 : 7;
  const path = markerPath(markerShape(d), x, y, radius);
  if (path) {
    el = h("path", { d: path, fill, stroke: "#fff", "stroke-width": 1.4, class: "point", "data-id": d.id });
  } else {
    el = h("circle", { cx: x, cy: y, r: radius, fill, stroke: "#fff", "stroke-width": 1.4, class: "point", "data-id": d.id });
  }
  if (d.id === state.selectedId) el.classList.add("selected");
  if (d.confidence === "low") el.setAttribute("opacity", "0.62");
  if (group.records.length === 1) el.addEventListener("mousemove", (event) => showTooltip(event, d));
  el.addEventListener("mouseleave", hideTooltip);
  el.addEventListener("click", () => {
    hideTooltip();
    if (group.records.length > 1) groupPicker.open(group.key);
    else selectResult(d.id, el);
  });
}

function legendMarkerSvg(ion) {
  const fill = ION_COLORS[ion];
  const shape = markerShape({ ion });
  const path = markerPath(shape, 8, 8, 5.4);
  if (path) return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}" fill="${fill}"></path></svg>`;
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4" fill="${fill}"></circle></svg>`;
}

function legendShapeSvg(shape, fill) {
  const path = markerPath(shape, 8, 8, 5.4);
  if (path) return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}" fill="${fill}"></path></svg>`;
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4" fill="${fill}"></circle></svg>`;
}

function appendLegendPill(container, label, shape, fill) {
  const pill = document.createElement("span");
  pill.className = "legend-pill";
  pill.innerHTML = `<span class="legend-marker">${legendShapeSvg(shape, fill)}</span>${escapeHtml(label)}`;
  container.appendChild(pill);
}

function renderLegend() {
  const container = document.getElementById("miniLegend");
  const focusContainer = document.getElementById("focusLegend");
  container.innerHTML = "";
  focusContainer.innerHTML = "";
  if (state.erFocus) {
    container.hidden = true;
    focusContainer.hidden = false;
    const erResults = allResults.filter((d) => d.ion === "Er3+");
    const plottedEr = plottedResults.filter((d) => d.ion === "Er3+");
    const protocolClasses = new Set(erResults.map(erProtocolClass));
    const hostGroups = new Set(plottedEr.map(erHostGroup));
    const protocolLabelEl = document.createElement("span");
    protocolLabelEl.className = "legend-label";
    protocolLabelEl.textContent = "Protocol";
    focusContainer.appendChild(protocolLabelEl);
    ER_PROTOCOL_ORDER.filter((value) => protocolClasses.has(value)).forEach((value) => {
      appendLegendPill(focusContainer, value, "circle", ER_PROTOCOL_COLORS[value] || "#596067");
    });
    const lineBreak = document.createElement("span");
    lineBreak.className = "legend-break";
    focusContainer.appendChild(lineBreak);
    const hostLabelEl = document.createElement("span");
    hostLabelEl.className = "legend-label";
    hostLabelEl.textContent = "Host";
    focusContainer.appendChild(hostLabelEl);
    ER_HOST_ORDER.filter((value) => hostGroups.has(value)).forEach((value) => {
      appendLegendPill(focusContainer, value, ER_HOST_MARKERS[value] || "hexagon", "#596067");
    });
    return;
  }
  container.hidden = false;
  focusContainer.hidden = true;
  Object.keys(ION_COLORS).forEach((ion) => {
    if (!allResults.some((d) => d.ion === ion)) return;
    appendLegendPill(container, ion, markerShape({ ion }), ION_COLORS[ion]);
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
  const rows = [...data];
  rows.sort((a, b) => b.year - a.year || String(a.ion).localeCompare(String(b.ion)) || Number(canPlot(b)) - Number(canPlot(a)));
  rows.forEach((d) => {
    const tr = document.createElement("tr");
    tr.dataset.id = d.id;
    if (d.id === state.selectedId) tr.classList.add("selected");
    if (!canPlot(d)) tr.classList.add("missing-row");
    tr.innerHTML = `
      <td><button type="button" class="result-ref" aria-label="${escapeHtml([d.authors, d.year, d.title, d.storageTimeLabel, d.efficiencyLabel].join(", "))}">${escapeHtml(d.authors)} ${escapeHtml(d.year)}</button>${!canPlot(d) ? '<small class="table-only-label">Table only</small>' : ""}</td>
      <td>${escapeHtml(d.storageTimeLabel)}</td>
      <td><strong>${escapeHtml(d.efficiencyLabel)}</strong><span class="efficiency-definition">${escapeHtml(d.efficiencyType)}</span></td>
      <td>${escapeHtml(d.isotope || d.ion)} / ${escapeHtml(d.host)}</td>
      <td>${escapeHtml(state.erFocus ? erProtocolClass(d) : protocolGroup(d))}</td>
      <td>${escapeHtml(cavityGroup(d))}</td>
    `;
    tr.addEventListener("click", () => selectResult(d.id, tr));
    tableBody.appendChild(tr);
  });
}

function renderDetail() {
  const d = allResults.find((item) => item.id === state.selectedId);
  if (!d) {
    detailContent.replaceChildren();
    detailContent.hidden = true;
    emptyDetail.hidden = false;
    return;
  }
  const meta = authorMeta(d);
  const source = sourceMeta(d);
  const conditions = conditionMeta(d);
  const fullAuthors = meta.authorsFull || d.authorsFull || d.authors;
  const tags = [
    state.erFocus ? `host platform: ${erHostGroup(d)}` : "",
    implementationGroup(d),
    implementationGroup(d) !== d.architecture ? `implementation detail: ${d.architecture}` : "",
    cavityGroup(d),
    cavityGroup(d) !== d.cavity ? `cavity detail: ${d.cavity}` : "",
    (state.erFocus ? erProtocolClass(d) : protocolGroup(d)) !== d.protocol ? `protocol detail: ${d.protocol}` : "",
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
      <div class="metric"><span>${canPlot(d) ? "Storage time" : "Reported time"}</span><strong>${escapeHtml(d.storageTimeLabel)}</strong></div>
      <div class="metric"><span>Efficiency</span><strong>${escapeHtml(d.efficiencyLabel)}</strong><small class="efficiency-definition">${escapeHtml(d.efficiencyType)}</small></div>
      <div class="metric"><span>Working temperature</span><strong>${escapeHtml(conditions.temperature || "Not verified")}</strong></div>
      <div class="metric"><span>Magnetic field</span><strong>${escapeHtml(conditions.magneticField || "Not verified")}</strong></div>
      <div class="metric"><span>Ion / host</span><strong>${escapeHtml(d.isotope || d.ion)} / ${escapeHtml(d.host)}</strong></div>
      <div class="metric"><span>Protocol</span><strong>${escapeHtml(state.erFocus ? erProtocolClass(d) : protocolGroup(d))}</strong></div>
    </div>
    <div class="tag-row">
      ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
    </div>
    <p class="detail-note">${escapeHtml(d.note)}</p>
    ${conditions.conditionNote ? `<p class="detail-note"><strong>Condition pairing:</strong> ${escapeHtml(conditions.conditionNote)}</p>` : ""}
    <div class="link-list">
      <span>Authors: ${escapeHtml(fullAuthors)}</span>
      <a href="${escapeHtml(d.url)}" target="_blank" rel="noreferrer">Open DOI / source page</a>
      <span>DOI: ${escapeHtml(d.doi || "n/a")}</span>
      <span>Zotero key: ${escapeHtml(d.zoteroKey || "not in local library yet")}</span>
      ${source.locator ? `<span><strong>Storage time / efficiency source:</strong> ${escapeHtml(source.locator)}</span>` : ""}
      ${source.extractionMethod ? `<span><strong>Performance extraction:</strong> ${escapeHtml(source.extractionMethod)}</span>` : ""}
      ${source.verifiedDate ? `<span><strong>Performance verified:</strong> ${escapeHtml(source.verifiedDate)}</span>` : ""}
      ${conditions.locator ? `<span><strong>Experimental-condition source:</strong> ${escapeHtml(conditions.locator)}</span>` : ""}
      ${conditions.extractionMethod ? `<span><strong>Condition extraction:</strong> ${escapeHtml(conditions.extractionMethod)}</span>` : ""}
      ${conditions.verifiedDate ? `<span><strong>Conditions verified:</strong> ${escapeHtml(conditions.verifiedDate)}</span>` : ""}
    </div>
  `;
  window.QMPaperReading.addToDetail(detailContent, d);
}

function render() {
  hideTooltip();
  const filteredAll = allResults.filter(passesFilters);
  const visible = filteredAll.filter(canPlot);
  if (!filteredAll.some((d) => d.id === state.selectedId)) {
    state.selectedId = visible[0]?.id || filteredAll[0]?.id || "";
  }
  matchCount.textContent = filteredAll.length;
  visibleCount.textContent = visible.length;
  tableOnlyCount.textContent = filteredAll.length - visible.length;
  const activeCount = Object.values(state.filters).reduce((n, values) => n + values.size, 0)
    + Number(state.erFocus) + Number(state.recentOnly);
  filterToggle.textContent = activeCount ? `Filters (${activeCount})` : "Filters";

  chartTitle.textContent = state.erFocus ? "Er3+ quantum-memory subview" : "Storage time vs efficiency";
  chartDescription.textContent = state.erFocus
    ? "All erbium hosts and protocols in the dataset. Color encodes protocol class; marker shape encodes host platform."
    : "Click any point or table row to open the paper details and source note.";
  if (!visible.length) {
    chartDescription.textContent = filteredAll.length
      ? "The matching records have no paired storage time and efficiency to plot. See the results table below."
      : "No matching records. Try another search or clear your filters.";
  }
  readingMapText.textContent = state.erFocus
    ? "Er3+ focus: color separates two-level AFC, spin-wave AFC, Stark/on-demand control, photon-echo variants, and material coherence; marker shape separates host platforms."
    : "Color and marker shape both encode ion species. Non-AFC points are labeled directly on the chart.";
  svg.setAttribute("aria-label", state.erFocus
    ? "Erbium quantum-memory map with protocol-class colors and host-platform marker shapes"
    : "Log-log map of storage time and efficiency");

  visibleGroups = groupPlotResults(visible);
  drawPlot();
  renderLegend();
  renderTable(filteredAll);
  renderDetail();
}

function drawPlot() {
  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  drawAxes();
  visibleGroups.forEach(drawPoint);
  positionGroupBadges();
  drawCategoryAnnotations(visibleGroups.flatMap((group) => group.records).filter((d) => d.confidence !== "low"));
}

initFilters();
const linkedResultId = new URLSearchParams(window.location.search).get("result");
if (linkedResultId && allResults.some((d) => d.id === linkedResultId)) {
  state.search = linkedResultId;
  state.selectedId = linkedResultId;
  document.getElementById("searchInput").value = linkedResultId;
}
renderReviews();
window.QMPaperReading.addIndex(document.getElementById("paperReadingIndex"));
render();
new ResizeObserver(fitChartToScreen).observe(svg.parentElement);
new ResizeObserver(positionGroupBadges).observe(svg);
if (linkedResultId && linkedResultId === state.selectedId) showMobileDetail(linkedResultId);
