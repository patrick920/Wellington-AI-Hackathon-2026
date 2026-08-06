/**
 * server.js
 * ---------
 * The local web server for Waste Opportunities.
 *
 * Run it with:   npm start        (or)   node server/server.js
 * Then open:     http://localhost:3000
 *
 * It does two jobs:
 *   1. Serves the static website out of the public/ folder.
 *   2. Exposes a small JSON API under /api/* that the front end and the AI
 *      assistant both talk to.
 *
 * Deliberately built on Node's own `http` module with no web framework, so the
 * only thing you ever need to install is the Anthropic SDK — and even that is
 * optional (the app falls back to an offline assistant without it).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadDb, resetDb, searchListings, getListing, recordView,
  createListing, createWant, getWants, createRequest, acceptRequest,
  findMatches, getStatistics, toggleSaved, recordPass, listingTonnes, urgency
} from './db.js';
import { CATEGORIES, UNITS, FREQUENCIES } from './seed.js';
import { REGIONS } from './regions.js';
import { chat, aiStatus } from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

// ---------------------------------------------------------------------------
// .env loading
// ---------------------------------------------------------------------------

/**
 * Read a .env file in the project root and copy its values into process.env.
 * Deliberately minimal — supports `KEY=value` lines and `#` comments, which is
 * all we need. Copy .env.example to .env and put your API key in it.
 */
function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip optional surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !process.env[key]) process.env[key] = value;
  }
}
loadEnvFile();

const PORT = Number(process.env.PORT) || 3000;

// ---------------------------------------------------------------------------
// Small HTTP helpers
// ---------------------------------------------------------------------------

/** Send a JSON response. */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

/** Read and JSON-parse a request body (with a size cap for safety). */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) { // 1MB cap
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

/** File extension -> MIME type, for static file serving. */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

/**
 * Serve a file from public/.
 * The `path.resolve` + prefix check prevents directory-traversal (someone
 * requesting /../../secrets.txt) — always do this when serving files by path.
 */
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.resolve(PUBLIC_DIR, '.' + rel);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      // Unknown path: fall back to index.html so client-side routing works
      // when someone refreshes on a deep link like /#/browse.
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404).end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(html);
      });
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' }).end(buf);
  });
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

/**
 * Handle everything under /api/.
 * Returns true if the request was handled here.
 */
