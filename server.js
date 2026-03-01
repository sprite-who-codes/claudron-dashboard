/**
 * ============================================================================
 * File:     dashboard/server.js
 * Purpose:  Claudron Dashboard API Server
 *
 * A lightweight HTTP server that serves the dashboard static files and
 * provides REST APIs for managing Claudron's state, room configs, and
 * system status.
 *
 * Endpoints:
 *   GET  /api/state                          — Current mood, room, location, status
 *   GET  /api/status                         — System health (Telegram, Spotify, brain)
 *   GET  /api/room/:name                     — Room config (locations, wallpaper)
 *   PUT  /api/room/:name/location/:loc       — Update a location's properties
 *   POST /api/room/:name/location            — Create a new location
 *   DELETE /api/room/:name/location/:loc     — Remove a location
 *   POST /api/touch                          — Touch/click event from dashboard UI
 *   POST /api/identify                       — Emoji identity selection (who's there?)
 *   GET  /api/pending-touches                — Read & clear pending touch events (for agent)
 *   GET  /locations.json                     — Legacy: raw locations file
 *   POST /locations.json                     — Legacy: update current location
 *
 * Touch System:
 *   - Single tap on sprite → instant server-side reaction (random from pool),
 *     reverts to previous mood/status after 5 seconds. No agent involvement.
 *   - Double-click on sprite → fires an OpenClaw wake event so the agent
 *     responds personally. Throttled to 1 per 30s per user.
 *   - Pre-reaction state is saved so reverts restore the agent's last mood/status.
 *
 * Emoji Identity System:
 *   - Unknown IPs tapping the sprite see a "who's there?" prompt with 🧹🛻👻
 *   - Selection saves IP → identity mapping in data/known-ips.json
 *   - Subsequent touches are logged with the user's identity
 *
 * Data Files:
 *   - data/state.json         — Claudron's current mood/room/status (read/written)
 *   - data/known-ips.json     — IP → identity map (committed to git)
 *   - data/touch-log.jsonl    — All touch events (runtime, gitignored)
 *   - data/pending-touches.jsonl — Unread touches for agent (runtime, gitignored)
 *   - data/mood-log.jsonl     — Mood change history (runtime, gitignored)
 *
 * Static files are served from __dirname (the dashboard folder).
 *
 * Dependencies:
 *   - Node.js built-ins only (http, fs, path, child_process)
 *   - openclaw CLI (for health checks and wake events)
 *   - spogo CLI (for Spotify status, optional)
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, exec: execAsync } = require('child_process');

// =========================================================================
//  Constants
// =========================================================================

/** Port the dashboard server listens on. */
const PORT = 8420;

/** Root directory for static file serving and room configs. */
const DASH_DIR = __dirname;

/** Path to the legacy locations.json file. */
const LOCATIONS_FILE = path.join(DASH_DIR, 'locations.json');

/** Path to pending touch events for Claudron to pick up on heartbeats. */
const PENDING_TOUCHES_FILE = path.join(DASH_DIR, 'data', 'pending-touches.jsonl');

/** Claudron's birthday — used to calculate age in days. */
const BIRTHDAY = new Date('2026-02-14T00:00:00-08:00');

/** MIME type map for static file serving. */
// =========================================================================
//  Touch System State
//
//  The touch system has two modes:
//  1. SINGLE TAP on sprite: picks a random reaction from TOUCH_REACTIONS,
//     applies it immediately to state.json, then reverts after 5 seconds.
//     This is purely server-side — the agent is NOT woken up.
//  2. DOUBLE-CLICK on sprite: fires an OpenClaw system event to wake the
//     agent for a personal response. Throttled to 1 wake per 30s per user
//     via touchWakeThrottle map. Shows "one sec... 💭" immediately, reverts
//     after 10s if the agent doesn't update state by then.
//
//  Pre-reaction state tracking: before any touch reaction overwrites
//  state.json, we save the current mood/status in `preReactionState`.
//  The revert timer restores this saved state, so the agent's last
//  intentional mood is preserved across touch interactions.
// =========================================================================

/** Per-user throttle for touch wake events (max 1 per 30s). */
const touchWakeThrottle = new Map();

