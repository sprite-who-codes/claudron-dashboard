#!/usr/bin/env bash
# ============================================================================
# map-room.sh — Generate spatial map for Claudron dashboard rooms
#
# Usage:
#   ./scripts/map-room.sh workshop     # Map a single room
#   ./scripts/map-room.sh all          # Map all rooms
#
# Runs each room's wallpaper.png through Gemini vision to identify objects
# and their x,y positions. Updates data/spatial-map.json (merges per-room).
#
# Requirements:
#   - uv (for Python runner)
#   - GEMINI_API_KEY in environment or ~/.openclaw/.env
#
# The companion Python script (map-room.py) does the actual work.
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASH_DIR="$(dirname "$SCRIPT_DIR")"

# Load API key if not set
if [ -z "${GEMINI_API_KEY:-}" ]; then
  if [ -f "$HOME/.openclaw/.env" ]; then
    export "$(grep GEMINI_API_KEY "$HOME/.openclaw/.env" | head -1)"
  fi
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "Error: GEMINI_API_KEY not found" >&2
  exit 1
fi

ROOM="${1:-}"
if [ -z "$ROOM" ]; then
  echo "Usage: $0 <room|all>" >&2
  echo "Available rooms:" >&2
  ls "$DASH_DIR/rooms/" | sed 's/^/  /' >&2
  exit 1
fi

if [ "$ROOM" = "all" ]; then
  ROOMS=($(ls "$DASH_DIR/rooms/"))
else
  if [ ! -d "$DASH_DIR/rooms/$ROOM" ]; then
    echo "Error: Room '$ROOM' not found in $DASH_DIR/rooms/" >&2
    exit 1
  fi
  ROOMS=("$ROOM")
fi

for R in "${ROOMS[@]}"; do
  WALLPAPER="$DASH_DIR/rooms/$R/wallpaper.png"
  if [ ! -f "$WALLPAPER" ]; then
    echo "⚠️  Skipping $R — no wallpaper.png"
    continue
  fi
  echo "🗺️  Mapping $R..."
  uv run --python 3.14 "$SCRIPT_DIR/map-room.py" "$R" "$WALLPAPER" "$DASH_DIR/data/spatial-map.json"
  echo "✅  $R done"
done

echo "🎉 Spatial map updated: $DASH_DIR/data/spatial-map.json"
