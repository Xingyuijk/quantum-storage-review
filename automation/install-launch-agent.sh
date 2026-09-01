#!/bin/zsh
set -euo pipefail

SCRIPT_PATH="${0:A}"
SITE_DIR="${SCRIPT_PATH:h:h}"
PLIST_SOURCE="$SITE_DIR/automation/com.xingyuijk.quantum-storage-review.plist"
PLIST_TARGET="${HOME}/Library/LaunchAgents/com.xingyuijk.quantum-storage-review.plist"
LABEL="com.xingyuijk.quantum-storage-review"
UID_VALUE="$(/usr/bin/id -u)"
AUTOMATION_STATE_DIR="${QUANTUM_STORAGE_AUTOMATION_STATE:-$SITE_DIR/../automation-state}"

/bin/mkdir -p "${HOME}/Library/LaunchAgents" "${HOME}/Library/Logs" "$AUTOMATION_STATE_DIR/logs"
/usr/bin/plutil -lint "$PLIST_SOURCE"

if /bin/launchctl print "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1; then
  /bin/launchctl bootout "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1 || true
fi

/bin/cp -p "$PLIST_SOURCE" "$PLIST_TARGET"
/usr/bin/plutil -lint "$PLIST_TARGET"
/bin/launchctl bootstrap "gui/$UID_VALUE" "$PLIST_TARGET"
/bin/launchctl print "gui/$UID_VALUE/$LABEL"
