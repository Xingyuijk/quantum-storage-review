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

The scheduled job in `automation/run-daily-update.sh` runs every three calendar days. It scans the local
Zotero snapshot, invokes `gpt-5.6-sol` for full-text/web research, and may update only the four synchronized
data files. The wrapper validates, commits, and pushes automatically when `AUTO_PUSH=1` (the LaunchAgent
setting). It never lets the model commit or push. Set `AUTO_PUSH=0` for a manual dry run or recovery, then
use `automation/publish-site.sh` to validate the working tree.
Runtime reports and logs are stored under the project root's `automation-state/` directory, separated into
`reports/`, `logs/`, `zotero/`, and `checkpoints/`.
Never force-push or amend history.

## Migration guard

`MIGRATION_AUDIT.md` and `MIGRATION_EVIDENCE_REVIEW_2026-09-01.md` in the workspace record the one-time
review accepting the 119-result baseline. The remote branch may temporarily remain at 108 results until
the reviewed migration commits are pushed; do not reintroduce the older 108-result baseline afterward.