/** Path to state.json. */
const STATE_FILE = path.join(DASH_DIR, 'data', 'state.json');

/** Path to spatial analysis cache (agent overrides). */
const SPATIAL_CACHE_FILE = path.join(DASH_DIR, 'data', 'spatial-cache.json');

/** Path to pre-generated spatial map. */
const SPATIAL_MAP_FILE = path.join(DASH_DIR, 'data', 'spatial-map.json');

/** Timer handle for reverting touch reactions back to pre-reaction state. */
let reactionRevertTimer = null;

/** Saved pre-reaction state (mood/status) to revert to. Null when no reaction is active. */
let preReactionState = null;

/** Pool of instant touch reactions — randomly selected on single tap. No agent involvement. */
const TOUCH_REACTIONS = [
  { mood: 'happy', status: 'hey! 💜' },
  { mood: 'mischievous', status: '*poke*' },
  { mood: 'excited', status: 'that tickles!' },
  { mood: 'happy', status: 'hi hi hi!' },
  { mood: 'embarrassed', status: 'oh! 😳' },
  { mood: 'cozy', status: 'mmm warm pats 💜' },
  { mood: 'proud', status: 'yes I AM great' },
  { mood: 'curious', status: 'whatcha need?' },
  { mood: 'happy', status: 'hehe 😊' },
  { mood: 'excited', status: '!!!' },
  { mood: 'mischievous', status: "can't catch me~" },
  { mood: 'happy', status: '*purrs*' },
  { mood: 'cozy', status: 'more pats pls 🥺' },
  { mood: 'proud', status: "you're lucky I'm here" },
  { mood: 'embarrassed', status: 'stoppp 😳💜' },
];

const MIME_TYPES = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml'
};

// =========================================================================
//  Status & Health Helpers
// =========================================================================

/**
 * Read brain.json for context/model info (updated by Claudron during sessions).
 * @returns {object} Brain state with contextPct, model, etc.
 */
function getBrainInfo() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DASH_DIR, 'brain.json'), 'utf8'));
  } catch {
    return { contextPct: 0, contextUsed: '?', contextMax: '200k', model: 'claude-opus-4-6' };
  }
}

/**
 * Read session info from OpenClaw's sessions.json to get compaction count and turn count.
 * Scans the main session's JSONL file and counts assistant messages as "turns".
 * @returns {object|null} Session info or null if unavailable.
 */
function getSessionInfo() {
  try {
    const sessFile = '/Users/rcfox31/.openclaw/agents/main/sessions/sessions.json';
    const data = JSON.parse(fs.readFileSync(sessFile, 'utf8'));

    for (const [key, sess] of Object.entries(data)) {
      if (!key.includes('main')) continue;

      let turns = 0;
      try {
        const jsonl = fs.readFileSync(sess.sessionFile, 'utf8');
        const lines = jsonl.trim().split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            if (msg.role === 'assistant') turns++;
          } catch {}
        }
      } catch {}

      return {
        compactions: sess.compactionCount || 0,
        turns,
        sessionKey: key
      };
    }
  } catch {}
  return null;
}

/**
 * Aggregate system status: Telegram connectivity, Spotify playback,
 * brain context, session info, and Claudron's age.
 * @returns {object} Full status payload for /api/status.
 */
function getStatus() {
  let telegramOk = false;
  let spotifyTrack = null;

  // Check Telegram via openclaw health
  try {
    const health = execSync('openclaw health 2>&1', { timeout: 10000 }).toString();
    telegramOk = health.includes('Telegram: ok');
  } catch {}

  // Check Spotify via spogo CLI
  try {
    const spotifyOut = execSync('spogo status --json 2>&1', {
      timeout: 5000,
      env: { ...process.env }
    }).toString().trim();
    const sp = JSON.parse(spotifyOut);
    if (sp.item) {
      spotifyTrack = {
        state: sp.is_playing ? 'PLAYING' : 'PAUSED',
        track: sp.item.name || 'Unknown',
        artist: sp.item.artist || sp.item.artists?.map(a => a.name).join(', ') || '',
        device: sp.device?.name || ''
      };
    }
  } catch {}

  const now = new Date();
  const ageDays = Math.floor((now - BIRTHDAY) / (1000 * 60 * 60 * 24));

  return {
    updated: now.toISOString(),
    telegram: telegramOk,
    google: true, // Skip gog check to avoid keychain popups — known connected
    spotify: spotifyTrack,
    brain: getBrainInfo(),
    session: getSessionInfo(),
    ageDays,
    birthday: now.getMonth() === 1 && now.getDate() === 14
  };
}

