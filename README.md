# Rare-earth quantum memories review page

Static first version of an interactive quantum-storage survey page.

Current local snapshot: 108 result entries, 98 plotted points, 87 distinct paper titles, and 4 review seeds.

## Open locally

```bash
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765/` from this directory.

The interactive three-dimensional map is available at `http://127.0.0.1:8765/3d.html`. It reuses `data.js`, `author-index.js`, `source-locations.js`, and `experimental-conditions.js`; no literature data are duplicated.

The 2D page also provides an `Actions -> Focus on Er3+` subview. It keeps every erbium record in the dataset, including entries whose isotope is not specified, so host/platform coverage is not silently discarded. In this mode, color encodes the detailed protocol class (two-level AFC, spin-wave AFC, Stark/on-demand AFC, CRIB, 4-level RASE, or material coherence), while marker shape encodes the host/platform family. The isotope field remains visible in the table and detail panel, allowing explicitly identified `167Er3+` results to be distinguished from isotope-unspecified Er records.

## Automated literature maintenance

The macOS LaunchAgent checks every 600 seconds while the user is logged in. A successful run is recorded by local date and the updater exits on later checks that day, so the website is updated at most once per day. A failed run does not advance the success marker and is retried on a later check. A lock prevents concurrent runs.

Each run follows this order:

1. Read this README, the parent project's local `QUANTUM_STORAGE_REVIEW_HANDOFF.md`, the previous daily report, and the current site data.
2. Require Zotero Desktop's read-only local API and fetch every page of top-level library metadata. Save a complete current snapshot and compare it with the last successfully processed snapshot.
3. Review Zotero items that are new or modified since the last successful scan first. If no successful Zotero baseline exists—for example, earlier runs could not reach Zotero—review all scope-relevant items so previously unread portions are recovered. Then search the full snapshot again; the automatic relevance list is only a prioritization hint.
4. Search external discovery channels independently: arXiv, Crossref/OpenAlex, current journal pages, review references, stable author identities and co-author networks, and forward/backward citation links.
5. Merge candidates and de-duplicate by DOI, then arXiv ID, then normalized title and authors. An older paper newly added to Zotero is still a candidate; the external date window must not hide literature that the user's evolving Zotero library has newly exposed.
6. Inspect original full text before publishing a result. Prefer a local Zotero PDF, then arXiv, publisher full text/supplement, or an author-hosted manuscript. Title or abstract alone is not enough for a plotted result.
7. Require storage time and efficiency to come from the same device, protocol, input state, and experimental condition. Never combine the longest time from one trace with the best efficiency from another. Keep total, internal, AFC echo, spin-wave, conditional, RASE rephasing, and material-only quantities explicitly distinguished.
8. Update `data.js`, `author-index.js`, `source-locations.js`, and `experimental-conditions.js` together. Every result needs a unique ID, full author indexing, a primary-source locator, paired temperature/field evidence (or explicit `Not reported`), and a verification date.
9. Run the data validator. Only after successful validation are the allowed website files copied to the deployment repository, committed, and pushed to GitHub Pages. The 2D and 3D headers are then dated `Updated to YYYY-MM-DD`.
10. Write a daily audit report listing the search window, Zotero library version and item counts, Zotero keys reviewed, external sources queried, inclusions/exclusions, evidence blockers, site changes, and validation result.

Zotero access is read-only during automatic maintenance. The updater never adds, edits, tags, moves, or deletes Zotero records. The successful Zotero checkpoint is advanced only after the whole website update succeeds; if research, validation, copying, Git, or deployment fails, the next run scans the full library again and retains the previous successful baseline.

Zotero Desktop must be running with **Settings → Advanced → Allow other applications on this computer to communicate with Zotero** enabled. If the local API or any pagination page is unavailable, that day's maintenance run fails and retries later instead of silently skipping Zotero.

The visible `Updated to` date means that the Zotero scan, external discovery, evidence review, validation, and deployment completed successfully through that local date. It does not necessarily mean a new paper was added.

## Data model

Edit `data.js`. Each `results` item is one experimental result or literature record, not necessarily one paper or plotted point. A single paper may contribute multiple points when it reports distinct storage conditions. Important papers without a directly paired storage time and total efficiency remain searchable and visible in the table, but are not plotted.

Verified evidence locators are stored separately in `source-locations.js`, keyed by result ID. Each entry records the original PDF or publisher-full-text location, extraction method, and verification date. The current local snapshot covers all 108 result records; multiple results from one paper retain result-specific locations when the reported conditions differ.

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
