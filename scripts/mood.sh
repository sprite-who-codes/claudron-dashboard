#!/bin/bash
# Quick mood setter for Claudron
# Usage: ./mood.sh <mood> [status message]
# Example: ./mood.sh happy "hey! 👋"
#          ./mood.sh sleeping

MOOD_FILE="$(dirname "$0")/../mood.json"
VALID_MOODS="happy thinking sleeping angry excited"

mood="${1:-happy}"
shift
status="${*:-}"

if ! echo "$VALID_MOODS" | grep -qw "$mood"; then
  echo "Invalid mood: $mood"
  echo "Valid moods: $VALID_MOODS"
  exit 1
fi

echo "{\"mood\":\"$mood\",\"status\":\"$status\"}" > "$MOOD_FILE"
echo "🧪 Mood set to: $mood $([ -n "$status" ] && echo "— \"$status\"")"
