/**
 * api.js
 * ------
 * Every call to the local server goes through here. Keeping them in one file
 * means you can see the whole API surface at a glance, and change the base URL
 * or add auth in one place later.
 */

/** Low-level fetch wrapper that throws on non-2xx and parses JSON. */
async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body is fine */ }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

const get = path => request(path);
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) });

/** Turn a filter object into a query string, skipping empty values. */
function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === '' || v == null) continue;
    sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  /** Categories, regions, units, and whether the real AI is connected. */
  meta: () => get('/api/meta'),

  /** Search the marketplace. `filters` mirrors the options in db.searchListings. */
  listings: filters => get(`/api/listings${qs(filters)}`),

  /** One listing, by id. Also increments its view counter. */
  listing: id => get(`/api/listings/${id}`),

  /** Publish a new waste listing. */
  createListing: body => post('/api/listings', body),

  /** Open "wanted" posts from people seeking material. */
  wants: () => get('/api/wants'),
  createWant: body => post('/api/wants', body),

  /** Score the whole marketplace against a described need. */
  matches: body => post('/api/matches', body),

  /** Platform-wide impact statistics. */
  stats: () => get('/api/stats'),

  /** Enquiries. */
  requests: () => get('/api/requests'),
  createRequest: body => post('/api/requests', body),
  acceptRequest: id => post(`/api/requests/${id}/accept`),

  /** Swipe interface: like / pass. */
  toggleSaved: listingId => post('/api/saved', { listingId }),
  pass: listingId => post('/api/passed', { listingId }),

  /** Everything belonging to the current demo user. */
  me: () => get('/api/me'),

  /** Send a turn to the AI assistant. */
  chat: body => post('/api/chat', body),

  /** Wipe and re-seed the demo data. */
  reset: () => post('/api/reset')
};
