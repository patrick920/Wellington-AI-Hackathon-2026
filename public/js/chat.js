/**
 * chat.js
 * -------
 * The AI assistant panel, and — more importantly — the ACTION EXECUTOR.
 *
 * The server returns two things from /api/chat:
 *   reply   — text to show the user
 *   actions — a list of things the AI decided to DO to the website
 *
 * `runActions()` below is what makes the AI feel like part of the product
 * rather than a chat box glued to the side. When Claude calls its
 * `apply_marketplace_filters` tool, the filters really change; when it calls
 * `prefill_listing_form`, the form really fills in.
 */

import { h, miniMarkdown, toast } from './utils.js';
import { state, setState } from './state.js';
import { api } from './api.js';
import { navigate } from './router.js';
import { openListingDrawer } from './components.js';

let sending = false;

// --- Element shortcuts ------------------------------------------------------
const el = {
  panel: () => document.getElementById('chatPanel'),
  scrim: () => document.getElementById('chatScrim'),
  messages: () => document.getElementById('chatMessages'),
  input: () => document.getElementById('chatInput'),
  form: () => document.getElementById('chatForm'),
  send: () => document.getElementById('chatSend'),
  suggestions: () => document.getElementById('chatSuggestions'),
  strip: () => document.getElementById('chatActionsStrip'),
  status: () => document.getElementById('chatStatus')
};

// ---------------------------------------------------------------------------
// Opening / closing
// ---------------------------------------------------------------------------

export function openChat() {
  el.panel().classList.add('open');
  el.panel().setAttribute('aria-hidden', 'false');
  el.scrim().hidden = false;
  setTimeout(() => el.input().focus(), 260);
}

export function closeChat() {
  el.panel().classList.remove('open');
  el.panel().setAttribute('aria-hidden', 'true');
  el.scrim().hidden = true;
}

// ---------------------------------------------------------------------------
// Rendering messages
// ---------------------------------------------------------------------------

/** Add a user message bubble. */
function addUserMessage(text) {
  el.messages().append(h('div', { class: 'msg user' }, text));
  scrollToBottom();
}

/**
 * Add an assistant message bubble.
 * `toolsUsed` is shown as small chips so the audience can SEE the AI reaching
 * into the real marketplace — a genuinely useful thing to point at in a pitch.
 */
function addAssistantMessage(text, toolsUsed = []) {
  const bubble = h('div', { class: 'msg assistant', html: miniMarkdown(text) });
  if (toolsUsed.length) {
    const unique = [...new Set(toolsUsed)];
    bubble.append(h('div', { class: 'msg-tools' },
      h('span', { class: 'tool-chip' }, '🔧 used:'),
      ...unique.map(t => h('span', { class: 'tool-chip' }, t))
    ));
  }
  el.messages().append(bubble);
  scrollToBottom();
}

/** Animated "typing" indicator, removed when the reply arrives. */
function addTypingIndicator() {
  const node = h('div', { class: 'msg assistant typing' }, h('span'), h('span'), h('span'));
  el.messages().append(node);
  scrollToBottom();
  return node;
}

function scrollToBottom() {
  const m = el.messages();
  m.scrollTop = m.scrollHeight;
}

/** Show a one-line summary of what the AI just did to the site. */
function showActionStrip(actions) {
  const strip = el.strip();
  if (!actions.length) { strip.hidden = true; return; }

  const describe = a => ({
    navigate: `→ opened the ${a.page} page`,
    applyFilters: '→ applied marketplace filters',
    openListing: '→ opened a listing',
    highlight: `→ highlighted ${a.listingIds?.length || 0} listings`,
    prefillForm: '→ filled in your listing form',
    listingCreated: '→ published your listing',
    wantCreated: '→ posted your wanted request',
    requestSent: '→ sent your enquiry'
  }[a.type] || `→ ${a.type}`);

  strip.replaceChildren(
    h('span', {}, '⚡ AI Assistant changed the page:'),
    ...actions.map(a => h('span', {}, describe(a)))
  );
  strip.hidden = false;
  // Fade the strip out after a few seconds so it doesn't clutter the panel
  clearTimeout(showActionStrip._t);
  showActionStrip._t = setTimeout(() => { strip.hidden = true; }, 6000);
}

// ---------------------------------------------------------------------------
// THE ACTION EXECUTOR — where the AI drives the website
// ---------------------------------------------------------------------------

/**
 * Run the list of actions the AI returned, in order.
 * Each case here corresponds to a UI tool defined in server/ai.js.
 */
