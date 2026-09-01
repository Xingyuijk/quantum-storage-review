# Daily maintenance task: quantum-storage-review

You are maintaining a static research website about rare-earth solid-state quantum memories.
The current working directory is the website source directory. Treat the project handoff document and
the current JavaScript data files as authoritative for schema, classification, and evidence standards.

This is an unattended Codex CLI research, analysis, and publication-preparation task. The wrapper invokes
the `gpt-5.6-sol` model every three calendar days in a writable project sandbox and automatically pushes
validated website changes. Treat the local Zotero snapshot/delta and the files in `work/` as the starting
corpus, then use the model's web search for current bibliographic discovery and accessible publisher/arXiv
full text when needed. The final response is captured as the dated audit report.

## Hard safety and quality rules

1. Read `../QUANTUM_STORAGE_REVIEW_HANDOFF.md` and `README.md` before changing anything. The source
   directory is the canonical `site/` repository, so the handoff is one level above this directory.
   Also read the latest earlier report in `$QUANTUM_STORAGE_AUTOMATION_STATE/reports/` when present,
   so pending candidates and earlier access failures are retried rather than silently forgotten.
2. This is an automated research-and-publication task. Read the canonical `site/` repository and the
   external `work/` corpus. You may edit only the four synchronized data files needed for accepted records:
   `data.js`, `author-index.js`, `source-locations.js`, and `experimental-conditions.js`. Do not edit UI,
   automation, README, handoff, or migration-audit files. The wrapper validates, updates the visible date,
   commits, and pushes; never run `git commit`, `git push`, `git reset`, or history-rewriting commands.
3. Zotero is mandatory and read-only for this task. Before Codex starts, the wrapper performs a
   complete paginated scan of Zotero Desktop's top-level library metadata. You must read both
   `$QUANTUM_STORAGE_AUTOMATION_STATE/zotero/current-snapshot.json` and
   `$QUANTUM_STORAGE_AUTOMATION_STATE/zotero/current-delta.json`. Review `unseenRelevantKeys` first,
   including older papers added or modified since the last successful scan, and then search the full
   snapshot for all scope-relevant items. Never create, update, delete, tag, or move Zotero items.
4. Compare the local Zotero snapshot and delta against the current site data. Identify new, modified,
   duplicate, and potentially relevant records using DOI, arXiv ID, normalized title, and authors.
5. A candidate is eligible for automatic inclusion only after the original paper, publisher full text,
   or author-hosted full text has been inspected. The storage time and efficiency must be paired to the
   same device, protocol, input state, and experimental condition. If evidence is incomplete, leave the
   site data unchanged for that candidate and state exactly which primary evidence is missing.
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
10. Do not commit, push, amend, force-push, install launch agents, or change credentials. The wrapper owns
    validation, commit, and push after this task exits successfully.

## Discovery and verification procedure

Use the mandatory local Zotero snapshot and delta plus the current site data, then search current
bibliographic sources and primary full text with the available web-search tool. The search window begins
after the previous successful report, but Zotero candidates are not excluded merely because their
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
- Prefer local Zotero attachments and the existing `work/` PDFs/text as primary full-text sources. If an
  attachment cannot be accessed, record that exact blocker and continue through publisher/arXiv or
  author-hosted routes.
- Record the Zotero item key and snapshot library version in the daily report. Add `zoteroKey` to a
  website result when the identity match is verified by DOI or normalized title plus authors.

For each candidate that survives metadata triage, capture:

- bibliographic identity, DOI or stable URL, and full author list;
- ion/isotope/host, wavelength, protocol, architecture, cavity, and input state;
- the exact paired storage-time/efficiency values used, with the efficiency definition and uncertainty;
- original-text locators and extraction methods for both performance and experimental conditions;
- any metadata-only claims clearly labelled as unverified, plus the exact missing full-text checks;
- the verification date in `YYYY-MM-DD` format for the completed evidence review.

## Outputs

Let `today` be the local date in `$TZ` or the machine's local timezone. Write a concise report to:

`$QUANTUM_STORAGE_AUTOMATION_STATE/reports/<today>.md`

The report must state the search period, sources queried, candidates found, inclusion/exclusion reason,
whether site files changed, and any blocker such as unavailable full text or network failure. It must
also report the Zotero library version, total top-level item count, number of unseen/modified relevance
hits, the keys reviewed, and whether attachment full text was inspected. Clearly separate verified
evidence from inference.

If no candidate meets the evidence gate, make no changes to the website files. If a candidate does meet
the gate, update all four synchronized data files with the complete evidence and then let the wrapper
validate and publish the change. Record every accepted, rejected, and blocked candidate in the daily
report. The report is an audit trail; it does not replace the source locators in the site data.

The scheduled task may change only the four data files listed above; the wrapper updates the visible date after
every successful research cycle, then commits and pushes after validation. It also writes the report under the
automation state directory. Keep
the report concise (preferably under 2,000 words). The validator command is:

`node automation/validate_site_data.mjs .`

The command must pass before publication. If it fails, repair the incomplete synchronized edit and do not
push a partially updated record.
