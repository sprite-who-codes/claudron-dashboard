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
 *   GET  /locations.json                     — Legacy: raw locations file
 *   POST /locations.json                     — Legacy: update current location
 *
 * Static files are served from __dirname (the dashboard folder).
 *
 * Dependencies:
 *   - Node.js built-ins only (http, fs, path, child_process)
 *   - openclaw CLI (for health checks)
 *   - spogo CLI (for Spotify status, optional)
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// =========================================================================
//  Constants
// =========================================================================

/** Port the dashboard server listens on. */
const PORT = 8420;

/** Root directory for static file serving and room configs. */
const DASH_DIR = __dirname;

/** Path to the legacy locations.json file. */
const LOCATIONS_FILE = path.join(DASH_DIR, 'locations.json');

/** Claudron's birthday — used to calculate age in days. */
const BIRTHDAY = new Date('2026-02-14T00:00:00-08:00');

/** MIME type map for static file serving. */
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

  // --- Route: GET /api/state ---
  if (req.url === '/api/state' && req.method === 'GET') {
    try {
      const data = fs.readFileSync(path.join(DASH_DIR, 'state.json'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to read state.json' }));
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

  // --- Static file serving ---
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(DASH_DIR, filePath);

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
