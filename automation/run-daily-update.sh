#!/bin/zsh
set -euo pipefail

SCRIPT_PATH="${0:A}"
SITE_DIR="${SCRIPT_PATH:h:h}"
WORKSPACE_DIR="${SITE_DIR:h}"
STATE_DIR="${QUANTUM_STORAGE_AUTOMATION_STATE:-/Users/xiangrikui/Library/Application Support/quantum-storage-review-updater}"
NODE_BIN="${NODE_BIN:-/opt/homebrew/bin/node}"
GIT_BIN="${GIT_BIN:-/usr/bin/git}"
CODEX_BIN="${CODEX_BIN:-/opt/homebrew/bin/codex}"
CODEX_MODEL="${CODEX_MODEL:-gpt-5.6-sol}"
AUTO_PUSH="${AUTO_PUSH:-0}"
RESEARCH_INTERVAL_DAYS="${RESEARCH_INTERVAL_DAYS:-3}"

AUTOMATION_DIR="$SITE_DIR/automation"
ZOTERO_SCANNER="$AUTOMATION_DIR/scan-zotero-library.mjs"
TRIAGE_REPORTER="$AUTOMATION_DIR/build-triage-report.mjs"
DAILY_PROMPT="$AUTOMATION_DIR/daily-update.prompt.md"
LOCK_DIR="$STATE_DIR/run.lock"
RUN_LOG="$STATE_DIR/runner.log"
LAST_RESEARCH_DATE="$STATE_DIR/last-research-date"
BASELINE_SNAPSHOT="$STATE_DIR/zotero/last-research-snapshot.json"
TODAY=$(/bin/date +%F)

mkdir -p "$STATE_DIR/reports" "$STATE_DIR/zotero"

if [[ "${1:-}" == "--dry-run" ]]; then
  print -r -- "site=$SITE_DIR"
  print -r -- "workspace=$WORKSPACE_DIR"
  print -r -- "state=$STATE_DIR"
  print -r -- "mode=research-and-publish; model edits limited to synchronized data files"
  print -r -- "model=$CODEX_MODEL"
  print -r -- "auto_push=$AUTO_PUSH"
  print -r -- "cadence=${RESEARCH_INTERVAL_DAYS} calendar days; hourly retry polling"
  print -r -- "zotero_baseline=$BASELINE_SNAPSHOT"
  print -r -- "poll_interval=3600 seconds; successful runs are spaced by ${RESEARCH_INTERVAL_DAYS} calendar days"
  exit 0
fi

if [[ -f "$RUN_LOG" ]]; then
  log_bytes=$(/usr/bin/stat -f %z "$RUN_LOG" 2>/dev/null || print 0)
  if (( log_bytes > 10 * 1024 * 1024 )); then
    /bin/mv "$RUN_LOG" "$RUN_LOG.$TODAY"
  fi
fi
exec >> "$RUN_LOG" 2>&1
print -r -- "[$(/bin/date '+%Y-%m-%d %H:%M:%S %z')] updater started (model=$CODEX_MODEL auto_push=$AUTO_PUSH)"

if [[ -f "$LAST_RESEARCH_DATE" ]]; then
  last_date="$(/usr/bin/tr -d '[:space:]' < "$LAST_RESEARCH_DATE")"
  last_epoch=$(/bin/date -j -f "%Y-%m-%d" "$last_date" "+%s" 2>/dev/null || print 0)
  today_epoch=$(/bin/date -j -f "%Y-%m-%d" "$TODAY" "+%s")
  elapsed_days=$(( (today_epoch - last_epoch) / 86400 ))
  if (( elapsed_days < RESEARCH_INTERVAL_DAYS )); then
    print -r -- "[$TODAY] last successful run was $last_date ($elapsed_days days ago); waiting for ${RESEARCH_INTERVAL_DAYS}-day cadence"
    exit 0
  fi
fi

