/**
 * db.js
 * -----
 * A tiny JSON-file "database". No SQL server to install, no Docker, no cloud.
 * Everything lives in data/db.json, which is created automatically on first run.
 *
 * WHY A JSON FILE?
 * For a hackathon demo this is the right trade-off: zero setup, easy to inspect
 * (just open the file), easy to reset (delete the file). If you later needed
 * real concurrency you would swap this module for SQLite or Postgres — the rest
 * of the app only talks to the exported functions below, so nothing else changes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEED_LISTINGS, SEED_WANTS, SEED_DEALS,
  UNIT_TO_TONNES, FREQUENCY_PER_YEAR, CATEGORIES
} from './seed.js';
import { distanceBetweenRegions, REGION_BY_NAME } from './regions.js';

// Resolve paths relative to this file (works no matter where you run node from).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/** In-memory copy of the database. Written back to disk after every change. */
let db = null;

/** Simple incrementing-ish unique id generator. */
function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Today's date shifted by N days, as an ISO date string (YYYY-MM-DD). */
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Build the initial database from the seed data.
 * Each seed listing gets generated fields (id, dates, view counts) added.
 */
function buildSeedDb() {
  const now = new Date().toISOString();

  const listings = SEED_LISTINGS.map((seed, i) => ({
    id: makeId('lst'),
    ...seed,
    // Stagger creation dates so the marketplace looks "lived in"
    createdAt: new Date(Date.now() - (i * 8 + 2) * 3600 * 1000).toISOString(),
    // Availability window derived from shelf life
    availableFrom: daysFromNow(0),
    availableUntil: daysFromNow(Math.min(seed.shelfLifeDays, 120)),
    status: 'available',
    views: 8 + Math.floor(Math.random() * 140),
    interestCount: Math.floor(Math.random() * 6)
  }));

  const wants = SEED_WANTS.map((seed, i) => ({
    id: makeId('wnt'),
    ...seed,
    createdAt: new Date(Date.now() - (i * 20 + 5) * 3600 * 1000).toISOString(),
    status: 'open'
  }));

  // Turn seed deals into completed-deal records with real dates.
  const deals = SEED_DEALS.map(d => ({
    id: makeId('dl'),
    listingTitle: d.listingTitle,
    buyer: d.buyer,
    tonnes: d.tonnes,
    co2Saved: d.co2Saved,
    moneySaved: d.moneySaved,
    completedAt: new Date(Date.now() - d.daysAgo * 86400 * 1000).toISOString()
  }));

  return {
    createdAt: now,
    listings,
    wants,
    deals,
    requests: [],   // enquiries a user sends about a listing
    saved: [],      // listing ids the current demo user has saved/liked
    passed: [],     // listing ids swiped away on the Match page
    chatLog: []     // transcript of AI conversations (useful for the pitch)
  };
}

/** Load the database from disk, creating and seeding it if it does not exist. */
export function loadDb() {
  if (db) return db;
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      // Defensive: make sure every expected collection exists, even if the
      // file was written by an older version of the app.
      for (const key of ['listings', 'wants', 'deals', 'requests', 'saved', 'passed', 'chatLog']) {
        if (!Array.isArray(db[key])) db[key] = [];
      }
    } else {
      db = buildSeedDb();
      saveDb();
      console.log('[db] Created a fresh database with seed data at', DB_FILE);
    }
  } catch (err) {
    console.error('[db] Could not read db.json, rebuilding from seed data:', err.message);
    db = buildSeedDb();
    saveDb();
  }
  return db;
}

/** Write the in-memory database back to disk. */
export function saveDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

