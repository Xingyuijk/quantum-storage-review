const payload3d = window.QM_DATA;
const all3d = payload3d.results;
const author3d = window.QM_AUTHOR_INDEX || {};
const sources3d = window.QM_SOURCE_LOCATIONS || {};
const plotted3d = all3d.filter((d) => Number.isFinite(d.year) && Number.isFinite(d.storageTimeS) && d.storageTimeS > 0 && Number.isFinite(d.efficiencyPct) && d.efficiencyPct > 0);

const COLORS3D = {
  "Eu3+": "#1b6d77",
  "Pr3+": "#a85f2a",
  "Er3+": "#6d5aa8",
  "Yb3+": "#2d7c4b",
  "Tm3+": "#b34a6f",
  "Nd3+": "#6d7378"
};

const SHAPES3D = {
  "Eu3+": "circle",
  "Pr3+": "square",
  "Er3+": "diamond",
  "Yb3+": "triangle-up",
  "Tm3+": "triangle-down",
  "Nd3+": "hexagon"
};

const PROTOCOLS3D = ["AFC", "NLPE", "GEM", "EIT", "CRIB", "4-level RASE"];
const YEAR_MIN = Math.min(...plotted3d.map((d) => d.year));
const YEAR_MAX = Math.max(...plotted3d.map((d) => d.year));
const TIME_MIN = 1e-9;
const TIME_MAX = 4000;
const EFF_MIN = 0.01;
const EFF_MAX = 100;

const canvas3d = document.getElementById("plot3d");
const wrap3d = document.getElementById("canvasWrap3d");
const tooltip3d = document.getElementById("tooltip3d");
const detail3d = document.getElementById("detail3d");
const visible3d = document.getElementById("visible3d");
const total3d = document.getElementById("total3d");
const ctx3d = canvas3d.getContext("2d");

const state3d = {
  search: "",
  ions: new Set(),
  protocols: new Set(),
  erFocus: false,
  selectedId: plotted3d.find((d) => d.isotope === "167Er3+" && d.host === "Y2SiO5")?.id || plotted3d[0]?.id || "",
  yaw: -0.72,
  pitch: -0.38,
  zoom: 1,
  dragging: false,
  moved: false,
  pointerId: null,
  lastX: 0,
  lastY: 0,
  hoverId: ""
};

let cssWidth3d = 0;
let cssHeight3d = 0;
let projected3d = [];

