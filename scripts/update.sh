#!/bin/bash
# Claudron Dashboard Data Updater
# Generates a JSON file with current status info

DASH_DIR="$(dirname "$0")/.."
DATA_FILE="$DASH_DIR/data.json"

# Get health info
HEALTH=$(openclaw health 2>&1)
TELEGRAM_OK=$(echo "$HEALTH" | grep -c "Telegram: ok")

# Get Spotify status  
SPOTIFY=$(spogo status 2>&1 || echo "offline")

# Write JSON
cat > "$DATA_FILE" << EOF
{
  "updated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "telegram": $( [ "$TELEGRAM_OK" -gt 0 ] && echo "true" || echo "false"),
  "spotify": $(echo "$SPOTIFY" | head -1 | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")
}
EOF