if [[ -d "$LOCK_DIR" ]]; then
  old_pid=""
  [[ -f "$LOCK_DIR/pid" ]] && old_pid="$(<"$LOCK_DIR/pid")"
  if [[ -n "$old_pid" ]] && /bin/kill -0 "$old_pid" 2>/dev/null; then
    print -r -- "another updater is running (pid $old_pid); exiting"
    exit 0
  fi
  [[ -f "$LOCK_DIR/pid" ]] && /bin/rm "$LOCK_DIR/pid"
  /bin/rmdir "$LOCK_DIR" 2>/dev/null || true
fi

if ! /bin/mkdir "$LOCK_DIR" 2>/dev/null; then
  print -r -- "could not acquire updater lock; exiting"
  exit 0
fi
print -r -- "$$" > "$LOCK_DIR/pid"
cleanup() {
  [[ -f "$LOCK_DIR/pid" ]] && /bin/rm "$LOCK_DIR/pid"
  /bin/rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

if [[ ! -x "$NODE_BIN" || ! -x "$CODEX_BIN" ]]; then
  print -r -- "required Node or Codex executable is missing"
  exit 1
fi
if [[ ! -d "$SITE_DIR/.git" ]]; then
  print -r -- "canonical site Git repository is missing: $SITE_DIR"
  exit 1
fi
if [[ ! -r "$ZOTERO_SCANNER" || ! -r "$TRIAGE_REPORTER" || ! -r "$DAILY_PROMPT" ]]; then
  print -r -- "research support files are missing or unreadable"
  exit 1
fi

dirty="$($GIT_BIN -C "$SITE_DIR" status --porcelain --untracked-files=all | /usr/bin/grep -v '^?? \.DS_Store$' || true)"
if [[ -n "$dirty" ]]; then
  print -r -- "canonical site has uncommitted changes; refusing to run scheduled research"
  print -r -- "$dirty"
  exit 1
fi

if (( AUTO_PUSH == 1 )); then
  if ! "$GIT_BIN" -C "$SITE_DIR" fetch --quiet origin main; then
    print -r -- "could not fetch origin/main; refusing automatic publication"
    exit 1
  fi
  ahead_count="$($GIT_BIN -C "$SITE_DIR" rev-list --count origin/main..HEAD)"
  behind_count="$($GIT_BIN -C "$SITE_DIR" rev-list --count HEAD..origin/main)"
  if (( ahead_count > 0 )); then
    print -r -- "local branch is already $ahead_count commit(s) ahead of origin/main; resolve the migration/push backlog manually before enabling automatic publication"
    exit 1
  fi
  if (( behind_count > 0 )); then
    if ! "$GIT_BIN" -C "$SITE_DIR" merge --ff-only origin/main; then
      print -r -- "local branch cannot fast-forward to origin/main; refusing automatic publication"
      exit 1
    fi
  fi
fi

QUANTUM_ZOTERO_BASELINE_FILENAME="last-research-snapshot.json" \
  "$NODE_BIN" "$ZOTERO_SCANNER" "$STATE_DIR"

base_head="$($GIT_BIN -C "$SITE_DIR" rev-parse HEAD)"
report_tmp="$STATE_DIR/reports/.${TODAY}.$$"
report_final="$STATE_DIR/reports/${TODAY}.md"
"$NODE_BIN" "$TRIAGE_REPORTER" "$STATE_DIR" "$SITE_DIR" > "$report_tmp"

codex_report_tmp="$STATE_DIR/reports/.${TODAY}.$$-codex.md"
if ! "$CODEX_BIN" exec \
  --model "$CODEX_MODEL" \
  --cd "$SITE_DIR" \
  --sandbox workspace-write \
  --ephemeral \
  --color never \
  --add-dir "$WORKSPACE_DIR/work" \
  --add-dir "$STATE_DIR" \
  --output-last-message "$codex_report_tmp" \
  < "$DAILY_PROMPT"; then
  /bin/rm -f "$report_tmp" "$codex_report_tmp"
  print -r -- "Codex CLI research failed; leaving the date checkpoint unchanged for retry"
  exit 1
fi

if [[ ! -s "$codex_report_tmp" ]]; then
  /bin/rm -f "$report_tmp" "$codex_report_tmp"
  print -r -- "Codex CLI returned an empty research report"
  exit 1
fi

if [[ "$($GIT_BIN -C "$SITE_DIR" rev-parse HEAD)" != "$base_head" ]]; then
  /bin/rm -f "$report_tmp" "$codex_report_tmp"
  print -r -- "Codex changed Git history; refusing publication"
  exit 1
fi

unexpected_status=""
status_output="$($GIT_BIN -C "$SITE_DIR" status --porcelain --untracked-files=all)"
while IFS= read -r status_line; do
  [[ -z "$status_line" ]] && continue
  changed_path="${status_line[4,-1]}"
  case "$changed_path" in
    data.js|author-index.js|source-locations.js|experimental-conditions.js|.DS_Store) ;;
    *) unexpected_status+="$status_line\n" ;;
  esac