function escape3d(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function protocolGroup3d(d) {
  if (["AFC", "spin-wave AFC", "ZEFOZ spin-wave AFC", "AFC / feed-forward", "AFC / Stark control", "on-demand AFC", "SMAFC"].includes(d.protocol)) return "AFC";
  if (d.protocol === "NLPE / spin-wave") return "NLPE";
  return d.protocol || "other";
}

function normalize3d(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function searchText3d(d) {
  const meta = author3d[d.id] || {};
  return normalize3d([
    d.title, d.authors, d.authorsFull, d.searchTerms, meta.authorsFull, meta.searchTerms,
    d.year, d.ion, d.isotope, d.host, d.protocol, protocolGroup3d(d), d.architecture,
    d.cavity, d.inputState, d.note
  ].join(" "));
}

function matches3d(d) {
  if (state3d.search) {
    const terms = normalize3d(state3d.search).split(/\s+/).filter(Boolean);
    const haystack = searchText3d(d);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }
  if (state3d.ions.size && !state3d.ions.has(d.ion)) return false;
  if (state3d.protocols.size && !state3d.protocols.has(protocolGroup3d(d))) return false;
  if (state3d.erFocus && !(d.isotope === "167Er3+" && /Y2SiO5/i.test(d.host) && protocolGroup3d(d) === "AFC")) return false;
  return true;
}

function logNorm3d(value, min, max) {
  return (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
}

function yearPosition3d(year) {
  return 0.5 - (year - YEAR_MIN) / Math.max(1, YEAR_MAX - YEAR_MIN);
}

function world3d(d) {
  return {
    x: yearPosition3d(d.year),
    y: logNorm3d(d.efficiencyPct, EFF_MIN, EFF_MAX) - 0.5,
    z: logNorm3d(d.storageTimeS, TIME_MIN, TIME_MAX) - 0.5
  };
}

function project3d(point) {
  const cosY = Math.cos(state3d.yaw);
  const sinY = Math.sin(state3d.yaw);
  const x1 = point.x * cosY - point.z * sinY;
  const z1 = point.x * sinY + point.z * cosY;
  const cosP = Math.cos(state3d.pitch);
  const sinP = Math.sin(state3d.pitch);
  const y2 = point.y * cosP - z1 * sinP;
  const z2 = point.y * sinP + z1 * cosP;
  const camera = 2.7;
  const perspective = camera / (camera - z2);
  const compactScale = cssWidth3d < 520 ? cssWidth3d * 0.54 : cssWidth3d;
  const scale = Math.min(compactScale, cssHeight3d) * 0.72 * state3d.zoom;
  return {
    x: cssWidth3d * 0.5 + x1 * scale * perspective,
    y: cssHeight3d * 0.51 - y2 * scale * perspective,
    depth: z2,
    perspective
  };
}

function resize3d() {
  const rect = canvas3d.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  cssWidth3d = Math.max(320, rect.width);
  cssHeight3d = Math.max(420, rect.height);
  canvas3d.width = Math.round(cssWidth3d * ratio);
  canvas3d.height = Math.round(cssHeight3d * ratio);
  ctx3d.setTransform(ratio, 0, 0, ratio, 0, 0);
  render3d();
}

function line3d(a, b, color, width = 1) {
  const pa = project3d(a);
  const pb = project3d(b);
  ctx3d.beginPath();
  ctx3d.moveTo(pa.x, pa.y);
  ctx3d.lineTo(pb.x, pb.y);
  ctx3d.strokeStyle = color;
  ctx3d.lineWidth = width;
  ctx3d.stroke();
}

function text3d(label, point, dx = 0, dy = 0, align = "center", color = "#646b73", font = "11px Arial") {
  const p = project3d(point);
  ctx3d.font = font;
  ctx3d.fillStyle = color;
  ctx3d.textAlign = align;
  ctx3d.textBaseline = "middle";
  const width = ctx3d.measureText(label).width;
  let x = p.x + dx;
  if (align === "right") x = Math.max(width + 5, Math.min(cssWidth3d - 5, x));
  else if (align === "left") x = Math.max(5, Math.min(cssWidth3d - width - 5, x));
  else x = Math.max(width / 2 + 5, Math.min(cssWidth3d - width / 2 - 5, x));
  const y = Math.max(9, Math.min(cssHeight3d - 9, p.y + dy));
  ctx3d.fillText(label, x, y);
}

function timeLabel3d(value) {
  if (value < 1e-6) return `${formatTick3d(value * 1e9)} ns`;
  if (value < 1e-3) return `${formatTick3d(value * 1e6)} us`;
  if (value < 1) return `${formatTick3d(value * 1e3)} ms`;
  if (value < 60) return `${formatTick3d(value)} s`;
  if (value < 3600) return `${formatTick3d(value / 60)} min`;
  return `${formatTick3d(value / 3600)} h`;
}

function formatTick3d(value) {
  return Number(value.toPrecision(3)).toString();
}

function drawFrame3d() {
  const compact = cssWidth3d < 520;
  const corners = [];
  [-0.5, 0.5].forEach((x) => [-0.5, 0.5].forEach((y) => [-0.5, 0.5].forEach((z) => corners.push({ x, y, z }))));
  const edges = [];
  for (let i = 0; i < corners.length; i += 1) {
    for (let j = i + 1; j < corners.length; j += 1) {
      const a = corners[i];
      const b = corners[j];
      const diff = Number(a.x !== b.x) + Number(a.y !== b.y) + Number(a.z !== b.z);
      if (diff === 1) edges.push([a, b]);
    }
  }
  edges.forEach(([a, b]) => line3d(a, b, "rgba(174,181,173,.72)", 1));

  const yearTickCandidates = compact ? [YEAR_MIN, YEAR_MAX] : [YEAR_MIN, 2010, 2015, 2020, 2025, YEAR_MAX];
  const yearTicks = Array.from(new Set(yearTickCandidates
    .filter((v) => v >= YEAR_MIN && v <= YEAR_MAX)
    .filter((v) => v === YEAR_MIN || v === YEAR_MAX || Math.min(v - YEAR_MIN, YEAR_MAX - v) >= 2)));
  yearTicks.forEach((year) => {
    const x = yearPosition3d(year);
    line3d({ x, y: -0.5, z: -0.5 }, { x, y: -0.5, z: 0.5 }, "rgba(225,229,222,.72)");
    text3d(String(year), { x, y: -0.5, z: -0.5 }, 0, 15);
  });

  (compact ? [0.01, 1, 100] : [0.01, 0.1, 1, 10, 100]).forEach((eff) => {
    const y = logNorm3d(eff, EFF_MIN, EFF_MAX) - 0.5;
    line3d({ x: -0.5, y, z: -0.5 }, { x: 0.5, y, z: -0.5 }, "rgba(225,229,222,.72)");
    text3d(`${eff}%`, { x: -0.5, y, z: -0.5 }, -9, 0, "right");
  });

  (compact ? [1e-9, 1e-3, 3600] : [1e-9, 1e-6, 1e-3, 1, 60, 3600]).forEach((time) => {
    const z = logNorm3d(time, TIME_MIN, TIME_MAX) - 0.5;
    line3d({ x: -0.5, y: -0.5, z }, { x: 0.5, y: -0.5, z }, "rgba(225,229,222,.72)");
    text3d(timeLabel3d(time), { x: 0.5, y: -0.5, z }, 9, 0, "left");
  });

  if (!compact) {
    text3d("Publication year", { x: 0.55, y: -0.5, z: -0.5 }, 10, 20, "left", "#17191c", "bold 12px Arial");
    text3d("Efficiency", { x: -0.5, y: 0.57, z: -0.5 }, -8, 0, "right", "#17191c", "bold 12px Arial");
    text3d("Storage time", { x: 0.5, y: -0.5, z: 0.57 }, 10, 0, "left", "#17191c", "bold 12px Arial");
  }
}

function drawMark3d(item) {
  const { d, p } = item;
  const selected = d.id === state3d.selectedId;
  const hovered = d.id === state3d.hoverId;
  const erHighlight = d.isotope === "167Er3+" && /Y2SiO5/i.test(d.host);
  const radius = (selected ? 8 : erHighlight ? 6.7 : 5.5) * Math.max(0.76, p.perspective);
  const shape = SHAPES3D[d.ion] || "circle";
  const color = COLORS3D[d.ion] || "#596067";

  ctx3d.save();
  ctx3d.translate(p.x, p.y);
  ctx3d.beginPath();
  if (shape === "square") {
    ctx3d.rect(-radius, -radius, radius * 2, radius * 2);
  } else if (shape === "diamond") {
    ctx3d.moveTo(0, -radius * 1.25);
    ctx3d.lineTo(radius, 0);
    ctx3d.lineTo(0, radius * 1.25);
    ctx3d.lineTo(-radius, 0);
    ctx3d.closePath();
  } else if (shape === "triangle-up" || shape === "triangle-down") {
    const sign = shape === "triangle-up" ? 1 : -1;
    ctx3d.moveTo(0, -radius * 1.25 * sign);
    ctx3d.lineTo(radius, radius * sign);
    ctx3d.lineTo(-radius, radius * sign);
    ctx3d.closePath();
  } else if (shape === "hexagon") {
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 3 * i - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx3d.moveTo(x, y); else ctx3d.lineTo(x, y);
    }
    ctx3d.closePath();
  } else {
    ctx3d.arc(0, 0, radius, 0, Math.PI * 2);
  }
  ctx3d.fillStyle = color;
  ctx3d.globalAlpha = d.confidence === "low" ? 0.55 : 0.9;
  ctx3d.fill();
  ctx3d.globalAlpha = 1;
  ctx3d.strokeStyle = selected ? "#111" : hovered ? "#1b6d77" : "rgba(255,255,255,.95)";
  ctx3d.lineWidth = selected ? 2.6 : hovered ? 2.4 : 1.2;
  ctx3d.stroke();
  if (erHighlight && !selected) {
    ctx3d.beginPath();
    ctx3d.arc(0, 0, radius + 3, 0, Math.PI * 2);
    ctx3d.strokeStyle = "rgba(109,90,168,.45)";
    ctx3d.lineWidth = 1;
    ctx3d.stroke();
  }
  ctx3d.restore();
}

function render3d() {
  if (!cssWidth3d || !cssHeight3d) return;
  ctx3d.clearRect(0, 0, cssWidth3d, cssHeight3d);
  drawFrame3d();
  const visible = plotted3d.filter(matches3d);
  if (visible.length && !visible.some((d) => d.id === state3d.selectedId)) state3d.selectedId = visible[0].id;
  projected3d = visible.map((d) => ({ d, p: project3d(world3d(d)) })).sort((a, b) => a.p.depth - b.p.depth);
  projected3d.forEach(drawMark3d);
  visible3d.textContent = visible.length;
  total3d.textContent = plotted3d.length;
  renderDetail3d();
}

function renderDetail3d() {
  const d = all3d.find((item) => item.id === state3d.selectedId) || plotted3d[0];
  if (!d) return;
  const meta = author3d[d.id] || {};
  const source = sources3d[d.id] || {};
  const tags = [d.isotope || d.ion, d.host, d.protocol, d.architecture, d.cavity, d.inputState, `${d.confidence} confidence`].filter(Boolean);
  detail3d.innerHTML = `
    <div class="detail-heading">
      <p class="eyebrow">${escape3d(d.authors)} ${escape3d(d.year)}</p>
      <h2>${escape3d(d.title)}</h2>
      <p>${escape3d(d.venue)}</p>
    </div>
    <div class="detail-grid">
      <div class="metric"><span>Publication year</span><strong>${escape3d(d.year)}</strong></div>
      <div class="metric"><span>Storage time</span><strong>${escape3d(d.storageTimeLabel)}</strong></div>
      <div class="metric"><span>Efficiency</span><strong>${escape3d(d.efficiencyLabel)}</strong></div>
      <div class="metric"><span>Protocol family</span><strong>${escape3d(protocolGroup3d(d))}</strong></div>
    </div>
    <div class="tag-row">${tags.map((tag) => `<span class="tag">${escape3d(tag)}</span>`).join("")}</div>
    <p class="detail-note">${escape3d(d.note)}</p>
    <div class="detail-meta">
      <span><strong>Authors:</strong> ${escape3d(meta.authorsFull || d.authorsFull || d.authors)}</span>
      <span><strong>Efficiency definition:</strong> ${escape3d(d.efficiencyType)}</span>
      ${source.locator ? `<span><strong>Source location:</strong> ${escape3d(source.locator)}</span>` : ""}
      ${source.extractionMethod ? `<span><strong>Extraction:</strong> ${escape3d(source.extractionMethod)}</span>` : ""}
      ${source.verifiedDate ? `<span><strong>Verified:</strong> ${escape3d(source.verifiedDate)}</span>` : ""}
      <a class="detail-link" href="${escape3d(d.url)}" target="_blank" rel="noreferrer">Open DOI / source page</a>
    </div>
  `;
}

function nearest3d(x, y) {
  let best = null;
  let bestDistance = 14;
  projected3d.forEach((item) => {
    const distance = Math.hypot(item.p.x - x, item.p.y - y);
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  });
  return best;
}

function showTooltip3d(item) {
  if (!item) {
    tooltip3d.hidden = true;
    state3d.hoverId = "";
    render3d();
    return;
  }
  state3d.hoverId = item.d.id;
  tooltip3d.innerHTML = `<strong>${escape3d(item.d.authors)} ${escape3d(item.d.year)}</strong><br>${escape3d(item.d.isotope || item.d.ion)} / ${escape3d(item.d.host)}<br>${escape3d(item.d.storageTimeLabel)} · ${escape3d(item.d.efficiencyLabel)}`;
  tooltip3d.hidden = false;
  const width = tooltip3d.offsetWidth;
  const height = tooltip3d.offsetHeight;
  const left = Math.max(8, Math.min(item.p.x + 12, cssWidth3d - width - 8));
  const top = Math.max(8, Math.min(item.p.y + 12, cssHeight3d - height - 8));
  tooltip3d.style.left = `${left}px`;
  tooltip3d.style.top = `${top}px`;
  render3d();
}

function pointerPosition3d(event) {
  const rect = canvas3d.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

canvas3d.addEventListener("pointerdown", (event) => {
  const pos = pointerPosition3d(event);
  state3d.dragging = true;
  state3d.moved = false;
  state3d.pointerId = event.pointerId;
  state3d.lastX = pos.x;
  state3d.lastY = pos.y;
  canvas3d.setPointerCapture(event.pointerId);
  canvas3d.classList.add("dragging");
});

canvas3d.addEventListener("pointermove", (event) => {
  const pos = pointerPosition3d(event);
  if (state3d.dragging && event.pointerId === state3d.pointerId) {
    const dx = pos.x - state3d.lastX;
    const dy = pos.y - state3d.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) state3d.moved = true;
    state3d.yaw += dx * 0.008;
    state3d.pitch = Math.max(-1.15, Math.min(1.15, state3d.pitch + dy * 0.008));
    state3d.lastX = pos.x;
    state3d.lastY = pos.y;
    tooltip3d.hidden = true;
    render3d();
    return;
  }
  showTooltip3d(nearest3d(pos.x, pos.y));
});

canvas3d.addEventListener("pointerup", (event) => {
  const pos = pointerPosition3d(event);
  if (!state3d.moved) {
    const item = nearest3d(pos.x, pos.y);
    if (item) {
      state3d.selectedId = item.d.id;
      window.location.hash = encodeURIComponent(item.d.id);
      render3d();
    }
  }
  state3d.dragging = false;
  state3d.pointerId = null;
  canvas3d.classList.remove("dragging");
  if (canvas3d.hasPointerCapture(event.pointerId)) canvas3d.releasePointerCapture(event.pointerId);
});

canvas3d.addEventListener("pointerleave", () => {
  if (!state3d.dragging) showTooltip3d(null);
});

canvas3d.addEventListener("wheel", (event) => {
  event.preventDefault();
  state3d.zoom = Math.max(0.66, Math.min(1.65, state3d.zoom * Math.exp(-event.deltaY * 0.001)));
  tooltip3d.hidden = true;
  render3d();
}, { passive: false });

function buildChips3d(containerId, values, stateSet) {
  const container = document.getElementById(containerId);
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = value;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      if (stateSet.has(value)) stateSet.delete(value); else stateSet.add(value);
      button.setAttribute("aria-pressed", String(stateSet.has(value)));
      render3d();
    });
    container.appendChild(button);
  });
}

