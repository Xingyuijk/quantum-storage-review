# Quantum-storage-review Codex CLI guide

This directory is the canonical website source and the GitHub Pages deployment repository. Work in
this directory only for website changes. Keep PDFs, extracted text, Zotero snapshots, screenshots, and
research reports outside the repository under the workspace `work/` or the automation state directory.

## Data and evidence rules

- `data.js` is the only core result dataset. Keep `author-index.js`, `source-locations.js`, and
  `experimental-conditions.js` synchronized for every result ID.
- A plotted storage time and efficiency must come from the same device, protocol, input state, and
  experimental condition. Never combine values from different traces.
- Preserve the paper's efficiency definition (`total`, `internal`, `echo`, `conditional`, spin-wave,
  RASE, or material-only) in `efficiencyType` and `note`.
- Do not invent source page/figure locators, temperatures, magnetic fields, DOI matches, or authors.
- Keep the established protocol, implementation, cavity, and ion visual taxonomies unless the user
  explicitly changes them.
- Zotero is read-only. Never create, edit, tag, move, or delete Zotero records.

## Required checks

After any data change, run:

```bash
node automation/validate_site_data.mjs .
```

For UI changes, serve the site with `python3 -m http.server` and check both `index.html` and `3d.html`,
including search, filters, details, tooltips, mobile layout, and the Er3+ focus view. Do not commit a
failed validation or a partially synchronized data change.

## Codex CLI workflow

Start an interactive session from the workspace with:

```bash
codex -C "/absolute/path/to/site" --sandbox workspace-write --ask-for-approval on-request
```

The scheduled job in `automation/run-daily-update.sh` is research-only: it may read the site and write
candidate reports to the external automation state, but it must not edit, commit, or push this repo.
Use `automation/publish-site.sh` manually after reviewing a candidate report and the working-tree diff.
Never force-push or amend history.

## Migration guard

`MIGRATION_AUDIT.md` in the workspace records the unresolved difference between the 108-result deployed
baseline and the 119-result development snapshot. Review that audit before publishing the pending data
delta.