async function runActions(actions) {
  for (const action of actions) {
    switch (action.type) {

      // Move the user to a different page of the site.
      case 'navigate':
        navigate(action.page);
        break;

      // Set the Browse filters and show the results.
      case 'applyFilters': {
        const f = action.filters || {};
        setState({
          filters: {
            ...state.filters,
            query: f.query ?? state.filters.query,
            category: f.category ?? '',
            region: f.region ?? '',
            maxDistanceKm: f.maxDistanceKm ?? '',
            priceType: f.priceType ?? '',
            sort: f.sort ?? 'newest'
          }
        });
        navigate('browse');
        break;
      }

      // Pull up one listing's full detail.
      case 'openListing':
        navigate('browse');
        // Small delay so the page has rendered before the drawer slides over it
        setTimeout(() => openListingDrawer(action.listingId), 220);
        break;

      // Mark specific listings as AI recommendations.
      case 'highlight':
        setState({ highlighted: action.listingIds || [], highlightNote: action.note || '' });
        // If the user is already looking at Browse, repaint so the shortlist
        // appears immediately instead of on their next navigation.
        if (state.currentPage === 'browse') navigate('browse');
        break;

      // Fill in the "List your waste" form and take the user there to review.
      case 'prefillForm':
        setState({ prefill: action.values || {} });
        navigate('list-waste');
        toast('The AI Assistant filled in the form — review it before publishing', 'success');
        break;

      // Something was created server-side; refresh whatever page we're on.
      case 'listingCreated':
        toast('Your listing is live on the marketplace', 'success');
        navigate('dashboard');
        break;

      case 'wantCreated':
        toast('Your wanted request has been posted', 'success');
        navigate('wanted');
        break;

      case 'requestSent':
        toast('Enquiry sent to the producer', 'success');
        break;

      default:
        console.warn('[chat] Unknown action from AI:', action);
    }
  }
}

// ---------------------------------------------------------------------------
// Sending a message
// ---------------------------------------------------------------------------

/**
 * Send one turn to the assistant.
 * Exported so other parts of the UI (hero prompt box, "Ask the AI Assistant about this"
 * buttons) can start a conversation.
 */
export async function sendMessage(text) {
  const message = (text ?? el.input().value).trim();
  if (!message || sending) return;

  sending = true;
  openChat();
  el.suggestions().hidden = true;
  el.input().value = '';
  el.input().style.height = 'auto';
  el.send().disabled = true;

  addUserMessage(message);
  const typing = addTypingIndicator();

  try {
    const result = await api.chat({
      message,
      history: state.chatHistory,
      page: state.currentPage
    });

    typing.remove();
    addAssistantMessage(result.reply, result.toolsUsed || []);

    // Keep the transcript so the AI has conversational memory.
    state.chatHistory.push({ role: 'user', content: message });
    state.chatHistory.push({ role: 'assistant', content: result.reply });
    if (state.chatHistory.length > 24) state.chatHistory.splice(0, state.chatHistory.length - 24);

    // Let the AI act on the website.
    if (result.actions?.length) {
      showActionStrip(result.actions);
      await runActions(result.actions);
    }

    // Reflect the active provider in the header so it's never a mystery which
    // brain answered — especially useful when a provider errors and we
    // silently degrade to the offline assistant mid-demo.
    el.status().textContent = result.offline
      ? 'Offline demo assistant'
      : 'Your circular-economy matchmaker';

  } catch (err) {
    typing.remove();
    addAssistantMessage(`Sorry — I couldn't reach the server. ${err.message}`);
  } finally {
    sending = false;
    el.send().disabled = false;
    el.input().focus();
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** Wire up every chat control. Called once at startup from app.js. */
export function initChat() {
  document.getElementById('openChatBtn').addEventListener('click', openChat);
  document.getElementById('closeChatBtn').addEventListener('click', closeChat);
  el.scrim().addEventListener('click', closeChat);

  el.form().addEventListener('submit', e => { e.preventDefault(); sendMessage(); });

  // Enter sends, Shift+Enter makes a new line — standard chat behaviour.
  el.input().addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Auto-grow the textarea as the user types.
  el.input().addEventListener('input', () => {
    const t = el.input();
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 140) + 'px';
  });

  // Quick-start suggestion buttons.
  el.suggestions().querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.prompt));
  });

  // Escape closes the panel.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && el.panel().classList.contains('open')) closeChat();
  });

  // Any part of the app can start a conversation by firing this event.
  window.addEventListener('wasteops:ask', e => sendMessage(e.detail.message));

  // Opening greeting.
  addAssistantMessage(
    "Kia ora! I'm the **AI Assistant** for Waste Opportunities.\n\n" +
    "I can search the live marketplace, work out which waste stream suits a project, " +
    "post a listing for you, and drive this website while we talk.\n\n" +
    "What are you trying to do — get rid of something, or find something?"
  );
}
