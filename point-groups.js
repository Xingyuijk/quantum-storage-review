// Group by the measured coordinates, before projection, zoom or rounding.
function groupPlotResults(results, includeYear = false) {
  const groups = new Map();
  for (const d of results) {
    const coordinates = [d.storageTimeS, d.efficiencyPct];
    if (includeYear) coordinates.push(d.year);
    const key = coordinates.join("|");
    if (!groups.has(key)) groups.set(key, { key, records: [] });
    groups.get(key).records.push(d);
  }
  return [...groups.values()];
}

class PlotGroupPicker {
  constructor(layer, selectResult) {
    this.layer = layer;
    this.selectResult = selectResult;
    this.groups = new Map();
    this.buttons = new Map();
    this.dialog = document.createElement("dialog");
    this.dialog.className = "point-group-dialog";
    this.dialog.setAttribute("aria-labelledby", "pointGroupTitle");
    this.dialog.innerHTML = `
      <div class="point-group-header">
        <h2 id="pointGroupTitle"></h2>
        <button type="button" class="point-group-close" aria-label="Close result list">×</button>
      </div>
      <div class="point-group-options"></div>
    `;
    this.dialog.querySelector(".point-group-close").onclick = () => this.dialog.close();
    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) {
        const rect = this.dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) this.dialog.close();
      }
    });
    document.body.append(this.dialog);
  }

  update(groups, positionOf, includeYear = false) {
    this.groups = new Map(groups.filter((group) => group.records.length > 1).map((group) => [group.key, group]));
    for (const [key, button] of this.buttons) {
      if (this.groups.has(key)) continue;
      button.remove();
      this.buttons.delete(key);
    }
    for (const [key, { records }] of this.groups) {
      let button = this.buttons.get(key);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "point-group-badge";
        button.setAttribute("aria-haspopup", "dialog");
        button.addEventListener("click", () => this.open(key));
        this.layer.append(button);
        this.buttons.set(key, button);
      }
      const first = records[0];
      button.dataset.id = first.id;
      button.textContent = `×${records.length}`;
      const label = `${records.length} results at ${first.storageTimeLabel}, ${first.efficiencyPct}%${includeYear ? `, ${first.year}` : ""}`;
      button.setAttribute("aria-label", label);
      button.title = label;
      const { x, y } = positionOf(first);
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
    }
    if (this.dialog.open) {
      const records = this.groups.get(this.openKey)?.records || [];
      if (records.length !== this.openRecords.length || records.some((d, i) => d !== this.openRecords[i])) {
        this.dialog.close();
      }
    }
  }

  open(key) {
    const group = this.groups.get(key);
    if (!group) return;
    this.openKey = key;
    const { records } = group;
    this.openRecords = records;
    const trigger = this.buttons.get(key);
    const options = this.dialog.querySelector(".point-group-options");
    options.replaceChildren();
    this.dialog.querySelector("h2").textContent = `${records.length} results at this point`;
    for (const d of records) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "point-group-option";
      const conditions = window.QM_EXPERIMENTAL_CONDITIONS?.[d.id] || {};
      const fields = [
        ["span", `${d.authors} · ${d.year}`],
        ["strong", d.title],
        ["span", [d.storageTimeLabel, d.efficiencyLabel, d.efficiencyType].filter(Boolean).join(" · ")],
        ["span", [d.isotope || d.ion, d.host, d.protocol, d.inputState].filter(Boolean).join(" · ")],
        ["span", `Temperature: ${conditions.temperature || "Not verified"} · Magnetic field: ${conditions.magneticField || "Not verified"}`]
      ];
      for (const [tag, value] of fields) {
        const line = document.createElement(tag);
        line.textContent = value;
        button.append(line);
      }
      button.addEventListener("click", () => {
        this.dialog.close();
        this.selectResult(d.id, trigger);
      });
      options.append(button);
    }
    trigger.focus({ preventScroll: true });
    this.dialog.showModal();
    options.firstElementChild.focus();
  }
}
