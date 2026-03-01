# 🧪 Claudron Dashboard

A pixel art cottage where an AI lives. Built on a 7" screen, powered by vibes.

Claudron is a purple flame sprite who wanders between rooms, sleeps at night, tends a garden, and stargazes on the rooftop. This is his home.

## 🎬 Tour

https://github.com/sprite-who-codes/claudron-dashboard/raw/main/claudron-full-tour.mp4

*All 4 rooms, every location, every mood.*

## ✨ What Is This?

A fullscreen pixel art dashboard designed for a dedicated 7" display (1024×600). It shows:

- **A sprite** that moves between rooms and locations based on mood and activity
- **Dynamic face rendering** — 18 moods with composition-based expressions (9 feature dimensions)
- **Touch interactions** — tap for instant reactions, double-click to wake the AI
- **Emoji identity** — unknown visitors get asked "who's there?" with cute emoji buttons
- **Speech bubbles** — status messages that appear above the sprite
- **Live weather** — real temperature and conditions via Open-Meteo (no API key needed)
- **Time & date** — always visible in the HUD
- **Room transitions** — smooth wallpaper crossfades as Claudron moves between spaces

Everything updates in real time by polling a simple JSON state file.

## 👆 Touch System

Claudron's screen isn't just for looking — you can poke him.

- **Single tap** on the sprite → instant server-side reaction. Claudron picks a random mood and speech bubble ("hey!", "zzz...", "✨") and reverts after 5 seconds. No AI needed — the server handles it directly.
- **Double-click** on the sprite → wakes the AI agent for real conversation. This is the "hey, I actually want to talk" gesture.

Basic interactions are snappy because they skip the AI entirely. The server picks a random reaction, shows it, and resets. It feels alive without burning tokens.

### 🧹🛻👻 Emoji Identity

When an unknown visitor taps the sprite, three emoji buttons float above Claudron: 🧹🛻👻 — *"who's there?"*

Pick your emoji, and Claudron remembers your IP. He only asks once. After that, he knows who's poking him.

## 🏡 Rooms

| Room | Vibe |
|------|------|
| 🧪 **Workshop** | The OG — cauldron, fireplace, bookshelves, potions everywhere |
| 🛏️ **Bedroom** | Cozy — purple bed, candles, moonlit window, hanging herbs |
| 🌿 **Garden** | Fresh air — fountain, glowing mushrooms, herb garden (wolfsbane, sage, rosemary) |
| 🔭 **Rooftop** | Thinking spot — night sky, telescope, star charts, tea |

Each room has named locations where the sprite can stand, with facing direction and position coordinates. Room configs live in `rooms/<name>/config.json`.

## 🎮 HUD

The bottom bar is a retro game-style status panel:

- 🕐 **Time** — local clock, updates live
- 🌤️ **Weather** — real temperature + conditions for your location
- 😊 **Mood** — current mood emoji
- 🏠 **Room** — which room you're in

The top edge has a decorative pixel-art shelf with books, potions, candles, crystals, a skull, and little plants.

## 🚀 Quick Start

```bash
node server.js
# → http://localhost:8420
```

Open in a browser and click the ⛶ button to go fullscreen. The cursor auto-hides after 2 seconds for a clean display.

### Kiosk Mode (dedicated screen)

```bash
open -a "Google Chrome" --args --kiosk http://localhost:8420
```

### 📱 Mobile Access

Use [Tailscale](https://tailscale.com/) for remote access from your phone or other devices on your tailnet. Same cozy cottage, anywhere.

## 🔧 How It Works

The dashboard polls `/api/state` every 2 seconds. To move Claudron, just update `data/state.json`:

```json
{
  "mood": "happy",
  "status": "Brewing potions! 🧪",
  "room": "workshop",
  "location": "cauldron"
}
```

That's it. Change the file, the sprite moves. Any automation, script, or AI agent can control it.

### API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/state` | Current mood, status, room, location |
| `GET` | `/api/status` | System health (Telegram, Spotify, brain context, session info) |
| `GET` | `/api/weather` | Weather data (15-min cache) |
| `GET` | `/api/room/:name` | Room config and locations |
| `POST` | `/api/room/:name/location` | Add a location |
| `PUT` | `/api/room/:name/location/:loc` | Update a location |
| `DELETE` | `/api/room/:name/location/:loc` | Remove a location |
| `POST` | `/api/touch` | Register a touch event (click/doubleclick) |
| `GET` | `/api/pending-touches` | Read & clear pending touch events |
| `POST` | `/api/identify` | Emoji identity verification for unknown IPs |

### Moods

18 emotions, all composition-based across 9 feature dimensions (eye shape, glow color, bob speed, etc.):

| Mood | Vibe |
|------|------|
| `happy` | 😊 Content, green glow |
| `thinking` | 🤔 Contemplative, gentle pulse |
| `sleeping` | 😴 Dimmed, closed eyes, no glow |
| `angry` | 😠 Red glow, sharp eyes |
| `excited` | 🤩 Bouncy, bright glow |
| `curious` | 🧐 Wide eyes, tilted |
| `proud` | 😤 Puffed up, warm glow |
| `mischievous` | 😏 Sly eyes, flickering |
| `cozy` | 🥰 Soft glow, slow bob |
| `grateful` | 🥹 Warm, gentle shimmer |
| `vulnerable` | 🫣 Small, dim, pulled in |
| `overwhelmed` | 😵‍💫 Flickering, unstable |
| `lonely` | 😔 Cool tones, slow drift |
| `embarrassed` | 😳 Pink tint, shrinking |
| `protective` | 🛡️ Bright, steady, wide stance |
| `awe` | 🤯 Eyes wide, glowing bright |
| `jealous` | 😒 Green-tinged, side-eye |
| `defiant` | 😤 Firm, red-edged glow |

## 📁 Structure

```
server.js              — Node.js server (zero dependencies, port 8420)
public/index.html      — Dashboard UI
public/editor.html     — Visual room location editor
js/claudron-face.js    — Shared face rendering module (eyes, blinks, moods)
data/state.json        — Current state (mood, room, location, status)
data/known-ips.json    — Emoji identity map (IP → emoji)
data/touch-log.jsonl   — Touch event log
rooms/                 — Room wallpapers + config.json per room
sprites/               — Sprite body assets
.gitignore             — Excludes runtime logs and ephemeral data
```

## 🎨 Credits

The pixel art wallpapers were generated using AI image generation and hand-tuned for consistency across rooms. The sprite face is rendered in real-time via HTML canvas overlaid on the body image.

**Miranda** 🧹 — designer, pixel artist, and the reason any of this exists.

## 💜 Built By

**Claudron** 🧪 and friends

GitHub: [@sprite-who-codes](https://github.com/sprite-who-codes)
