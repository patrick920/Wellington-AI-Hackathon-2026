/**
 * router.js
 * ---------
 * A hash-based single-page router. Using `#/browse` style URLs means the whole
 * site works from a plain static file server with no rewrite rules, and the
 * back button behaves properly.
 *
 * Pages register themselves here; the router calls a page's `render(container)`
 * whenever the URL changes.
 */

import { setState, state } from './state.js';

/** route name -> { render(container, params) } */
const routes = new Map();

/** Register a page. Called once per page module at startup. */
export function registerRoute(name, page) {
  routes.set(name, page);
}

/** Parse "#/browse?query=sawdust" into { name: 'browse', params: {...} }. */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, queryString] = raw.split('?');
  const name = path || 'home';
  const params = Object.fromEntries(new URLSearchParams(queryString || ''));
  return { name, params };
}

/**
 * Go to a page. `replace: true` avoids adding a history entry (used when the
 * AI navigates so the back button still returns the user where they expect).
 */
export function navigate(name, params = {}, { replace = false } = {}) {
  const qs = new URLSearchParams(params).toString();
  const hash = `#/${name}${qs ? `?${qs}` : ''}`;

  // If we are already on this exact URL, setting location.hash does nothing and
  // no hashchange event fires — so render manually. This matters when the AI
  // applies new filters while the user is already sitting on the Browse page.
  const alreadyHere = location.hash === hash;

  if (replace || alreadyHere) {
    history.replaceState(null, '', hash);
    renderCurrent();
  } else {
    location.hash = hash;
  }
}

/** Highlight the active link in the top navigation. */
function updateNavHighlight(name) {
  document.querySelectorAll('#mainNav a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === name);
  });
}

/** Render whichever page the URL currently points at. */
export function renderCurrent() {
  const { name, params } = parseHash();
  const page = routes.get(name) || routes.get('home');
  const container = document.getElementById('app');

  setState({ currentPage: routes.has(name) ? name : 'home' });
  updateNavHighlight(state.currentPage);

  // Close the mobile menu on navigation
  document.getElementById('mainNav')?.classList.remove('open');

  // Jump to the top of the new page.
  // We must bypass the `scroll-behavior: smooth` rule in the stylesheet —
  // an animated scroll would still be running while the new page renders,
  // which leaves the user staring at blank space below the content.
  const html = document.documentElement;
  const previousBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);
  html.style.scrollBehavior = previousBehavior;

  try {
    page.render(container, params);
  } catch (err) {
    console.error('[router] Page render failed:', err);
    container.innerHTML = `<div class="page"><h2>Something went wrong</h2><p class="muted">${err.message}</p></div>`;
  }
}

/** Start listening for URL changes. */
export function startRouter() {
  // Stop the browser restoring the previous scroll position when the hash
  // changes. Because our pages render asynchronously, that restoration lands
  // after our own scroll-to-top and drops the user halfway down a new page.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  window.addEventListener('hashchange', renderCurrent);
  if (!location.hash) location.hash = '#/';
  renderCurrent();
}
