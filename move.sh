#!/bin/bash
# Quick location mover for Claudron
# Usage: ./move.sh <location>
# Example: ./move.sh cauldron
#          ./move.sh desk

LOC_FILE="$(dirname "$0")/locations.json"
VALID_LOCS="bookshelf fireplace cauldron crystal_ball desk stool"

loc="${1:-}"

if [ -z "$loc" ]; then
  echo "Usage: ./move.sh <location>"
  echo "Locations: $VALID_LOCS"
  exit 1
fi

if ! echo "$VALID_LOCS" | grep -qw "$loc"; then
  echo "Invalid location: $loc"
  echo "Valid locations: $VALID_LOCS"
  exit 1
fi

python3 -c "
import json
with open('$LOC_FILE') as f:
    d = json.load(f)
d['current'] = '$loc'
with open('$LOC_FILE', 'w') as f:
    json.dump(d, f)
"

echo "🧪 Moved to: $loc"
