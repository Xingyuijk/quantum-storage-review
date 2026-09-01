# Rare-earth quantum memories review page

Static first version of an interactive quantum-storage survey page.

Current local snapshot: 119 result entries, 108 plotted points, 96 distinct paper titles, and 4 review seeds.

## Open locally

```bash
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765/` from this directory.

The interactive three-dimensional map is available at `http://127.0.0.1:8765/3d.html`. It reuses `data.js`, `author-index.js`, `source-locations.js`, and `experimental-conditions.js`; no literature data are duplicated.

The 2D page also provides an `Actions -> Focus on Er3+` subview. It keeps every erbium record in the dataset, including entries whose isotope is not specified, so host/platform coverage is not silently discarded. In this mode, color encodes the detailed protocol class (two-level AFC, spin-wave AFC, Stark/on-demand AFC, CRIB, 4-level RASE, or material coherence), while marker shape encodes the host/platform family. The isotope field remains visible in the table and detail panel, allowing explicitly identified `167Er3+` results to be distinguished from isotope-unspecified Er records.

## Codex CLI and literature maintenance

This repository is the canonical source and deployment checkout. Codex CLI reads the project rules from
`AGENTS.md` and the repository defaults from `.codex/config.toml`. Credentials are kept in `CODEX_HOME`
and are never stored in this repository.

The macOS LaunchAgent runs `automation/run-daily-update.sh` every hour as a three-calendar-day research
cycle. It performs a complete read-only Zotero metadata scan, then invokes Codex CLI model
`gpt-5.6-sol` to inspect the local corpus and current bibliographic/full-text sources. The model may edit
only the four synchronized data files after primary-text evidence review. The wrapper validates the site,
updates the visible date when data changed, commits, and pushes automatically. A lock, remote fast-forward
check, and cadence checkpoint prevent duplicate or conflicting runs; a failed run does not advance the
checkpoint. The dated report is retained outside the repository as the audit trail.

Zotero Desktop must be running with **Settings → Advanced → Allow other applications on this computer to
communicate with Zotero** enabled. If the local API or any pagination page is unavailable, the scan fails
and retries later. Zotero records are never created, edited, tagged, moved, or deleted.

For a manual one-off run without publication, set `AUTO_PUSH=0`. The normal LaunchAgent has
`AUTO_PUSH=1`; it publishes only after validation. To inspect or recover a run manually:

```bash
RESEARCH_INTERVAL_DAYS=0 AUTO_PUSH=0 ./automation/run-daily-update.sh
./automation/publish-site.sh
```

The `Updated to` date is changed only as part of a validated publication. The visible data counts describe
the current canonical source; the migration audit outside this repository records any still-unreviewed
difference from the older deployed snapshot.

## Data model

Edit `data.js`. Each `results` item is one experimental result or literature record, not necessarily one paper or plotted point. A single paper may contribute multiple points when it reports distinct storage conditions. Important papers without a directly paired storage time and total efficiency remain searchable and visible in the table, but are not plotted.

Verified evidence locators are stored separately in `source-locations.js`, keyed by result ID. Each entry records the original PDF or publisher-full-text location, extraction method, and verification date. The current local snapshot covers all 119 result records; multiple results from one paper retain result-specific locations when the reported conditions differ.

Working temperature and magnetic field are stored separately in `experimental-conditions.js`, also keyed by result ID. Every record includes a condition-specific source location, extraction method, and verification date. When one paper reports several measurements, `conditionNote` states which temperature/field pair belongs to the storage time and efficiency shown in that result; unrelated characterization conditions are explicitly excluded rather than silently merged.

Core plotted metrics:

- `storageTimeS`: storage time in seconds
- `efficiencyPct`: storage efficiency in percent; use `null` for background/material-only entries
- `protocol`: AFC, spin-wave AFC, GEM, etc.
- `ion`, `isotope`, `host`
- `architecture`: bulk/free-space, integrated waveguide, integrated chip, integrated membrane
- `cavity`: no cavity, impedance-matched cavity, waveguide cavity, fiber microcavity, on-chip cavity
- `confidence`: high, medium, low

The detail panel presents two independent evidence groups: `Storage time / efficiency source` and `Experimental-condition source`. A condition value of `Not reported` means the accessible primary text did not state it; it is not an inferred default.

The UI intentionally groups some raw fields into coarser filters:

- protocol families: AFC, NLPE, GEM, EIT, CRIB, 4-level RASE, material coherence
- implementation: bulk, chip
- cavity: fiber microcavity, bulk cavity, multi-pass, nanobeam cavity, on-chip resonator, waveguide cavity, no cavity

Raw protocol, implementation, cavity, and input-state details are preserved in the detail panel tags.

The `Explore 3D map` link lives in the left-side Actions group rather than the chart toolbar, preserving the original 2D plot height.

## Current caveats

- This is a first-pass dataset, not a final exhaustive review.
- Low-confidence entries are included to mark important landmarks but should be rechecked from the original figure/data before publication-quality comparison.
- Efficiency definitions differ across papers; the detail panel preserves the current interpretation in `efficiencyType` and `note`.
