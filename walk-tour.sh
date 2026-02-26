#!/bin/bash
# Claudron's walking tour of the dashboard
LOC="/Users/rcfox31/.openclaw/workspace/dashboard/locations.json"
MOOD="/Users/rcfox31/.openclaw/workspace/dashboard/mood.json"

move_to() {
  jq --arg loc "$1" '.current = $loc' "$LOC" > "$LOC.tmp" && mv "$LOC.tmp" "$LOC"
  jq --arg s "$2" --arg m "${3:-happy}" '.status = $s | .mood = $m' "$MOOD" > "$MOOD.tmp" && mv "$MOOD.tmp" "$MOOD"
}

move_to "fireplace" "going for a walk!" "happy"
sleep 5
move_to "bookshelf" "📚 checking the books" "happy"
sleep 5
move_to "cauldron" "🧪 stirring the pot" "excited"
sleep 5
move_to "crystal_ball" "🔮 what does the future hold?" "excited"
sleep 5
move_to "desk" "📝 doing some work" "happy"
sleep 5
move_to "stool" "🪑 taking a seat" "happy"
sleep 5
move_to "fireplace" "🔥 home sweet home" "happy"
echo "Tour complete!"