/** Delete the database and rebuild from seed — used by the "Reset demo" button. */
export function resetDb() {
  db = buildSeedDb();
  saveDb();
  return db;
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

/**
 * Convert a listing's quantity into tonnes per single availability event.
 * e.g. "42 tonnes weekly" -> 42 tonnes each time it becomes available.
 */
export function listingTonnes(listing) {
  const factor = UNIT_TO_TONNES[listing.quantity?.unit] ?? 1;
  return (listing.quantity?.amount ?? 0) * factor;
}

/** Tonnes this listing represents over a full year, given its frequency. */
export function listingTonnesPerYear(listing) {
  const perEvent = listingTonnes(listing);
  const times = FREQUENCY_PER_YEAR[listing.quantity?.frequency] ?? 1;
  return perEvent * times;
}

/** How many days until this listing's material spoils / window closes. */
export function daysRemaining(listing) {
  if (!listing.availableUntil) return null;
  const ms = new Date(listing.availableUntil).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

/**
 * Urgency label used for the "expiring soon" badges.
 * Short shelf-life material is the hardest to rehome, so we surface it loudly.
 */
export function urgency(listing) {
  const d = listing.shelfLifeDays ?? 999;
  if (d <= 2) return { level: 'critical', label: 'Collect within 48h' };
  if (d <= 7) return { level: 'high', label: `${d} day shelf life` };
  if (d <= 30) return { level: 'medium', label: `${d} day shelf life` };
  return { level: 'low', label: 'Long shelf life' };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * The core search function used by BOTH the manual Browse page and the AI's
 * search tool. Keeping one implementation means the AI and the human see
 * exactly the same marketplace — which is the whole point of the product.
 *
 * @param {object} opts
 * @param {string} [opts.query]        free-text search across title/type/description/uses
 * @param {string} [opts.category]     category id
 * @param {string} [opts.region]       NZ region name
 * @param {number} [opts.maxDistanceKm] only listings within this distance of `region`
 * @param {string} [opts.priceType]    'free' | 'paid' | 'negotiable' | 'pay-to-take'
 * @param {number} [opts.minTonnes]    minimum tonnes per availability event
 * @param {number} [opts.maxTonnes]    maximum tonnes per availability event
 * @param {number} [opts.minShelfLifeDays] exclude material that spoils too fast
 * @param {boolean}[opts.includePrivate]   include private listings (AI matcher only)
 * @param {string} [opts.sort]         'newest' | 'closest' | 'largest' | 'urgent'
 */
export function searchListings(opts = {}) {
  const data = loadDb();
  const {
    query, category, region, maxDistanceKm, priceType,
    minTonnes, maxTonnes, minShelfLifeDays,
    includePrivate = false, sort = 'newest', limit
  } = opts;

  const q = (query || '').trim().toLowerCase();
  const terms = q ? q.split(/\s+/).filter(Boolean) : [];

  let results = data.listings.filter(l => {
    if (l.status !== 'available') return false;
    if (!includePrivate && l.visibility === 'private') return false;
    if (category && l.category !== category) return false;
    if (priceType && l.priceType !== priceType) return false;

    if (minTonnes != null && listingTonnes(l) < minTonnes) return false;
    if (maxTonnes != null && listingTonnes(l) > maxTonnes) return false;
    if (minShelfLifeDays != null && (l.shelfLifeDays ?? 0) < minShelfLifeDays) return false;

    if (region && maxDistanceKm != null) {
      const d = distanceBetweenRegions(region, l.region);
      if (d == null || d > maxDistanceKm) return false;
    } else if (region && maxDistanceKm == null) {
      // Region given with no radius = exact region filter
      if (l.region !== region) return false;
    }

    if (terms.length) {
      // Search across everything a user might reasonably type.
      const haystack = [
        l.title, l.wasteType, l.description, l.category,
        l.region, l.city, ...(l.suggestedUses || [])
      ].join(' ').toLowerCase();
      // Every term must appear somewhere (AND search — more precise results)
      if (!terms.every(t => haystack.includes(t))) return false;
    }

    return true;
  });

  // Attach distance from the user's region so the UI can show "142 km away"
  if (region) {
    results = results.map(l => ({ ...l, distanceKm: distanceBetweenRegions(region, l.region) }));
  }

  // Sorting
  const sorters = {
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    closest: (a, b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9),
    largest: (a, b) => listingTonnes(b) - listingTonnes(a),
    urgent: (a, b) => (a.shelfLifeDays ?? 9999) - (b.shelfLifeDays ?? 9999)
  };
  results.sort(sorters[sort] || sorters.newest);

  return limit ? results.slice(0, limit) : results;
}

/** Fetch a single listing by id (private listings included — you have the id). */
export function getListing(id) {
  const data = loadDb();
  return data.listings.find(l => l.id === id) || null;
}

/** Increment the view counter for a listing. */
export function recordView(id) {
  const l = getListing(id);
  if (l) { l.views = (l.views || 0) + 1; saveDb(); }
  return l;
}

/** All open "wanted" posts. */
export function getWants() {
  return loadDb().wants.filter(w => w.status === 'open');
}

// ---------------------------------------------------------------------------
// Matching engine
// ---------------------------------------------------------------------------

/**
 * Words that carry no signal about WHAT someone needs. Filtering them out stops
 * a sentence like "I would like to find something that works for me" from
 * matching every listing on the word "something".
 */
const STOPWORDS = new Set([
  'want', 'need', 'looking', 'look', 'find', 'make', 'making', 'made', 'have', 'with',
  'from', 'that', 'this', 'they', 'them', 'there', 'their', 'would', 'could', 'should',
  'about', 'into', 'some', 'something', 'anything', 'good', 'great', 'best', 'more',
  'been', 'being', 'when', 'what', 'where', 'which', 'while', 'able', 'also', 'just',
  'like', 'really', 'very', 'much', 'many', 'lots', 'plenty', 'know', 'think', 'help',
  'please', 'thanks', 'business', 'company', 'small', 'large', 'start', 'starting',
  'material', 'materials', 'waste', 'product', 'products', 'stuff', 'thing', 'things',
  'near', 'nearby', 'close', 'around', 'available', 'possible', 'suitable', 'idea',
  // Generic adjectives that appear in almost every listing description and
  // therefore separate nothing. "natural" in particular was matching half the
  // marketplace and drowning out the words that actually carry intent.
  'natural', 'cheap', 'sell', 'selling', 'market', 'markets', 'buy', 'price'
]);

/**
 * A crude stemmer: strips the most common English suffixes so that related
 * word forms match each other. "starchy" -> "starch", "packaging" -> "packag",
 * "shells" -> "shell". Not linguistically rigorous, but it turns a lot of
 * near-misses into hits, which is what matters here.
 */
function stemWord(word) {
  for (const suffix of ['ing', 'ies', 'ers', 'ed', 'es', 'ly', 'y', 's']) {
    if (word.length > suffix.length + 3 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

/**
 * Score how well a listing satisfies a stated need. Returns 0-100 plus the
 * reasons behind the score, so the UI (and the AI) can EXPLAIN the match
 * rather than presenting a mystery number.
 *
 * Scoring weights, and why:
 *   Keyword relevance (0-45) — does the material actually suit the purpose?
 *   Proximity        (0-25) — hauling wet waste far cancels the climate benefit
 *   Shelf life       (0-15) — can the taker realistically get there in time?
 *   Volume fit       (0-10) — matching a 1-tonne need to a 400-tonne pile is noise
 *   Cost             (0-5)  — free or paid-to-take is a bonus
 */
export function scoreMatch(listing, need) {
  const reasons = [];
  let score = 0;

  // --- Keyword relevance -------------------------------------------------
  // We stem words crudely (starchy -> starch, packaging -> packag) so that a
  // user asking for "starchy" material still matches a listing that says
  // "starch". A full stemmer would be overkill; this catches the common cases.
  const needText = `${need.query || ''} ${need.description || ''}`.toLowerCase();
  const needTerms = [...new Set(
    needText.split(/[^a-z0-9]+/).filter(t => t.length > 3 && !STOPWORDS.has(t))
  )];

  // Search three zones with different weights: what it IS matters more than
  // how it's described, and what it's USED FOR matters most of all when
  // someone is describing a purpose rather than a material.
  const zones = [
    { text: `${listing.title} ${listing.wasteType} ${listing.category}`.toLowerCase(), weight: 3 },
    { text: (listing.suggestedUses || []).join(' ').toLowerCase(), weight: 3 },
    { text: (listing.description || '').toLowerCase(), weight: 1 }
  ];

  let weightedHits = 0;
  const matchedTerms = [];
  for (const term of needTerms) {
    const stem = stemWord(term);
    let best = 0;
    for (const zone of zones) {
      if (zone.text.includes(stem)) best = Math.max(best, zone.weight);
    }
    if (best > 0) { weightedHits += best; matchedTerms.push(term); }
  }

  // Normalise: a need typically has 3-8 meaningful terms; matching a few of
  // them strongly should be enough for full marks.
  const maxUseful = Math.min(Math.max(needTerms.length, 1), 6) * 3;
  const keywordScore = needTerms.length
    ? Math.min(45, Math.round((weightedHits / maxUseful) * 45))
    : 20; // no keywords given — neutral baseline
  score += keywordScore;

  if (matchedTerms.length) {
    const shown = matchedTerms.slice(0, 3).join(', ');
    reasons.push(`Matches on ${shown}${matchedTerms.length > 3 ? ` and ${matchedTerms.length - 3} more` : ''}`);
  }

  // Category match is a strong signal on its own
  if (need.category && need.category === listing.category) {
    score += 8;
    reasons.push('Same industry category');
  }

  // The remaining factors are LOGISTICS — they tell you whether a collection
  // is practical, not whether the material is right. We accumulate them
  // separately so we can discount them for irrelevant listings (see the
  // relevance gate at the bottom). Without that, anything close and long-lived
  // outranks the genuinely useful material two regions over.
  let logistics = 0;

  // --- Proximity ---------------------------------------------------------
  let distance = null;
  if (need.region) {
    distance = distanceBetweenRegions(need.region, listing.region);
    if (distance != null) {
      // Full marks under 50km, tapering to zero at 900km
      logistics += Math.max(0, Math.round(25 * (1 - Math.min(distance, 900) / 900)));
      if (distance === 0) reasons.push(`Same region — ${listing.region}`);
      else if (distance < 60) reasons.push(`Very close — about ${distance} km away`);
      else if (distance < 250) reasons.push(`Regional — about ${distance} km away`);
      else reasons.push(`${distance} km away, so factor in freight`);
    }
  } else {
    logistics += 12; // unknown location — neutral
  }

  // --- Shelf life --------------------------------------------------------
  const shelf = listing.shelfLifeDays ?? 365;
  if (shelf >= 90) { logistics += 15; reasons.push('Stable material — no time pressure'); }
  else if (shelf >= 14) { logistics += 11; reasons.push(`Usable for about ${shelf} days`); }
  else if (shelf >= 4) { logistics += 6; reasons.push(`Short ${shelf}-day window — plan collection`); }
  else { logistics += 2; reasons.push('Highly perishable — needs collection within 48 hours'); }

  // --- Volume fit --------------------------------------------------------
  const tonnes = listingTonnes(listing);
  if (need.tonnesWanted) {
    const ratio = tonnes / need.tonnesWanted;
    if (ratio >= 0.5 && ratio <= 3) { logistics += 10; reasons.push('Volume is a good fit for what you need'); }
    else if (ratio > 3) { logistics += 4; reasons.push(`Much larger volume than you asked for (${Math.round(tonnes)} t available)`); }
    else { logistics += 3; reasons.push(`Smaller volume than you asked for (${Math.round(tonnes)} t available)`); }
  } else {
    logistics += 6;
  }

  // --- Cost --------------------------------------------------------------
  if (listing.priceType === 'pay-to-take') { logistics += 5; reasons.push(`Producer pays $${listing.price}/t for removal`); }
  else if (listing.priceType === 'free') { logistics += 4; reasons.push('Free to collect'); }
  else if (listing.priceType === 'negotiable') { logistics += 2; }

  // --- Relevance gate ----------------------------------------------------
  // Convenience only counts once the material is actually plausible. A listing
  // that matched none of the user's words keeps just 35% of its logistics
  // score; one that matched everything keeps all of it.
  const relevance = needTerms.length ? Math.min(1, weightedHits / maxUseful) : 0.6;
  score += logistics * (0.45 + 0.55 * relevance);

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    distanceKm: distance
  };
}

/**
 * Rank every listing against a need and return the best ones.
 * `includePrivate` lets the AI matcher surface private listings when — and only
 * when — the match is genuinely strong (the privacy promise from the plan doc).
 */
export function findMatches(need, { limit = 8, includePrivate = true, minScore = 25 } = {}) {
  const data = loadDb();
  const candidates = data.listings.filter(l => l.status === 'available');

  const scored = candidates
    .map(l => ({ listing: l, ...scoreMatch(l, need) }))
    .filter(m => {
      if (m.score < minScore) return false;
      // Private listings are only revealed for strong matches (score >= 60).
      if (m.listing.visibility === 'private') return includePrivate && m.score >= 60;
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new listing from user (or AI-assisted) input. */
export function createListing(input) {
  const data = loadDb();
  const listing = {
    id: makeId('lst'),
    title: input.title || 'Untitled waste stream',
    wasteType: input.wasteType || input.title || 'Unspecified',
    category: input.category || 'horticulture',
    description: input.description || '',
    quantity: {
      amount: Number(input.quantityAmount) || 0,
      unit: input.quantityUnit || 'tonnes',
      frequency: input.quantityFrequency || 'one-off'
    },
    region: input.region || 'Auckland',
    city: input.city || '',
    shelfLifeDays: Number(input.shelfLifeDays) || 30,
    condition: input.condition || 'fresh',
    priceType: input.priceType || 'free',
    price: Number(input.price) || 0,
    visibility: input.visibility === 'private' ? 'private' : 'public',
    contact: {
      org: input.org || '',
      name: input.contactName || '',
      email: input.email || '',
      phone: input.phone || ''
    },
    suggestedUses: Array.isArray(input.suggestedUses) ? input.suggestedUses : [],
    co2PerTonne: Number(input.co2PerTonne) || 0.6,
    disposalCostPerTonne: Number(input.disposalCostPerTonne) || 150,
    createdAt: new Date().toISOString(),
    availableFrom: input.availableFrom || daysFromNow(0),
    availableUntil: input.availableUntil || daysFromNow(Math.min(Number(input.shelfLifeDays) || 30, 120)),
    status: 'available',
    views: 0,
    interestCount: 0,
    ownerId: 'me'   // marks it as "yours" so it shows in My Dashboard
  };
  data.listings.unshift(listing);
  saveDb();
  return listing;
}

/** Create a new "wanted" post. */
export function createWant(input) {
  const data = loadDb();
  const want = {
    id: makeId('wnt'),
    title: input.title || 'Looking for material',
    description: input.description || '',
    category: input.category || '',
    region: input.region || 'Auckland',
    quantityNeeded: input.quantityNeeded || '',
    org: input.org || 'You',
    ownerId: 'me',
    createdAt: new Date().toISOString(),
    status: 'open'
  };
  data.wants.unshift(want);
  saveDb();
  return want;
}

/** Register an enquiry / expression of interest against a listing. */
export function createRequest({ listingId, message, fromName, fromOrg, fromEmail }) {
  const data = loadDb();
  const listing = getListing(listingId);
  if (!listing) return null;
  const req = {
    id: makeId('req'),
    listingId,
    listingTitle: listing.title,
    message: message || '',
    fromName: fromName || 'You',
    fromOrg: fromOrg || '',
    fromEmail: fromEmail || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  data.requests.unshift(req);
  listing.interestCount = (listing.interestCount || 0) + 1;
  saveDb();
  return req;
}

/**
 * Mark a request as accepted and record the resulting completed deal.
 * This is what feeds the Impact statistics.
 */
export function acceptRequest(requestId) {
  const data = loadDb();
  const req = data.requests.find(r => r.id === requestId);
  if (!req) return null;
  req.status = 'accepted';

  const listing = getListing(req.listingId);
  if (listing) {
    const tonnes = listingTonnes(listing);
    data.deals.unshift({
      id: makeId('dl'),
      listingTitle: listing.title,
      buyer: req.fromOrg || req.fromName || 'Anonymous',
      tonnes: Math.round(tonnes * 10) / 10,
      co2Saved: Math.round(tonnes * (listing.co2PerTonne || 0.6) * 10) / 10,
      moneySaved: Math.round(tonnes * (listing.disposalCostPerTonne || 150)),
      completedAt: new Date().toISOString()
    });
    listing.status = 'reserved';
  }
  saveDb();
  return req;
}

/** Save (like) or unsave a listing. Used by the swipe/Match page. */
export function toggleSaved(listingId) {
  const data = loadDb();
  const i = data.saved.indexOf(listingId);
  if (i >= 0) data.saved.splice(i, 1);
  else data.saved.push(listingId);
  saveDb();
  return data.saved;
}

/** Record a "pass" (swipe left) so we stop showing that card. */
export function recordPass(listingId) {
  const data = loadDb();
  if (!data.passed.includes(listingId)) data.passed.push(listingId);
  saveDb();
  return data.passed;
}

/** Append a chat turn to the persistent transcript. */
export function logChat(role, content) {
  const data = loadDb();
  data.chatLog.push({ role, content, at: new Date().toISOString() });
  // Keep the log from growing without bound during a long demo session
  if (data.chatLog.length > 400) data.chatLog = data.chatLog.slice(-400);
  saveDb();
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * Everything the Impact page needs, computed fresh from the data.
 *
 * Two kinds of number here, and it matters that you can explain the difference
 * in your pitch:
 *   "Realised"  — from deals actually completed on the platform.
 *   "Potential" — what the currently listed material would achieve if matched.
 */
export function getStatistics() {
  const data = loadDb();

  // --- Realised impact (completed deals) ---------------------------------
  const realised = data.deals.reduce(
    (acc, d) => ({
      tonnes: acc.tonnes + (d.tonnes || 0),
      co2: acc.co2 + (d.co2Saved || 0),
      money: acc.money + (d.moneySaved || 0),
      count: acc.count + 1
    }),
    { tonnes: 0, co2: 0, money: 0, count: 0 }
  );

  // --- Potential impact (live listings, annualised) ----------------------
  let potentialTonnes = 0, potentialCo2 = 0, potentialMoney = 0;
  for (const l of data.listings) {
    if (l.status !== 'available') continue;
    const tYear = listingTonnesPerYear(l);
    potentialTonnes += tYear;
    potentialCo2 += tYear * (l.co2PerTonne || 0.6);
    potentialMoney += tYear * (l.disposalCostPerTonne || 150);
  }

  // --- Breakdown by category (for the bar chart) -------------------------
  const byCategory = CATEGORIES.map(cat => {
    const items = data.listings.filter(l => l.category === cat.id && l.status === 'available');
    const tonnes = items.reduce((s, l) => s + listingTonnesPerYear(l), 0);
    return { id: cat.id, label: cat.label, icon: cat.icon, listings: items.length, tonnesPerYear: Math.round(tonnes) };
  }).filter(c => c.listings > 0)
    .sort((a, b) => b.tonnesPerYear - a.tonnesPerYear);

  // --- Breakdown by region (for the map / region list) -------------------
  const byRegion = Object.keys(REGION_BY_NAME).map(name => {
    const items = data.listings.filter(l => l.region === name && l.status === 'available');
    const tonnes = items.reduce((s, l) => s + listingTonnesPerYear(l), 0);
    return { region: name, listings: items.length, tonnesPerYear: Math.round(tonnes) };
  }).filter(r => r.listings > 0)
    .sort((a, b) => b.tonnesPerYear - a.tonnesPerYear);

  // --- Monthly trend of completed deals (for the line chart) -------------
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-NZ', { month: 'short' });
    const tonnes = data.deals
      .filter(x => (x.completedAt || '').slice(0, 7) === key)
      .reduce((s, x) => s + (x.tonnes || 0), 0);
    months.push({ key, label, tonnes: Math.round(tonnes) });
  }

  return {
    realised: {
      tonnesDiverted: Math.round(realised.tonnes),
      co2AvoidedTonnes: Math.round(realised.co2),
      moneySavedNzd: Math.round(realised.money),
      dealsCompleted: realised.count
    },
    potential: {
      tonnesPerYear: Math.round(potentialTonnes),
      co2AvoidedTonnesPerYear: Math.round(potentialCo2),
      moneySavedNzdPerYear: Math.round(potentialMoney)
    },
    marketplace: {
      activeListings: data.listings.filter(l => l.status === 'available').length,
      openWants: data.wants.filter(w => w.status === 'open').length,
      regionsCovered: byRegion.length,
      urgentListings: data.listings.filter(l => l.status === 'available' && (l.shelfLifeDays ?? 999) <= 7).length
    },
    byCategory,
    byRegion,
    monthlyTrend: months,
    // Friendly equivalences to make the numbers land in a 5-minute pitch
    equivalents: {
      // NZ average petrol car emits roughly 3.5 t CO2e per year
      carsOffRoadPerYear: Math.round(potentialCo2 / 3.5),
      // A standard rubbish truck carries about 9 tonnes
      truckloadsDiverted: Math.round(potentialTonnes / 9),
      // Average NZ household emits about 8 t CO2e per year
      householdsEquivalent: Math.round(potentialCo2 / 8)
    }
  };
}
