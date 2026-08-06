/**
 * pages/match.js
 * --------------
 * The dating-app half of the product.
 *
 * You describe what you're trying to do — not what material you want — and the
 * matching engine scores every listing on relevance, distance, shelf life,
 * volume and cost. Then you swipe through the results.
 *
 * The "why this matched" list under each card is the important bit: it turns a
 * black-box score into something a farmer or a food technologist can argue with.
 */

import { h, render, num, tonnes, priceLabel, toast } from '../utils.js';
import { api } from '../api.js';
import { state, setMyRegion, categoryById } from '../state.js';
import { openListingDrawer } from '../components.js';
import { sendMessage } from '../chat.js';
import { categoryArt, emptyArt } from '../illustrations.js';

/** Match results for the current session, and where we are in the stack. */
let deck = [];
let index = 0;

export const matchPage = {
  render(container) {
    deck = [];
    index = 0;

    const stage = h('div', { id: 'swipeStage' });

    render(container,
      h('div', { class: 'page' },
        h('div', { class: 'page-head' },
          h('div', { class: 'eyebrow' }, 'Smart matching'),
          h('h1', { style: { fontSize: '2rem' } }, 'Tell us the goal, not the material'),
          h('p', { class: 'lede' },
            'Most people who need waste do not know what to ask for. Describe the outcome you want and the ' +
            'matcher will find the streams that fit — weighing distance, shelf life and volume, and telling you why.')
        ),
        needForm(stage),
        stage
      )
    );
  }
};

// ---------------------------------------------------------------------------