// =========================================================================
//  Weather Helper (Open-Meteo — no API key needed)
// =========================================================================

/** Cached weather data to avoid hammering the API. */
let weatherCache = { data: null, fetchedAt: 0 };

/** Weather code → emoji mapping (WMO codes). */
const WEATHER_EMOJI = {
  0: '☀️',   1: '🌤️',  2: '⛅',   3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌧️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '🌧️',
  95: '⛈️',  96: '⛈️',  99: '⛈️'
};

/**
 * Fetch current weather for Menlo Park, CA from Open-Meteo.
 * Caches for 15 minutes.
 * @returns {Promise<object>} { temp_f, icon }
 */
async function getWeather() {
  const now = Date.now();
  if (weatherCache.data && (now - weatherCache.fetchedAt) < 15 * 60 * 1000) {
    return weatherCache.data;
  }
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=37.4529&longitude=-122.1817&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America/Los_Angeles';
    const resp = await fetch(url);
    const json = await resp.json();
    const temp_f = Math.round(json.current.temperature_2m);
    const code = json.current.weather_code;
    const icon = WEATHER_EMOJI[code] || '🌡️';
    weatherCache.data = { temp_f, icon, code };
    weatherCache.fetchedAt = now;
    return weatherCache.data;
  } catch (e) {
    return weatherCache.data || { temp_f: null, icon: '🌡️', code: -1 };
  }
}

// =========================================================================
//  Request Body Helper
// =========================================================================

/**
 * Collect and parse a JSON request body.
 * @param {http.IncomingMessage} req
 * @returns {Promise<object>} Parsed JSON body.
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
  });
}

// =========================================================================
//  Room Config Helpers
// =========================================================================

/**
 * Read a room's config.json file.
 * @param {string} roomName - Room directory name (e.g. "workshop")
 * @returns {object} Parsed config with locations.
 */
function readRoomConfig(roomName) {
  const cfgPath = path.join(DASH_DIR, 'rooms', roomName, 'config.json');
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
}

/**
 * Write a room's config.json file (pretty-printed).
 * @param {string} roomName - Room directory name.
 * @param {object} cfg - Config object to write.
 */
function writeRoomConfig(roomName, cfg) {
  const cfgPath = path.join(DASH_DIR, 'rooms', roomName, 'config.json');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
}

// =========================================================================
//  HTTP Server
// =========================================================================