async function handleApi(req, res, url) {
  const p = url.pathname;
  const q = url.searchParams;
  const method = req.method;

  // --- metadata the front end needs to build its dropdowns ---------------
  if (p === '/api/meta' && method === 'GET') {
    return sendJson(res, 200, {
      categories: CATEGORIES,
      regions: REGIONS,
      units: UNITS,
      frequencies: FREQUENCIES,
      ai: await aiStatus()
    });
  }

  // --- listings ----------------------------------------------------------
  if (p === '/api/listings' && method === 'GET') {
    const results = searchListings({
      query: q.get('query') || undefined,
      category: q.get('category') || undefined,
      region: q.get('region') || undefined,
      maxDistanceKm: q.get('maxDistanceKm') ? Number(q.get('maxDistanceKm')) : undefined,
      priceType: q.get('priceType') || undefined,
      minTonnes: q.get('minTonnes') ? Number(q.get('minTonnes')) : undefined,
      maxTonnes: q.get('maxTonnes') ? Number(q.get('maxTonnes')) : undefined,
      minShelfLifeDays: q.get('minShelfLifeDays') ? Number(q.get('minShelfLifeDays')) : undefined,
      sort: q.get('sort') || 'newest'
    });
    // Enrich each listing with values the UI displays but shouldn't recompute
    const enriched = results.map(l => ({ ...l, tonnes: listingTonnes(l), urgency: urgency(l) }));
    return sendJson(res, 200, { count: enriched.length, listings: enriched });
  }

  if (p === '/api/listings' && method === 'POST') {
    const body = await readBody(req);
    if (!body.title) return sendJson(res, 400, { error: 'A title is required.' });
    const created = createListing(body);
    return sendJson(res, 201, { listing: created });
  }

  const listingMatch = p.match(/^\/api\/listings\/([\w-]+)$/);
  if (listingMatch && method === 'GET') {
    const l = recordView(listingMatch[1]);
    if (!l) return sendJson(res, 404, { error: 'Listing not found.' });
    return sendJson(res, 200, { listing: { ...l, tonnes: listingTonnes(l), urgency: urgency(l) } });
  }

  // --- wanted posts ------------------------------------------------------
  if (p === '/api/wants' && method === 'GET') {
    return sendJson(res, 200, { wants: getWants() });
  }
  if (p === '/api/wants' && method === 'POST') {
    const body = await readBody(req);
    if (!body.title) return sendJson(res, 400, { error: 'A title is required.' });
    return sendJson(res, 201, { want: createWant(body) });
  }

  // --- matching ----------------------------------------------------------
  if (p === '/api/matches' && method === 'POST') {
    const body = await readBody(req);
    const matches = findMatches(
      {
        description: body.description || '',
        query: body.query || body.description || '',
        region: body.region || undefined,
        category: body.category || undefined,
        tonnesWanted: body.tonnesWanted ? Number(body.tonnesWanted) : undefined
      },
      { limit: Number(body.limit) || 12, minScore: body.minScore != null ? Number(body.minScore) : 20 }
    );
    return sendJson(res, 200, {
      count: matches.length,
      matches: matches.map(m => ({
        score: m.score,
        reasons: m.reasons,
        distanceKm: m.distanceKm,
        listing: { ...m.listing, tonnes: listingTonnes(m.listing), urgency: urgency(m.listing) }
      }))
    });
  }

  // --- statistics --------------------------------------------------------
  if (p === '/api/stats' && method === 'GET') {
    return sendJson(res, 200, getStatistics());
  }

  // --- enquiries ---------------------------------------------------------
  if (p === '/api/requests' && method === 'GET') {
    return sendJson(res, 200, { requests: loadDb().requests });
  }
  if (p === '/api/requests' && method === 'POST') {
    const body = await readBody(req);
    const created = createRequest(body);
    if (!created) return sendJson(res, 404, { error: 'Listing not found.' });
    return sendJson(res, 201, { request: created });
  }
  const acceptMatch = p.match(/^\/api\/requests\/([\w-]+)\/accept$/);
  if (acceptMatch && method === 'POST') {
    const updated = acceptRequest(acceptMatch[1]);
    if (!updated) return sendJson(res, 404, { error: 'Request not found.' });
    return sendJson(res, 200, { request: updated });
  }

  // --- saved / passed (the swipe interface) -------------------------------
  if (p === '/api/saved' && method === 'POST') {
    const body = await readBody(req);
    return sendJson(res, 200, { saved: toggleSaved(body.listingId) });
  }
  if (p === '/api/passed' && method === 'POST') {
    const body = await readBody(req);
    return sendJson(res, 200, { passed: recordPass(body.listingId) });
  }

  // --- "my account" view -------------------------------------------------
  if (p === '/api/me' && method === 'GET') {
    const db = loadDb();
    const decorate = l => ({ ...l, tonnes: listingTonnes(l), urgency: urgency(l) });
    return sendJson(res, 200, {
      myListings: db.listings.filter(l => l.ownerId === 'me').map(decorate),
      savedListings: db.saved.map(id => getListing(id)).filter(Boolean).map(decorate),
      myWants: db.wants.filter(w => w.ownerId === 'me'),
      requests: db.requests,
      deals: db.deals.slice(0, 12),
      passedCount: db.passed.length
    });
  }

  // --- AI chat -----------------------------------------------------------
  if (p === '/api/chat' && method === 'POST') {
    const body = await readBody(req);
    if (!body.message || !String(body.message).trim()) {
      return sendJson(res, 400, { error: 'Message is required.' });
    }
    const result = await chat(
      Array.isArray(body.history) ? body.history : [],
      String(body.message).slice(0, 4000),
      body.page || 'home'
    );
    return sendJson(res, 200, result);
  }

  // --- reset the demo data ------------------------------------------------
  if (p === '/api/reset' && method === 'POST') {
    resetDb();
    return sendJson(res, 200, { ok: true, message: 'Demo data has been reset.' });
  }

  return sendJson(res, 404, { error: `No API route for ${method} ${p}` });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Permit the browser to call the API (harmless locally, avoids CORS surprises
  // if you ever open the front end from a different port).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url.pathname);
    }
  } catch (err) {
    console.error('[server] Unhandled error:', err);
    if (!res.headersSent) sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
});

// Make sure the database exists before we accept any traffic.
loadDb();

server.listen(PORT, async () => {
  console.log('');
  console.log('  ╭──────────────────────────────────────────────────────────╮');
  console.log('  │                                                          │');
  console.log('  │   ♻  Waste Opportunities  —  Waste is only waste in the wrong place   │');
  console.log('  │                                                          │');
  console.log('  ╰──────────────────────────────────────────────────────────╯');
  console.log('');
  console.log(`   Running at:  http://localhost:${PORT}`);

  // aiStatus() also triggers provider selection, which logs its own reasoning
  // (which provider it chose, or why it fell back to offline mode).
  const ai = await aiStatus();
  console.log(`   AI mode:     ${ai.available ? `${ai.label} — ${ai.model}` : 'Offline demo assistant'}`);
  console.log('');
  console.log('   Press Ctrl+C to stop.');
  console.log('');
});
