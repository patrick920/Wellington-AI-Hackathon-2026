/**
 * state.js
 * --------
 * A single shared object holding everything the pages need to know about.
 *
 * Deliberately simple: one mutable object plus a subscribe() function. There is
 * no framework here — pages read `state` when they render, and call
 * `setState()` when something changes, which re-renders the current page.
 */

export const state = {
  /** Metadata loaded once at startup (categories, regions, AI status). */
  meta: null,

  /** Current Browse-page filters. The AI can change these via its tools. */
  filters: {
    query: '',
    category: '',
    region: '',
    maxDistanceKm: '',
    priceType: '',
    sort: 'newest'
  },

  /** Listing ids the AI has highlighted as recommendations. */
  highlighted: [],
  highlightNote: '',

  /** Values the AI has pre-filled into the "List your waste" form. */
  prefill: null,

  /** Chat transcript kept in memory for the session. */
  chatHistory: [],

  /** Which page we are on — passed to the AI so it can be context-aware. */
  currentPage: 'home',

  /** The user's own region, used for distance calculations across the app. */
  myRegion: localStorage.getItem('wasteops.region') || 'Bay of Plenty'
};

const listeners = new Set();

/** Subscribe to state changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Merge changes into state and notify subscribers. */
export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) fn(state);
}

/** Persist and update the user's home region. */
export function setMyRegion(region) {
  localStorage.setItem('wasteops.region', region);
  setState({ myRegion: region });
}

/** Look up a category record (for its label and icon) by id. */
export function categoryById(id) {
  return state.meta?.categories.find(c => c.id === id)
    || { id, label: id || 'Other', icon: '📦' };
}