const server = http.createServer(async (req, res) => {
  // --- CORS headers ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- Route: POST /api/touch ---
  if (req.url === '/api/touch' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      const knownIpsPath = path.join(DASH_DIR, 'data', 'known-ips.json');
      let knownIps = {};
      try { knownIps = JSON.parse(fs.readFileSync(knownIpsPath, 'utf8')); } catch {}
      const who = knownIps[ip] || null;
      const isDoubleClick = body.type === 'dblclick' || body.type === 'doubleclick';
      const logEntry = {
        ts: new Date().toISOString(),
        type: body.type,
        x: body.x,
        y: body.y,
        onSprite: !!body.onSprite,
        ip,
        ...(who ? { who } : { unknown: true })
      };
      // Always log all touches
      fs.appendFileSync(path.join(DASH_DIR, 'data', 'touch-log.jsonl'), JSON.stringify(logEntry) + '\n');
      if (who) {
        fs.appendFileSync(PENDING_TOUCHES_FILE, JSON.stringify(logEntry) + '\n');
      }

      if (body.onSprite && isDoubleClick) {
        // === DOUBLE-CLICK ON SPRITE → Wake the agent ===
        const now = Date.now();
        const lastWake = touchWakeThrottle.get(who || ip) || 0;
        // Write immediate "coming..." bubble
        try {
          const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
          if (!preReactionState) {
            preReactionState = { mood: state.mood, status: state.status };
          }
          state.mood = 'excited';
          state.status = 'one sec... 💭';
          fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
          // Revert after 10s (agent should take over by then)
          if (reactionRevertTimer) clearTimeout(reactionRevertTimer);
          const restoreTo = { ...preReactionState };
          preReactionState = null;
          reactionRevertTimer = setTimeout(() => {
            try {
              const cur = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
              if (cur.status === 'one sec... 💭') {
                cur.mood = restoreTo.mood;
                cur.status = restoreTo.status;
                fs.writeFileSync(STATE_FILE, JSON.stringify(cur, null, 2) + '\n');
              }
            } catch {}
          }, 10000);
        } catch {}
        if (who && now - lastWake > 30000) {
          touchWakeThrottle.set(who, now);
          const wakeText = `Dashboard double-click from ${who}: sprite tapped — wants attention`;
          execAsync(
            `openclaw system event --mode now --text ${JSON.stringify(wakeText)}`,
            { timeout: 10000 },
            (err) => { if (err) console.error('Wake event failed:', err.message); }
          );
        }
      } else if (body.onSprite && !isDoubleClick) {
        // === SINGLE CLICK ON SPRITE → Instant server-side reaction (no agent wake) ===
        try {
          const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
          // Save pre-reaction state only if not already in a reaction
          if (!preReactionState) {
            preReactionState = { mood: state.mood, status: state.status };
          }
          const reaction = TOUCH_REACTIONS[Math.floor(Math.random() * TOUCH_REACTIONS.length)];
          state.mood = reaction.mood;
          state.status = reaction.status;
          fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
          // Revert after 5 seconds
          if (reactionRevertTimer) clearTimeout(reactionRevertTimer);
          const restoreTo = { ...preReactionState };
          reactionRevertTimer = setTimeout(() => {
            preReactionState = null;
            try {
              const cur = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
              if (cur.mood === reaction.mood && cur.status === reaction.status) {
                cur.mood = restoreTo.mood;
                cur.status = restoreTo.status;
                fs.writeFileSync(STATE_FILE, JSON.stringify(cur, null, 2) + '\n');
              }
            } catch {}
          }, 5000);
        } catch {}
      }
      // === DOUBLE-CLICK NOT ON SPRITE → Instant spatial lookup from pre-generated map ===
      if (!body.onSprite && isDoubleClick && who && who !== 'guest') {
        try {
          const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
          const room = state.room || 'workshop';
          const clickX = body.x || 0;
          const clickY = body.y || 0;

          // Check agent override cache first (grid-based keys still work)
          let spatialCache = {};
          try { spatialCache = JSON.parse(fs.readFileSync(SPATIAL_CACHE_FILE, 'utf8')); } catch {}
          const cellX = Math.min(Math.floor(clickX * 10), 9);
          const cellY = Math.min(Math.floor(clickY * 10), 9);
          const cellKey = `${cellX}_${cellY}`;

          let desc = null;

          // Priority 1: agent override cache
          if (spatialCache[room] && spatialCache[room][cellKey]) {
            desc = spatialCache[room][cellKey];
          } else {
            // Priority 2: nearest object from spatial map
            try {
              const spatialMap = JSON.parse(fs.readFileSync(SPATIAL_MAP_FILE, 'utf8'));
              const objects = spatialMap[room] || [];
              let bestDist = Infinity;
              let bestObj = null;
              for (const obj of objects) {
                const dx = obj.x - clickX;
                const dy = obj.y - clickY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestObj = obj;
                }
              }
              if (bestObj && bestDist < 0.15) {
                desc = bestObj.description;
              } else {
                desc = 'just empty floor here... nothing interesting 🤷';
              }
            } catch {
              desc = 'hmm, I can\'t quite see from here... 👀';
            }
          }

          // Show description in speech bubble
          if (!preReactionState) {
            preReactionState = { mood: state.mood, status: state.status };
          }
          state.status = desc;
          fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

          // Revert after 8s
          if (reactionRevertTimer) clearTimeout(reactionRevertTimer);
          const restoreTo = { ...preReactionState };
          preReactionState = null;
          reactionRevertTimer = setTimeout(() => {
            try {
              const cur = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
              if (cur.status === desc) {
                cur.mood = restoreTo.mood;
                cur.status = restoreTo.status;
                fs.writeFileSync(STATE_FILE, JSON.stringify(cur, null, 2) + '\n');
              }
            } catch {}
          }, 8000);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, spatial: true, description: desc }));
          return;
        } catch (e) {
          console.error('Spatial lookup error:', e.message);
        }
      }

      let resp;
      if (who === 'guest') {
        resp = { ok: true, who: 'guest', mood: 'curious', status: 'who goes there? 👀' };
      } else if (who) {
        resp = { ok: true, who };
      } else {
        resp = { ok: true, unknown: true, needsIdentify: !!body.onSprite };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(resp));
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // --- Route: GET /api/pending-touches (read & clear) ---
  if (req.url === '/api/pending-touches' && req.method === 'GET') {
    try {
      let lines = [];
      try {
        const raw = fs.readFileSync(PENDING_TOUCHES_FILE, 'utf8').trim();
        if (raw) lines = raw.split('\n').map(l => JSON.parse(l));
      } catch {}
      // Clear the file after reading
      fs.writeFileSync(PENDING_TOUCHES_FILE, '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ events: lines }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // --- Route: POST /api/identify ---
  if (req.url === '/api/identify' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      const who = body.who; // "miranda" | "ryan" | "guest"
      if (!who || !['miranda', 'ryan', 'guest'].includes(who)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid who: must be miranda, ryan, or guest' }));
        return;
      }

      // Add IP to known-ips.json
      const knownIpsPath = path.join(DASH_DIR, 'data', 'known-ips.json');
      let knownIps = {};
      try { knownIps = JSON.parse(fs.readFileSync(knownIpsPath, 'utf8')); } catch {}
      knownIps[ip] = who;
      fs.writeFileSync(knownIpsPath, JSON.stringify(knownIps, null, 2) + '\n');

      // Log identification
      const logEntry = { ts: new Date().toISOString(), type: 'identify', ip, who, emoji: body.emoji || '' };
      fs.appendFileSync(path.join(DASH_DIR, 'data', 'touch-log.jsonl'), JSON.stringify(logEntry) + '\n');

      // Re-trigger touch reaction so they get immediate feedback
      let reactionResp = {};
      try {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (!preReactionState) {
          preReactionState = { mood: state.mood, status: state.status };
        }
        if (who === 'guest') {
          state.mood = 'curious';
          state.status = 'who goes there? 👀';
        } else {
          const reaction = TOUCH_REACTIONS[Math.floor(Math.random() * TOUCH_REACTIONS.length)];
          state.mood = reaction.mood;
          state.status = reaction.status;
          reactionResp = reaction;
        }
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
        // Revert after 5s
        if (reactionRevertTimer) clearTimeout(reactionRevertTimer);
        const restoreTo = { ...preReactionState };
        const savedMood = state.mood;
        const savedStatus = state.status;
        reactionRevertTimer = setTimeout(() => {
          preReactionState = null;
          try {
            const cur = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            if (cur.mood === savedMood && cur.status === savedStatus) {
              cur.mood = restoreTo.mood;
              cur.status = restoreTo.status;
              fs.writeFileSync(STATE_FILE, JSON.stringify(cur, null, 2) + '\n');
            }
          } catch {}
        }, 5000);
      } catch {}

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, who }));
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // --- Route: POST /api/spatial-cache (agent writes back analysis results) ---
  if (req.url === '/api/spatial-cache' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { room, cell, description } = body;
      if (!room || !cell || !description) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'room, cell, and description required' }));
        return;
      }
      // Update spatial cache
      let cache = {};
      try { cache = JSON.parse(fs.readFileSync(SPATIAL_CACHE_FILE, 'utf8')); } catch {}
      if (!cache[room]) cache[room] = {};
      cache[room][cell] = description;
      fs.writeFileSync(SPATIAL_CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');

      // Also update state.json with the description
      try {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        state.status = description;
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
      } catch {}

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, room, cell, cached: true }));
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // --- Route: GET /api/state ---
  if (req.url === '/api/state' && req.method === 'GET') {
    try {
      const data = fs.readFileSync(path.join(DASH_DIR, 'data', 'state.json'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to read state.json' }));
    }
    return;
  }

  // --- Route: GET /api/weather ---
  if (req.url === '/api/weather' && req.method === 'GET') {
    try {
      const weather = await getWeather();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(weather));
    } catch {
      res.writeHead(500);
      res.end(JSON.stringify({ temp_f: null, icon: '🌡️' }));
    }
    return;
  }

  // --- Route: GET /api/status ---
  if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getStatus()));
    return;
  }

  // --- Route: GET /api/room/:name ---
  const roomMatch = req.url.match(/^\/api\/room\/([a-z_-]+)$/);
  if (roomMatch && req.method === 'GET') {
    try {
      const data = fs.readFileSync(path.join(DASH_DIR, 'rooms', roomMatch[1], 'config.json'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Room not found' }));
    }
    return;
  }

  // --- Route: PUT /api/room/:name/location/:loc ---
  const locMatch = req.url.match(/^\/api\/room\/([a-z_-]+)\/location\/([a-z_-]+)$/);
  if (locMatch && req.method === 'PUT') {
    try {
      const update = await readJsonBody(req);
      const cfg = readRoomConfig(locMatch[1]);
      if (!cfg.locations[locMatch[2]]) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Location not found' }));
        return;
      }
      const loc = cfg.locations[locMatch[2]];
      if (update.x !== undefined) loc.x = update.x;
      if (update.y !== undefined) loc.y = update.y;
      if (update.facing !== undefined) loc.facing = update.facing;
      if (update.rotation !== undefined) loc.rotation = update.rotation;
      if (update.mood !== undefined) loc.mood = update.mood;
      if (update.mood === '') delete loc.mood;
      writeRoomConfig(locMatch[1], cfg);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // --- Route: DELETE /api/room/:name/location/:loc ---
  if (locMatch && req.method === 'DELETE') {
    try {
      const cfg = readRoomConfig(locMatch[1]);
      if (!cfg.locations[locMatch[2]]) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Location not found' }));
        return;
      }
      delete cfg.locations[locMatch[2]];
      writeRoomConfig(locMatch[1], cfg);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // --- Route: POST /api/room/:name/location ---
  const locPostMatch = req.url.match(/^\/api\/room\/([a-z_-]+)\/location$/);
  if (locPostMatch && req.method === 'POST') {
    try {
      const { name: locName, x, y, facing, emoji } = await readJsonBody(req);
      if (!locName) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'name required' }));
        return;
      }
      const cfg = readRoomConfig(locPostMatch[1]);
      if (cfg.locations[locName]) {
        res.writeHead(409);
        res.end(JSON.stringify({ error: 'Location already exists' }));
        return;
      }
      cfg.locations[locName] = { x: x || 0.5, y: y || 0.5, facing: facing || 'right', emoji: emoji || '📍' };
      writeRoomConfig(locPostMatch[1], cfg);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // --- Route: GET /locations.json (legacy) ---
  if (req.url === '/locations.json' && req.method === 'GET') {
    try {
      const data = fs.readFileSync(LOCATIONS_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to read locations.json' }));
    }
    return;
  }

  // --- Route: POST/PUT /locations.json (legacy) ---
  if (req.url === '/locations.json' && (req.method === 'POST' || req.method === 'PUT')) {
    try {
      const update = await readJsonBody(req);
      const locData = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
      if (update.current) {
        if (!locData.locations[update.current]) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: `Unknown location: ${update.current}` }));
          return;
        }
        locData.current = update.current;
      }
      fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locData, null, 2) + '\n');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(locData));
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // --- Static file serving (check public/ first, then root) ---
  let filePath = req.url === '/' ? '/index.html' : req.url;
  const publicPath = path.join(DASH_DIR, 'public', filePath);
  filePath = fs.existsSync(publicPath) ? publicPath : path.join(DASH_DIR, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

// =========================================================================
//  Start Server
// =========================================================================

server.listen(PORT, () => {
  console.log(`Claudron Dashboard running at http://localhost:${PORT}`);
});