/** The "what are you trying to do?" form. */
function needForm(stage) {
  const description = h('textarea', {
    placeholder: 'e.g. "I want to make a natural garden fertiliser I can bag and sell at farmers markets. Small scale to start — maybe a tonne a month."',
    rows: '3'
  });

  const regionSelect = h('select', {},
    ...(state.meta?.regions || []).map(r =>
      h('option', { value: r.name, selected: r.name === state.myRegion }, r.name))
  );

  const tonnesInput = h('input', { type: 'number', min: '0', step: '0.1', placeholder: 'e.g. 5' });

  const categorySelect = h('select', {},
    h('option', { value: '' }, 'Any industry'),
    ...(state.meta?.categories || []).map(c => h('option', { value: c.id }, `${c.icon} ${c.label}`))
  );

  // A few one-click examples so the page is never a blank stare.
  const examples = [
    'I want to make compostable packaging from a starchy or fibrous waste stream.',
    'I need a low-cost calcium source to lift the pH on 200 hectares of pasture.',
    'I run a small skincare brand and want a distinctive New Zealand botanical ingredient.',
    'I need cheap high-fibre feed for a piggery, within an hour of my farm.',
    'I want to make natural dyes for a textile studio.'
  ];

  const submitBtn = h('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, 'Find matches');

  const form = h('form', {
    class: 'card card-pad',
    style: { marginBottom: '1.6rem' },
    onsubmit: async e => {
      e.preventDefault();
      if (!description.value.trim()) { toast('Describe what you are trying to do first', 'warn'); return; }
      setMyRegion(regionSelect.value);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Matching…';
      await loadMatches(stage, {
        description: description.value.trim(),
        region: regionSelect.value,
        category: categorySelect.value || undefined,
        tonnesWanted: tonnesInput.value ? Number(tonnesInput.value) : undefined
      });
      submitBtn.disabled = false;
      submitBtn.textContent = 'Find matches';
    }
  },
    h('div', { class: 'field' },
      h('label', {}, 'What are you trying to make, do, or solve?'),
      description,
      h('div', { class: 'hint' }, 'Plain English is fine. The more you say about the end use, the better the match.')
    ),
    h('div', { class: 'field-row' },
      h('div', { class: 'field' }, h('label', {}, 'Where are you based?'), regionSelect),
      h('div', { class: 'field' }, h('label', {}, 'Roughly how many tonnes?'), tonnesInput,
        h('div', { class: 'hint' }, 'Optional — helps size the match.')),
      h('div', { class: 'field' }, h('label', {}, 'Industry (optional)'), categorySelect)
    ),
    h('div', { class: 'row' },
      submitBtn,
      h('button', {
        class: 'btn btn-ghost', type: 'button',
        onclick: () => sendMessage(
          description.value.trim()
            ? `Help me refine this need before I search: "${description.value.trim()}". I'm in ${regionSelect.value}.`
            : "I don't know what waste material I need. Ask me questions to work it out.")
      }, '✦ Not sure? Ask the AI Assistant')
    ),
    h('div', { class: 'chip-row', style: { marginTop: '.9rem' } },
      h('span', { class: 'small muted', style: { alignSelf: 'center' } }, 'Try:'),
      ...examples.map(ex =>
        h('button', {
          class: 'chip', type: 'button',
          onclick: () => { description.value = ex; description.focus(); }
        }, ex.length > 46 ? ex.slice(0, 44) + '…' : ex))
    )
  );

  return form;
}

// ---------------------------------------------------------------------------

/** Fetch scored matches and build the swipe deck. */
async function loadMatches(stage, need) {
  stage.replaceChildren(h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Scoring every listing…'));

  try {
    const { matches } = await api.matches({ ...need, limit: 15, minScore: 18 });
    deck = matches;
    index = 0;

    if (!deck.length) {
      stage.replaceChildren(
        h('div', { class: 'empty' },
          h('div', { class: 'empty-art', html: emptyArt() }),
          h('h3', {}, 'No strong matches yet'),
          h('p', { class: 'muted' },
            'Nothing on the marketplace fits that closely right now. Post a "wanted" request so producers can find you, ' +
            'or ask the AI Assistant to suggest an adjacent material.'),
          h('div', { class: 'row', style: { justifyContent: 'center' } },
            h('a', { class: 'btn btn-primary', href: '#/wanted' }, 'Post a wanted request'),
            h('button', {
              class: 'btn btn-secondary',
              onclick: () => sendMessage(`Nothing matched this need on Waste Opportunities: "${need.description}". What adjacent materials should I consider, and is there anything close in ${need.region}?`)
            }, '✦ Ask the AI Assistant')
          )
        )
      );
      return;
    }

    renderDeck(stage);
  } catch (err) {
    stage.replaceChildren(h('div', { class: 'empty' }, `Matching failed: ${err.message}`));
  }
}

/** Draw the current card plus the two behind it, and the control buttons. */
function renderDeck(stage) {
  if (index >= deck.length) {
    stage.replaceChildren(
      h('div', { class: 'empty' },
        h('div', { class: 'big' }, '✅'),
        h('h3', {}, "That's the whole stack"),
        h('p', { class: 'muted' }, 'Everything you saved is waiting in your Dashboard.'),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('a', { class: 'btn btn-primary', href: '#/dashboard' }, 'View saved matches'),
          h('button', { class: 'btn btn-secondary', onclick: () => { index = 0; renderDeck(stage); } }, 'Start again')
        )
      )
    );
    return;
  }

  const visible = deck.slice(index, index + 3);
  const cards = visible.map((m, i) => matchCard(m, i));

  const stack = h('div', { class: 'swipe-stage' }, ...cards.reverse());

  const controls = h('div', { class: 'swipe-controls' },
    h('button', {
      class: 'swipe-btn pass', title: 'Not for me', 'aria-label': 'Pass',
      onclick: () => swipe(stage, 'left')
    }, '✕'),
    h('button', {
      class: 'swipe-btn info', title: 'See full details', 'aria-label': 'Details',
      onclick: () => openListingDrawer(deck[index].listing.id)
    }, 'ℹ'),
    h('button', {
      class: 'swipe-btn save', title: 'Save this one', 'aria-label': 'Save',
      onclick: () => swipe(stage, 'right')
    }, '♥')
  );

  const progress = h('p', { class: 'center muted small', style: { marginTop: '.8rem' } },
    `${index + 1} of ${deck.length} matches`);

  stage.replaceChildren(stack, controls, progress);
}

/** Build one swipe card from a scored match. */
function matchCard(match, depth) {
  const l = match.listing;
  const cat = categoryById(l.category);
  const cls = depth === 0 ? 'top' : depth === 1 ? 'behind-1' : 'behind-2';

  return h('article', { class: `swipe-card ${cls}`, dataset: { depth: String(depth) } },
    h('div', { class: 'swipe-hero' },
      // Illustration of the material, with the category and score over it.
      // No large emoji here any more — the illustration carries the visual, and
      // showing both was redundant.
      h('div', { class: 'swipe-art', html: categoryArt(l.category) }),
      h('div', {},
        h('div', { class: 'badge' }, `${cat.icon} ${cat.label}`)
      ),
      h('div', { class: 'score-ring', style: { '--pct': String(match.score), width: '62px', height: '62px' } },
        h('span', { style: { fontSize: '.85rem' } }, `${match.score}%`))
    ),
    h('div', { class: 'swipe-body' },
      h('h3', {}, l.title),
      h('div', { class: 'row' },
        h('span', { class: 'badge' }, `${num(l.quantity.amount)} ${l.quantity.unit} ${l.quantity.frequency}`),
        // Suppress "· 0 km" — a listing in your own region measures as zero
        // between regional centres, which reads as a bug rather than as "near".
        h('span', { class: 'badge' },
          `📍 ${l.city || l.region}${match.distanceKm ? ` · ${num(match.distanceKm)} km` : ''}`),
        h('span', { class: 'badge badge-green' }, priceLabel(l)),
        l.visibility === 'private' ? h('span', { class: 'badge badge-clay' }, '🔒 Private match') : null
      ),
      h('p', { class: 'small muted', style: { margin: 0 } }, (l.description || '').slice(0, 190) + '…'),

      h('div', { class: 'swipe-why' },
        h('strong', {}, 'Why this matched'),
        h('ul', {}, ...match.reasons.slice(0, 4).map(r => h('li', {}, r)))
      ),

      l.suggestedUses?.length
        ? h('div', { class: 'small' },
            h('strong', {}, 'Common uses: '),
            h('span', { class: 'muted' }, l.suggestedUses.slice(0, 3).join(' · ')))
        : null,

      h('div', { class: 'row', style: { marginTop: 'auto', paddingTop: '.6rem' } },
        h('button', {
          class: 'btn btn-secondary btn-sm',
          onclick: e => { e.stopPropagation(); openListingDrawer(l.id); }
        }, 'Full details'),
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: e => {
            e.stopPropagation();
            sendMessage(`I'm looking at "${l.title}" (id ${l.id}) on the matcher. Is this actually a good fit for me, and what would I need to process it?`);
          }
        }, '✦ Ask about it')
      )
    )
  );
}

/**
 * Animate the top card away, record the decision, then advance.
 */
function swipe(stage, direction) {
  const top = stage.querySelector('.swipe-card.top');
  const match = deck[index];
  if (!top || !match) return;

  top.classList.add(direction === 'right' ? 'fly-right' : 'fly-left');

  if (direction === 'right') {
    api.toggleSaved(match.listing.id).catch(() => {});
    toast(`Saved "${match.listing.title.slice(0, 40)}…"`, 'success');
  } else {
    api.pass(match.listing.id).catch(() => {});
  }

  setTimeout(() => { index++; renderDeck(stage); }, 320);
}