done <<< "$status_output"
if [[ -n "$unexpected_status" ]]; then
  /bin/rm -f "$report_tmp" "$codex_report_tmp"
  print -r -- "Codex changed files outside the automatic data allowlist; refusing publication"
  print -r -- "$unexpected_status"
  exit 1
fi

report_with_header="$STATE_DIR/reports/.${TODAY}.$$.md"
{
  print -r -- "# Quantum-storage-review research scan — $TODAY"
  print -r -- ""
  print -r -- "This report was generated by Codex CLI model $CODEX_MODEL. Automatic publication is enabled only after validation; the report records the exact run."
  print -r -- ""
  /bin/cat "$report_tmp"
  print -r -- ""
  print -r -- "## Codex CLI evidence review"
  print -r -- ""
  /bin/cat "$codex_report_tmp"
} > "$report_with_header"
/bin/mv -f "$report_with_header" "$report_final"

"$NODE_BIN" "$AUTOMATION_DIR/validate_site_data.mjs" "$SITE_DIR"

data_changed=0
for data_file in data.js author-index.js source-locations.js experimental-conditions.js; do
  if ! "$GIT_BIN" -C "$SITE_DIR" diff --quiet HEAD -- "$data_file"; then
    data_changed=1
    break
  fi
done

if (( data_changed == 1 )); then
  "$NODE_BIN" "$AUTOMATION_DIR/update-site-date.mjs" "$TODAY" "$SITE_DIR"
  "$NODE_BIN" "$AUTOMATION_DIR/validate_site_data.mjs" "$SITE_DIR"
fi

if (( AUTO_PUSH == 1 )); then
  final_status="$($GIT_BIN -C "$SITE_DIR" status --porcelain --untracked-files=all | /usr/bin/grep -v '^?? \.DS_Store$' || true)"
  if [[ -n "$final_status" ]]; then
    "$GIT_BIN" -C "$SITE_DIR" add -- data.js author-index.js source-locations.js experimental-conditions.js index.html 3d.html
    if ! "$GIT_BIN" -C "$SITE_DIR" diff --cached --quiet; then
      "$GIT_BIN" -C "$SITE_DIR" commit -m "Automated Codex research update $TODAY"
      "$GIT_BIN" -C "$SITE_DIR" push origin main
    fi
  fi
else
  print -r -- "automatic publication disabled for this invocation; review the working-tree diff manually"
fi

/bin/rm -f "$report_tmp" "$codex_report_tmp"

snapshot_tmp="$STATE_DIR/zotero/.last-research-snapshot.$$"
/bin/cp "$STATE_DIR/zotero/current-snapshot.json" "$snapshot_tmp"
/bin/mv -f "$snapshot_tmp" "$BASELINE_SNAPSHOT"
date_tmp="$STATE_DIR/.last-research-date.$$"
print -r -- "$TODAY" > "$date_tmp"
/bin/mv -f "$date_tmp" "$LAST_RESEARCH_DATE"
print -r -- "[$TODAY] updater completed; report=$report_final auto_push=$AUTO_PUSH"