function resetCamera3d() {
  state3d.yaw = -0.72;
  state3d.pitch = -0.38;
  state3d.zoom = 1;
  tooltip3d.hidden = true;
  render3d();
}

function init3d() {
  buildChips3d("ionFilters3d", Object.keys(COLORS3D), state3d.ions);
  buildChips3d("protocolFilters3d", PROTOCOLS3D, state3d.protocols);
  document.getElementById("search3d").addEventListener("input", (event) => {
    state3d.search = event.target.value.trim();
    render3d();
  });
  document.getElementById("focusEr3d").addEventListener("click", (event) => {
    state3d.erFocus = !state3d.erFocus;
    event.currentTarget.setAttribute("aria-pressed", String(state3d.erFocus));
    render3d();
  });
  document.getElementById("reset3d").addEventListener("click", () => {
    state3d.search = "";
    state3d.ions.clear();
    state3d.protocols.clear();
    state3d.erFocus = false;
    document.getElementById("search3d").value = "";
    document.querySelectorAll("#ionFilters3d button, #protocolFilters3d button, #focusEr3d").forEach((button) => button.setAttribute("aria-pressed", "false"));
    render3d();
  });
  document.getElementById("resetCamera3d").addEventListener("click", resetCamera3d);
  document.querySelectorAll("[data-camera]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.camera;
      if (direction === "left") state3d.yaw -= 0.16;
      if (direction === "right") state3d.yaw += 0.16;
      if (direction === "up") state3d.pitch = Math.max(-1.15, state3d.pitch - 0.12);
      if (direction === "down") state3d.pitch = Math.min(1.15, state3d.pitch + 0.12);
      render3d();
    });
  });
  document.getElementById("legend3d").innerHTML = Object.entries(COLORS3D).map(([ion, color]) => (
    `<span class="legend-item"><span class="legend-mark" style="background:${color}"></span>${escape3d(ion)}</span>`
  )).join("");
  const hashId = decodeURIComponent(window.location.hash.slice(1));
  if (hashId && all3d.some((d) => d.id === hashId)) state3d.selectedId = hashId;
  window.addEventListener("resize", resize3d);
  resize3d();
}

init3d();
