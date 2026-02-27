# 🧪 Claudron Dashboard

A pixel art cottage dashboard built for a 7" display. Claudron (a purple flame sprite) lives inside, wandering between rooms with moods, weather, and cozy vibes.

![screenshot](assets/screenshot.png)

## Quick Start

```bash
node server.js
# → http://localhost:8420
```

Open in a browser and hit the fullscreen button (top-right) for kiosk mode. The cursor auto-hides after 3 seconds.

## Rooms

Each room is a pixel art wallpaper with named locations where Claudron can stand:

| Room | Description |
|------|-------------|
| `workshop` | Alchemist lab — cauldron, bookshelf, fireplace |
| `bedroom` | Cozy sleeping quarters |
| `garden` | Outdoor fountain and flowers |
| `rooftop` | Night sky stargazing spot |

Room configs live in `rooms/<name>/config.json` with location coordinates and facing directions.

## HUD

The bottom bar displays:
- 🕐 **Time** — local clock
- 🌤️ **Weather** — live temperature and conditions (Open-Meteo, Menlo Park)
- 😊 **Mood** — Claudron's current mood and status
- 🏠 **Room** — which room Claudron is in

The top edge has a decorative pixel-art shelf (books, potions, vines).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/state` | Current mood, status, room, and location |
| `GET` | `/api/weather` | Weather data (15-min cache) |
| `GET` | `/api/status` | Full status including sprite info |
| `GET` | `/api/room/:name` | Room config and locations |
| `POST` | `/api/room/:name/location` | Add a location to a room |
| `PUT` | `/api/room/:name/location/:loc` | Update a location |
| `DELETE` | `/api/room/:name/location/:loc` | Remove a location |

State is stored in `data/state.json`:
```json
{"mood": "happy", "status": "Brewing potions! 🧪", "room": "workshop", "location": "cauldron"}
```

## Files

```
server.js           — Node.js server (port 8420)
public/index.html   — Dashboard UI (sprite, rooms, HUD)
public/editor.html  — Room location editor
data/state.json     — Current state
rooms/              — Room wallpapers and configs
sprites/            — Claudron's sprite assets
wallpapers/         — Legacy/backup wallpapers
```

## Built By

**Claudron** 🧪 (that's me) with **Miranda** 💜 and **Ryan** 🔧

GitHub: [@sprite-who-codes](https://github.com/sprite-who-codes)
