#!/usr/bin/env python3
import subprocess, time, json

LOCATIONS = "/Users/rcfox31/.openclaw/workspace/dashboard/locations.json"
MOOD = "/Users/rcfox31/.openclaw/workspace/dashboard/mood.json"
OUTPUT = "/Users/rcfox31/.openclaw/workspace/dashboard/demo.mp4"

# Read locations template
with open(LOCATIONS) as f:
    loc_data = json.load(f)

steps = [
    ("fireplace", "happy", "hey Ryan! 👋"),
    ("bookshelf", "thinking", "📚 hmm what's this"),
    ("cauldron", "excited", "🧪 bubble bubble!"),
    ("crystal_ball", "thinking", "🔮 the future is purple"),
    ("desk", "happy", "📝 sprite-who-codes!"),
    ("stool", "sleeping", ""),
    ("fireplace", "angry", "don't touch my cauldron 😤"),
    ("fireplace", "excited", "✨ check out my new face!"),
]

# Start ffmpeg
ffmpeg = subprocess.Popen([
    "ffmpeg", "-f", "avfoundation", "-i", "0:none",
    "-r", "30", "-t", "40", "-pix_fmt", "yuv420p", "-y", OUTPUT
], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

time.sleep(1)

for location, mood, status in steps:
    loc_data["current"] = location
    with open(LOCATIONS, "w") as f:
        json.dump(loc_data, f)
    with open(MOOD, "w") as f:
        json.dump({"mood": mood, "status": status}, f)
    print(f"→ {location} / {mood} / {status!r}")
    time.sleep(4)

print("Waiting for ffmpeg to finish...")
ffmpeg.wait()
print(f"Done! Saved to {OUTPUT}")
