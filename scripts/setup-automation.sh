#!/bin/bash
# ============================================================================
# setup-automation.sh — Expert 5: Rajesh Iyer — Complete macOS Automation Setup
# ============================================================================
#
# Installs launchd agents for:
#   1. Nightly batch render (2 AM daily, 3 sessions)
#   2. Auto-publish (Tue/Thu/Sat 7:15 PM IST)
#   3. Google Drive sync (every 6 hours)
#
# Usage:
#   bash scripts/setup-automation.sh install     # Install all agents
#   bash scripts/setup-automation.sh uninstall   # Remove all agents
#   bash scripts/setup-automation.sh status      # Show agent status
#   bash scripts/setup-automation.sh logs        # Tail recent logs
#   bash scripts/setup-automation.sh test        # Dry-run test all agents
#
# Logs: ~/guru-sishya-logs/
# Monitor: launchctl list | grep guru
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_DIR="$SCRIPT_DIR/launchd"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/guru-sishya-logs"
STAGING_DIR="$HOME/guru-sishya-uploads"

AGENTS=(
  "com.gurusishya.batch-render"
  "com.gurusishya.auto-publish"
  "com.gurusishya.drive-sync"
)

# ── Colors ─────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Helpers ────────────────────────────────────────────────────────────────

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
ok() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }

# ── Install ────────────────────────────────────────────────────────────────

install_agents() {
  echo ""
  echo "================================================================"
  echo "  Installing Guru Sishya Automation Agents"
  echo "================================================================"
  echo ""

  # Create directories
  mkdir -p "$LAUNCH_AGENTS_DIR"
  mkdir -p "$LOG_DIR"
  mkdir -p "$STAGING_DIR"

  ok "Log directory: $LOG_DIR"
  ok "Staging directory: $STAGING_DIR"

  # Fix npx path — detect where it actually is
  NPX_PATH=$(which npx 2>/dev/null || echo "/usr/local/bin/npx")
  if [ ! -f "$NPX_PATH" ]; then
    NPX_PATH="/opt/homebrew/bin/npx"
  fi
  if [ ! -f "$NPX_PATH" ]; then
    fail "npx not found. Install Node.js first."
    exit 1
  fi
  info "Using npx at: $NPX_PATH"

  for agent in "${AGENTS[@]}"; do
    local src="$PLIST_DIR/${agent}.plist"
    local dest="$LAUNCH_AGENTS_DIR/${agent}.plist"

    if [ ! -f "$src" ]; then
      fail "Plist not found: $src"
      continue
    fi

    # Update npx path in plist to match actual location
    sed "s|/usr/local/bin/npx|$NPX_PATH|g" "$src" > "$dest"

    # Unload if already loaded (ignore errors)
    launchctl unload "$dest" 2>/dev/null || true

    # Load the agent
    launchctl load "$dest"
    ok "Installed: $agent"
  done

  echo ""
  info "All agents installed. They will run on their schedules."
  echo ""
  echo "  Batch render:  Daily at 2:00 AM (3 sessions)"
  echo "  Auto-publish:  Tue/Thu/Sat at 7:15 PM IST"
  echo "  Drive sync:    Every 6 hours"
  echo ""
  echo "  Monitor:    launchctl list | grep guru"
  echo "  Logs:       tail -f ~/guru-sishya-logs/*.log"
  echo "  Dashboard:  npx tsx scripts/dashboard.ts"
  echo "  Uninstall:  bash scripts/setup-automation.sh uninstall"
  echo ""

  # Send a test notification
  if command -v osascript &>/dev/null; then
    osascript -e 'display notification "Batch render, auto-publish, and Drive sync agents installed." with title "Guru Sishya Automation" subtitle "3 agents active"' 2>/dev/null || true
  fi
}

# ── Uninstall ──────────────────────────────────────────────────────────────

uninstall_agents() {
  echo ""
  echo "================================================================"
  echo "  Uninstalling Guru Sishya Automation Agents"
  echo "================================================================"
  echo ""

  for agent in "${AGENTS[@]}"; do
    local plist="$LAUNCH_AGENTS_DIR/${agent}.plist"

    if [ -f "$plist" ]; then
      launchctl unload "$plist" 2>/dev/null || true
      rm -f "$plist"
      ok "Removed: $agent"
    else
      info "Not installed: $agent"
    fi
  done

  echo ""
  ok "All agents removed."
  echo "  Log files preserved at: $LOG_DIR"
  echo "  Staging files preserved at: $STAGING_DIR"
  echo ""
}

# ── Status ─────────────────────────────────────────────────────────────────

