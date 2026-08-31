#!/bin/zsh
set -euo pipefail

SCRIPT_PATH="${0:A}"
SITE_DIR="${SCRIPT_PATH:h:h}"
NODE_BIN="${NODE_BIN:-/opt/homebrew/bin/node}"
GIT_BIN="${GIT_BIN:-/usr/bin/git}"

if [[ ! -d "$SITE_DIR/.git" ]]; then
  print -u2 -- "site Git repository is missing: $SITE_DIR"
  exit 1
fi
if [[ ! -x "$NODE_BIN" ]]; then
  print -u2 -- "Node executable is missing: $NODE_BIN"
  exit 1
fi

print -- "Validating canonical site: $SITE_DIR"
"$NODE_BIN" "$SITE_DIR/automation/validate_site_data.mjs" "$SITE_DIR"

print -- "Working-tree status:"
"$GIT_BIN" -C "$SITE_DIR" status --short --branch
print -- "Review the status above, then commit and push manually from this directory."

