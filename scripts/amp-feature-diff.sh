#!/usr/bin/env bash
set -euo pipefail

# Snapshots `amp --help` (and subcommands) and diffs against the previous snapshot.
# Usage: ./scripts/amp-feature-diff.sh
#
# Snapshots are timestamped and stored in .amp-snapshots/ (gitignored).
# A symlink `latest.txt` always points to the most recent snapshot.

SNAPSHOT_DIR="$(cd "$(dirname "$0")/.." && pwd)/.amp-snapshots"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
VERSION=$(amp --version 2>&1 | head -1 || echo "unknown")
SNAPSHOT="$SNAPSHOT_DIR/${TIMESTAMP}.txt"
LATEST_LINK="$SNAPSHOT_DIR/latest.txt"

mkdir -p "$SNAPSHOT_DIR"

# Build current snapshot
{
  echo "# Amp CLI Feature Snapshot"
  echo "# Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# Version: $VERSION"
  echo ""
  echo "=== amp --version ==="
  echo "$VERSION"
  echo ""
  echo "=== amp --help ==="
  amp --help 2>&1 || true
  echo ""
  for cmd in threads tools tasks review skill permissions mcp usage; do
    echo "=== amp $cmd --help ==="
    amp "$cmd" --help 2>&1 || true
    echo ""
  done
  for sub in new continue list search share rename archive delete handoff markdown replay; do
    echo "=== amp threads $sub --help ==="
    amp threads "$sub" --help 2>&1 || true
    echo ""
  done
  for sub in list show make use; do
    echo "=== amp tools $sub --help ==="
    amp tools "$sub" --help 2>&1 || true
    echo ""
  done
  for sub in add list remove doctor approve; do
    echo "=== amp mcp $sub --help ==="
    amp mcp "$sub" --help 2>&1 || true
    echo ""
  done
} > "$SNAPSHOT"

# Find previous snapshot (the current latest, before we update the symlink)
PREVIOUS=""
if [ -L "$LATEST_LINK" ]; then
  PREVIOUS=$(readlink "$LATEST_LINK")
  # Handle relative symlinks
  if [[ "$PREVIOUS" != /* ]]; then
    PREVIOUS="$SNAPSHOT_DIR/$PREVIOUS"
  fi
fi

# Update latest symlink
ln -sf "$(basename "$SNAPSHOT")" "$LATEST_LINK"

if [ -n "$PREVIOUS" ] && [ -f "$PREVIOUS" ]; then
  if diff -u "$PREVIOUS" "$SNAPSHOT" > "$SNAPSHOT_DIR/diff.txt" 2>&1; then
    echo "✅ No changes since $(basename "$PREVIOUS" .txt)"
    # No changes — remove duplicate snapshot
    rm "$SNAPSHOT"
    ln -sf "$(basename "$PREVIOUS")" "$LATEST_LINK"
  else
    echo "🔄 Changes detected! ($VERSION)"
    echo "   Previous: $(basename "$PREVIOUS")"
    echo "   Current:  $(basename "$SNAPSHOT")"
    echo "   Diff:     .amp-snapshots/diff.txt"
    echo ""
    cat "$SNAPSHOT_DIR/diff.txt"
  fi
else
  echo "📸 First snapshot saved: $(basename "$SNAPSHOT") ($VERSION)"
  echo "   Run again later to see diffs."
fi

# Show snapshot count
COUNT=$(find "$SNAPSHOT_DIR" -name '*.txt' ! -name 'latest.txt' ! -name 'diff.txt' | wc -l | tr -d ' ')
echo ""
echo "📁 $COUNT snapshot(s) in .amp-snapshots/"