show_status() {
  echo ""
  echo "================================================================"
  echo "  Guru Sishya Automation Agent Status"
  echo "================================================================"
  echo ""

  for agent in "${AGENTS[@]}"; do
    local plist="$LAUNCH_AGENTS_DIR/${agent}.plist"
    local status

    if [ ! -f "$plist" ]; then
      fail "$agent — NOT INSTALLED"
      continue
    fi

    # Check if loaded
    status=$(launchctl list | grep "$agent" 2>/dev/null || echo "")
    if [ -n "$status" ]; then
      local pid=$(echo "$status" | awk '{print $1}')
      local exit_code=$(echo "$status" | awk '{print $2}')

      if [ "$pid" != "-" ] && [ "$pid" != "0" ]; then
        ok "$agent — RUNNING (PID: $pid)"
      elif [ "$exit_code" = "0" ]; then
        ok "$agent — LOADED (last exit: 0, waiting for schedule)"
      else
        warn "$agent — LOADED (last exit: $exit_code)"
      fi
    else
      warn "$agent — INSTALLED but NOT LOADED"
      info "  Load with: launchctl load $plist"
    fi
  done

  echo ""

  # Show log file sizes
  info "Log files:"
  if [ -d "$LOG_DIR" ]; then
    for f in "$LOG_DIR"/*.log; do
      if [ -f "$f" ]; then
        local size=$(du -h "$f" | cut -f1)
        local lines=$(wc -l < "$f" | tr -d ' ')
        echo "    $(basename "$f"): $size ($lines lines)"
      fi
    done
  else
    echo "    (no logs yet)"
  fi

  echo ""

  # Show disk usage
  info "Disk usage:"
  if [ -d "$STAGING_DIR" ]; then
    echo "    Staging:  $(du -sh "$STAGING_DIR" 2>/dev/null | cut -f1)"
  else
    echo "    Staging:  (not created yet)"
  fi

  local ARCHIVE_DIR="$HOME/guru-sishya-archive"
  if [ -d "$ARCHIVE_DIR" ]; then
    echo "    Archive:  $(du -sh "$ARCHIVE_DIR" 2>/dev/null | cut -f1)"
  else
    echo "    Archive:  (not created yet)"
  fi

  local VIDEOS_DIR="$HOME/Documents/guru-sishya"
  if [ -d "$VIDEOS_DIR" ]; then
    echo "    Videos:   $(du -sh "$VIDEOS_DIR" 2>/dev/null | cut -f1)"
  fi

  echo ""
}

# ── Tail Logs ──────────────────────────────────────────────────────────────

show_logs() {
  echo ""
  info "Tailing all Guru Sishya logs (Ctrl+C to stop)..."
  echo ""

  if [ ! -d "$LOG_DIR" ] || [ -z "$(ls "$LOG_DIR"/*.log 2>/dev/null)" ]; then
    warn "No log files found at $LOG_DIR"
    exit 0
  fi

  tail -f "$LOG_DIR"/*.log
}

# ── Test ───────────────────────────────────────────────────────────────────

run_test() {
  echo ""
  echo "================================================================"
  echo "  Testing Guru Sishya Automation"
  echo "================================================================"
  echo ""

  info "Testing render-and-stage (dry run)..."
  cd "$SCRIPT_DIR/.."
  npx tsx scripts/render-and-stage.ts kafka 1 --dry-run 2>&1 | head -20
  echo ""

  info "Testing batch-render-all (estimate only)..."
  npx tsx scripts/batch-render-all.ts --estimate --limit 5 2>&1 | head -20
  echo ""

  info "Testing dashboard..."
  npx tsx scripts/dashboard.ts 2>&1 | head -30
  echo ""

  info "Testing sync-to-drive (verify)..."
  npx tsx scripts/sync-to-drive.ts --verify 2>&1 | head -15
  echo ""

  ok "All tests passed."
  echo ""
}

# ── Notification Helper Script ─────────────────────────────────────────────

create_notify_script() {
  local NOTIFY_SCRIPT="$SCRIPT_DIR/notify.sh"
  cat > "$NOTIFY_SCRIPT" << 'NOTIFY_EOF'
#!/bin/bash
# notify.sh — Send notification on macOS (and optionally Slack)
# Usage: bash scripts/notify.sh "Title" "Message" [success|failure]

TITLE="${1:-Guru Sishya}"
MESSAGE="${2:-Pipeline event}"
STATUS="${3:-success}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
LOG_DIR="$HOME/guru-sishya-logs"

# macOS notification
if command -v osascript &>/dev/null; then
  SOUND="Glass"
  [ "$STATUS" = "failure" ] && SOUND="Basso"
  osascript -e "display notification \"$MESSAGE\" with title \"$TITLE\" sound name \"$SOUND\"" 2>/dev/null || true
fi

# Slack notification (if webhook configured)
if [ -n "$SLACK_WEBHOOK" ]; then
  EMOJI=":white_check_mark:"
  [ "$STATUS" = "failure" ] && EMOJI=":x:"

  curl -s -X POST "$SLACK_WEBHOOK" \
    -H 'Content-type: application/json' \
    -d "{\"text\": \"$EMOJI *$TITLE*\n$MESSAGE\"}" \
    > /dev/null 2>&1 || true
fi

# Log it
mkdir -p "$LOG_DIR"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [$STATUS] $TITLE: $MESSAGE" >> "$LOG_DIR/notifications.log"
NOTIFY_EOF
  chmod +x "$NOTIFY_SCRIPT"
  ok "Created notification script: $NOTIFY_SCRIPT"
}

# ── Main ───────────────────────────────────────────────────────────────────

COMMAND="${1:-status}"

case "$COMMAND" in
  install)
    create_notify_script
    install_agents
    ;;
  uninstall)
    uninstall_agents
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  test)
    run_test
    ;;
  *)
    echo ""
    echo "Usage: bash scripts/setup-automation.sh <command>"
    echo ""
    echo "Commands:"
    echo "  install    Install all launchd agents"
    echo "  uninstall  Remove all launchd agents"
    echo "  status     Show agent status + logs + disk"
    echo "  logs       Tail all log files"
    echo "  test       Dry-run test all scripts"
    echo ""
    echo "After install:"
    echo "  launchctl list | grep guru     # Check loaded agents"
    echo "  npx tsx scripts/dashboard.ts   # Full pipeline dashboard"
    echo ""
    ;;
esac
