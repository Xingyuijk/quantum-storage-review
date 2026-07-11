# Rare-earth quantum memories review page

Static first version of an interactive quantum-storage survey page.

Current local snapshot: 105 result entries, 96 plotted points, 85 distinct paper titles, and 4 review seeds.

## Open locally

```bash
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765/` from this directory.

The interactive three-dimensional map is available at `http://127.0.0.1:8765/3d.html`. It reuses `data.js`, `author-index.js`, and `source-locations.js`; no literature data are duplicated.

## Data model

Edit `data.js`. Each `results` item is one experimental result or literature record, not necessarily one paper or plotted point. A single paper may contribute multiple points when it reports distinct storage conditions. Important papers without a directly paired storage time and total efficiency remain searchable and visible in the table, but are not plotted.

Verified evidence locators are stored separately in `source-locations.js`, keyed by result ID. Each entry records the original PDF or publisher-full-text location, extraction method, and verification date. The current local snapshot covers all 105 result records; multiple results from one paper retain result-specific locations when the reported conditions differ.

Core plotted metrics:

- `storageTimeS`: storage time in seconds
- `efficiencyPct`: storage efficiency in percent; use `null` for background/material-only entries
- `protocol`: AFC, spin-wave AFC, GEM, etc.
- `ion`, `isotope`, `host`
- `architecture`: bulk/free-space, integrated waveguide, integrated chip, integrated membrane
- `cavity`: no cavity, impedance-matched cavity, waveguide cavity, fiber microcavity, on-chip cavity
- `confidence`: high, medium, low

The UI intentionally groups some raw fields into coarser filters:

- protocol families: AFC, NLPE, GEM, EIT, CRIB, 4-level RASE, material coherence
- implementation: bulk, chip
- cavity: fiber microcavity, bulk cavity, multi-pass, nanobeam cavity, on-chip resonator, waveguide cavity, no cavity

Raw protocol, implementation, cavity, and input-state details are preserved in the detail panel tags.

## Current caveats

- This is a first-pass dataset, not a final exhaustive review.
- Low-confidence entries are included to mark important landmarks but should be rechecked from the original figure/data before publication-quality comparison.
- Efficiency definitions differ across papers; the detail panel preserves the current interpretation in `efficiencyType` and `note`.
