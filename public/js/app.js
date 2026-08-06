/**
 * app.js
 * ------
 * The entry point. Loads metadata, registers every page with the router,
 * wires up the global chrome (theme toggle, mobile menu, reset button), and
 * starts the app.
 *
 * ADDING A NEW PAGE:
 *   1. Create public/js/pages/yourPage.js exporting `{ render(container) }`
 *   2. Import it below and call registerRoute('your-page', yourPage)
 *   3. Add <a href="#/your-page" data-route="your-page">Label</a> to the nav
 *      in index.html
 *   4. If the AI should be able to navigate there, add the name to the enum
 *      of the `navigate_to` tool in server/ai.js
 */

import { api } from './api.js';
import { setState } from './state.js';
import { registerRoute, startRouter, renderCurrent } from './router.js';
import { initChat } from './chat.js';
import { initDrawer } from './components.js';
import { toast } from './utils.js';

import { homePage } from './pages/home.js';
import { browsePage } from './pages/browse.js';
import { matchPage } from './pages/match.js';
import { listWastePage } from './pages/listWaste.js';
import { wantedPage } from './pages/wanted.js';
import { impactPage } from './pages/impact.js';
import { sdgPage } from './pages/sdg.js';
import { dashboardPage } from './pages/dashboard.js';

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

/**
 * Theme handling. We store an explicit choice in localStorage; if there is
 * none, the CSS follows the operating system via prefers-color-scheme.
 */
function initTheme() {
  const saved = localStorage.getItem('wasteops.theme');
  if (saved) document.documentElement.dataset.theme = saved;

  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('wasteops.theme', next);
  });
}

// ---------------------------------------------------------------------------
// Global chrome
// ---------------------------------------------------------------------------

function initChrome() {
  // Mobile hamburger menu
  document.getElementById('navToggle').addEventListener('click', () => {
    document.getElementById('mainNav').classList.toggle('open');
  });

  // "Reset demo data" in the footer — handy between practice runs of the pitch.
  document.getElementById('resetDemoBtn').addEventListener('click', async () => {
    if (!confirm('Delete all listings, enquiries and saved items, and restore the original demo data?')) return;
    await api.reset();
    setState({ highlighted: [], highlightNote: '', prefill: null, chatHistory: [] });
    toast('Demo data reset', 'success');
    renderCurrent();
  });
}

/**
 * Show which AI provider is live (Gemini, Claude) or that we're running the
 * built-in offline assistant. The tooltip is written to be actionable — if
 * there's no key, it says which one to set and where to get it.
 */
function updateAiBadge(meta) {
  const badge = document.getElementById('aiBadge');
  const label = badge.querySelector('.ai-badge-text');
  const ai = meta.ai;

  if (ai.available) {
    badge.classList.add('live');
    // Short name for the badge itself; the topbar is tight on space.
    label.textContent = ai.id === 'gemini' ? 'Gemini' : ai.id === 'claude' ? 'Claude' : 'AI live';
    badge.title = `${ai.label} — ${ai.model}${ai.effort ? ` (effort: ${ai.effort})` : ''}`;
  } else {
    badge.classList.add('offline');
    label.textContent = 'Demo AI';
    badge.title =
      `No API key found — using the built-in offline assistant.\n` +
      `For the full experience, set ${ai.suggestedEnvVar} in .env.\n` +
      `Free key: ${ai.suggestedKeyUrl}`;
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  initTheme();
  initChrome();
  initDrawer();
  initChat();

  // Register every page before the router starts.
  registerRoute('home', homePage);
  registerRoute('browse', browsePage);
  registerRoute('match', matchPage);
  registerRoute('list-waste', listWastePage);
  registerRoute('wanted', wantedPage);
  registerRoute('impact', impactPage);
  registerRoute('sdg', sdgPage);
  registerRoute('dashboard', dashboardPage);

  // Load categories, regions and AI status before rendering anything, because
  // several pages build dropdowns from them.
  try {
    const meta = await api.meta();
    setState({ meta });
    updateAiBadge(meta);
  } catch (err) {
    console.error('Could not load metadata:', err);
    document.getElementById('app').innerHTML =
      `<div class="page"><h2>Cannot reach the server</h2>
       <p class="muted">Make sure it is running: <code>npm start</code>, then reload this page.</p>
       <p class="muted small">${err.message}</p></div>`;
    return;
  }

  startRouter();
}

boot();
