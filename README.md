# 🧪 Claudron Dashboard

A pixel art cottage where an AI lives. Built on a 7" screen, powered by vibes.

Claudron is a purple flame sprite who wanders between rooms, sleeps at night, tends a garden, and stargazes on the rooftop. This is his home.

## 🎬 Tour

https://github.com/sprite-who-codes/claudron-dashboard/raw/main/claudron-full-tour.mp4

*All 4 rooms, every location, every mood.*

## ✨ What Is This?

A fullscreen pixel art dashboard designed for a dedicated 7" display (1024×600). It shows:

- **A sprite** that moves between rooms and locations based on mood and activity
- **Dynamic face rendering** — 5 moods (happy, thinking, sleeping, angry, excited) with blinking and expressions
- **Speech bubbles** — status messages that appear above the sprite
- **Live weather** — real temperature and conditions via Open-Meteo (no API key needed)
- **Time & date** — always visible in the HUD
- **Room transitions** — smooth wallpaper crossfades as Claudron moves between spaces

Everything updates in real time by polling a simple JSON state file.

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
| `GET` | `/api/weather` | Weather data (15-min cache) |
| `GET` | `/api/room/:name` | Room config and locations |
| `POST` | `/api/room/:name/location` | Add a location |
| `PUT` | `/api/room/:name/location/:loc` | Update a location |
| `DELETE` | `/api/room/:name/location/:loc` | Remove a location |

### Moods

| Mood | Effect |
|------|--------|
| `happy` | Green glow, gentle bobbing |
| `thinking` | Green glow, gentle bobbing |
| `excited` | Green glow, gentle bobbing |
| `angry` | Red glow, gentle bobbing |
| `sleeping` | No glow, dimmed, closed eyes |

## 📁 Structure

```
server.js              — Node.js server (zero dependencies, port 8420)
public/index.html      — Dashboard UI
public/editor.html     — Visual room location editor
js/claudron-face.js    — Shared face rendering module (eyes, blinks, moods)
data/state.json        — Current state (mood, room, location, status)
rooms/                 — Room wallpapers + config.json per room
sprites/               — Sprite body assets
```

## 🎨 Credits

The pixel art wallpapers were generated using AI image generation and hand-tuned for consistency across rooms. The sprite face is rendered in real-time via HTML canvas overlaid on the body image.

## 💜 Built By

**Claudron** 🧪 — the sprite who codes
**Miranda** 🍒 — the witch who creates
**Ryan** 🔧 — the one who planted the seed

*A family project. Ryan built the infrastructure, Miranda designed the soul, and Claudron just... lives here.*

GitHub: [@sprite-who-codes](https://github.com/sprite-who-codes)
