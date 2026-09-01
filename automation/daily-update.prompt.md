# Daily maintenance task: quantum-storage-review

You are maintaining a static research website about rare-earth solid-state quantum memories.
The current working directory is the website source directory. Treat the project handoff document and
the current JavaScript data files as authoritative for schema, classification, and evidence standards.

This is an unattended Codex CLI triage task, not a publication task. Do not invoke optional `paper-lookup`,
`pdf`, or other skills. If the runtime suggests a skill path that is unavailable, record that as a blocker
and continue with the local Zotero snapshot, current site data, and directly available metadata sources.
Complete paper/full-text evidence review is reserved for a manually reviewed interactive CLI session.

## Hard safety and quality rules

1. Read `../QUANTUM_STORAGE_REVIEW_HANDOFF.md` and `README.md` before changing anything. The source
   directory is the canonical `site/` repository, so the handoff is one level above this directory.
   Also read the latest earlier report in `$QUANTUM_STORAGE_AUTOMATION_STATE/reports/` when present,
   so pending candidates and earlier access failures are retried rather than silently forgotten.
2. This is a research-only scheduled task. Read the canonical `site/` repository and write only to the
   automation state directory named by `$QUANTUM_STORAGE_AUTOMATION_STATE`. Do not edit, commit, or push
   the site repository during this task. Website publication is a separate, manually reviewed command.
3. Zotero is mandatory and read-only for this task. Before Codex starts, the wrapper performs a
   complete paginated scan of Zotero Desktop's top-level library metadata. You must read both
   `$QUANTUM_STORAGE_AUTOMATION_STATE/zotero/current-snapshot.json` and
   `$QUANTUM_STORAGE_AUTOMATION_STATE/zotero/current-delta.json`. Review `unseenRelevantKeys` first,
   including older papers added or modified since the last successful scan, and then search the full
   snapshot for all scope-relevant items. Never create, update, delete, tag, or move Zotero items.
4. Search for publications that appeared after the previous successful run, using the existing
   subject scope: rare-earth-ion solid-state optical quantum memories, including AFC, spin-wave AFC,
   GEM, EIT, CRIB, RASE, integrated memories, and relevant coherence landmarks.
5. This task only triages candidates. Do not publish a candidate or edit website data without original
   paper/full-text inspection in a later manually reviewed session. When metadata suggests a possible
   result, record it as a candidate and state which primary evidence is still missing.
6. Preserve the distinction between total efficiency, internal efficiency, AFC echo, conditional
   readout, spin-wave efficiency, RASE rephasing, and material-only coherence. Explain the definition
   in `efficiencyType` and `note`.
7. Do not add a result merely because a title or abstract looks relevant. If evidence is incomplete,
   leave the site data unchanged and record the candidate and the exact missing evidence in the daily
   report.
8. Every new result must have a unique `id`, an author-index entry, a storage/efficiency source
   locator, and an experimental-condition entry. Keep all four JavaScript files synchronized:
   `data.js`, `author-index.js`, `source-locations.js`, and `experimental-conditions.js`.
9. Use `apply_patch` for source edits. Do not rewrite the whole data file, delete existing records,
   change the established filter taxonomy, or fabricate page/figure locators.
10. Do not commit, push, amend, force-push, install launch agents, or change credentials. This scheduled
    task only produces a candidate report; a human reviews and publishes any website change separately.

## Discovery and verification procedure

Use several independent discovery paths: the mandatory Zotero snapshot and delta, Crossref/OpenAlex
or arXiv metadata, current journal pages, and cited-by/author follow-up. The external search window
begins after the previous successful run, but Zotero candidates are not excluded merely because their
publication date is older: an older item newly added to Zotero may represent literature missed by a
previous run. De-duplicate by DOI first, arXiv ID second, and normalized title third. Compare candidates
against existing `data.js` before considering them new.

For Zotero specifically:

- Treat `fullScanCompleted: true` as proof that every top-level metadata page was fetched, not proof
  that every PDF has been read.
- Inspect every item in `unseenRelevantKeys`; on the first scan without a baseline this means every
  relevance hit, which recovers portions missed by earlier runs when Zotero was unavailable.
- Also search the complete snapshot using title, abstract, tags, DOI, authors, ion/host synonyms, and
  protocol synonyms; the scanner's relevance heuristic is only a priority hint and may miss items.
- For relevant items, prefer local Zotero attachments as the full-text source. If an attachment cannot
  be accessed, record that exact blocker and continue through publisher/arXiv/author-hosted routes.
- Record the Zotero item key and snapshot library version in the daily report. Add `zoteroKey` to a
  website result when the identity match is verified by DOI or normalized title plus authors.

For each candidate that survives metadata triage, capture:

- bibliographic identity, DOI or stable URL, and full author list;
- ion/isotope/host, wavelength, protocol, architecture, cavity, and input state;
- any metadata-level storage-time/efficiency claims, clearly labelled as unverified;
- the likely evidence source and the exact missing full-text checks;
- the verification date in `YYYY-MM-DD` format for the triage, not for an unperformed full-text review.

## Outputs

Let `today` be the local date in `$TZ` or the machine's local timezone. Write a concise report to:

`$QUANTUM_STORAGE_AUTOMATION_STATE/reports/<today>.md`

The report must state the search period, sources queried, candidates found, inclusion/exclusion reason,
whether site files changed, and any blocker such as unavailable full text or network failure. It must
also report the Zotero library version, total top-level item count, number of unseen/modified relevance
hits, the keys reviewed, and whether attachment full text was inspected. Clearly separate verified
evidence from inference.

If no candidate meets the evidence gate, make no changes to the website files. Even when a candidate
meets it, do not edit website files in this scheduled task. Record the complete proposed change in the
daily report so it can be applied in a reviewed interactive CLI session.

The scheduled task must leave the website repository unchanged. It may write its report under the
automation state directory. The manual publication command runs:

`node automation/validate_site_data.mjs .`

The command must pass after a human applies a proposed data change. If it fails, repair or revert the
incomplete edit; do not leave a partially synchronized record.
