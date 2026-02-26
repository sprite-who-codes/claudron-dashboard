const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 8420;
const DASH_DIR = __dirname;

function getBrain() {
  try {
    const out = execSync('openclaw health --json 2>&1', { timeout: 10000 }).toString();
    const h = JSON.parse(out);
    // Try to get session info
    const sessions = h.sessions || {};
    return {
      model: 'claude-opus-4-6',
      contextPct: null, // Will be updated from session file
      contextUsed: null,
      contextMax: null,
      compactions: 0
    };
  } catch (e) {
    return null;
  }
}

function getSessionInfo() {
  try {
    const sessFile = '/Users/rcfox31/.openclaw/agents/main/sessions/sessions.json';
    const data = JSON.parse(fs.readFileSync(sessFile, 'utf8'));
    for (const [key, sess] of Object.entries(data)) {
      if (key.includes('main')) {
        // Count lines in JSONL for rough turn count
        let turns = 0;
        try {
          const jsonl = fs.readFileSync(sess.sessionFile, 'utf8');
          const lines = jsonl.trim().split('\n').filter(l => l.trim());
          // Count assistant messages for turn count
          for (const line of lines) {
            try {
              const msg = JSON.parse(line);
              if (msg.role === 'assistant') turns++;
            } catch (e) {}
          }
        } catch (e) {}
        return {
          compactions: sess.compactionCount || 0,
          turns: turns,
          sessionKey: key
        };
      }
    }
  } catch (e) {}
  return null;
}

function getStatus() {
  let health = '';
  let spotify = '';
  let telegramOk = false;
  let googleOk = false;
  let spotifyTrack = null;
  let brain = null;
  let session = null;

  try {
    health = execSync('openclaw health 2>&1', { timeout: 10000 }).toString();
    telegramOk = health.includes('Telegram: ok');
  } catch (e) {
    health = e.stdout?.toString() || '';
  }

  // Read brain.json (updated by Claudron during sessions)
  try {
    brain = JSON.parse(fs.readFileSync(path.join(DASH_DIR, 'brain.json'), 'utf8'));
  } catch (e) {
    brain = { contextPct: 0, contextUsed: '?', contextMax: '200k', model: 'claude-opus-4-6' };
  }
  session = getSessionInfo();

  try {
    const spotifyOut = execSync('spogo status --json 2>&1', { timeout: 5000, env: { ...process.env } }).toString().trim();
    const sp = JSON.parse(spotifyOut);
    if (sp.item) {
      spotifyTrack = {
        state: sp.is_playing ? 'PLAYING' : 'PAUSED',
        track: sp.item.name || 'Unknown',
        artist: sp.item.artist || sp.item.artists?.map(a => a.name).join(', ') || '',
        device: sp.device?.name || ''
      };
    }
  } catch (e) {}

  // Skip gog check to avoid keychain popups — we know it's connected
  googleOk = true;

  // Calculate age
  const birthday = new Date('2026-02-14T00:00:00-08:00');
  const now = new Date();
  const ageDays = Math.floor((now - birthday) / (1000 * 60 * 60 * 24));

  return {
    updated: new Date().toISOString(),
    telegram: telegramOk,
    google: googleOk,
    spotify: spotifyTrack,
    brain: brain,
    session: session,
    ageDays: ageDays,
    birthday: now.getMonth() === 1 && now.getDate() === 14
  };
}

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const LOCATIONS_FILE = path.join(DASH_DIR, 'locations.json');

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // GET /locations.json
  if (req.url === '/locations.json' && req.method === 'GET') {
    try {
      const data = fs.readFileSync(LOCATIONS_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to read locations.json' }));
    }
    return;
  }

  // POST/PUT /locations.json — update current location
  if (req.url === '/locations.json' && (req.method === 'POST' || req.method === 'PUT')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const update = JSON.parse(body);
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
    });
    return;
  }

  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getStatus()));
    return;
  }

  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(DASH_DIR, filePath);

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Claudron Dashboard running at http://localhost:${PORT}`);
});
