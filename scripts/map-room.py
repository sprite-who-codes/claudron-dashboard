#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "google-genai>=1.0.0",
# ]
# ///
"""
Map a single room's wallpaper to a spatial object list using Gemini vision.
Called by map-room.sh. Updates the specified spatial-map.json file.

Usage: python map-room.py <room_name> <wallpaper_path> <spatial_map_path>
"""

import json
import os
import sys

from google import genai

PROMPT_TEMPLATE = """This is a pixel art {room_name} from a virtual pet dashboard. I need a spatial map of everything in this room. For each notable object or area, give me:
- "name": short identifier (lowercase, e.g. "cauldron", "left bookshelf")
- "description": a fun, in-character description (1 sentence, include an emoji)
- "x": approximate horizontal position as 0-1 from left edge
- "y": approximate vertical position as 0-1 from top edge

Be thorough — potions, furniture, books, tools, decorations, plants, everything you can identify.
Write descriptions as if a cute wizard character is describing their own stuff.

Return ONLY a JSON array, no markdown fences:
[{{"name": "...", "description": "...", "x": 0.XX, "y": 0.XX}}, ...]"""


def main():
    if len(sys.argv) != 4:
        print("Usage: map-room.py <room_name> <wallpaper_path> <spatial_map_path>", file=sys.stderr)
        sys.exit(1)

    room_name = sys.argv[1]
    wallpaper_path = sys.argv[2]
    map_path = sys.argv[3]

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    # Read image
    with open(wallpaper_path, "rb") as f:
        image_bytes = f.read()

    prompt = PROMPT_TEMPLATE.format(room_name=room_name)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            genai.types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
            prompt,
        ],
        config=genai.types.GenerateContentConfig(
            thinking_config=genai.types.ThinkingConfig(thinking_budget=0),
        ),
    )

    # Parse JSON from response
    text = response.text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[: text.rfind("```")]
        text = text.strip()

    objects = json.loads(text)

    # Validate structure
    for obj in objects:
        assert "name" in obj and "description" in obj and "x" in obj and "y" in obj, f"Bad object: {obj}"
        obj["x"] = round(float(obj["x"]), 2)
        obj["y"] = round(float(obj["y"]), 2)

    # Load existing map, update room, save
    spatial_map = {}
    if os.path.exists(map_path):
        with open(map_path) as f:
            spatial_map = json.load(f)

    spatial_map[room_name] = objects

    with open(map_path, "w") as f:
        json.dump(spatial_map, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"  Mapped {len(objects)} objects in {room_name}")


if __name__ == "__main__":
    main()
