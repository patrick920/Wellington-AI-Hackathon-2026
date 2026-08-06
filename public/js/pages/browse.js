/**
 * pages/browse.js
 * ---------------
 * The marketplace. Filter bar plus a grid of listing cards.
 *
 * Important: the filter state lives in state.filters, NOT in the DOM. That is
 * what lets the AI change the filters (via its apply_marketplace_filters tool)
 * and have the page respond exactly as if a human had typed them.
 */

import { h, render, num, debounce, loadingBlock } from '../utils.js';
import { api } from '../api.js';
import { state, setState, setMyRegion } from '../state.js';
import { listingGrid } from '../components.js';
import { sendMessage } from '../chat.js';

export const browsePage = {
  render(container) {
    const resultsEl = h('div', { id: 'browseResults' }, loadingBlock('Searching…'));
    const countEl = h('span', { class: 'muted small' }, '');

    render(container,
      h('div', { class: 'page' },
        h('div', { class: 'page-head' },
          h('div', { class: 'eyebrow' }, 'Marketplace'),
          h('h1', { style: { fontSize: '2rem' } }, 'Browse available waste'),
          h('p', { class: 'lede' },
            'Everything currently available across Aotearoa. Filter by material, industry, region and distance — ' +
            'or ask the AI Assistant to do it for you.')
        ),
        filterBar(() => runSearch(resultsEl, countEl)),
        highlightBanner(),
        h('div', { class: 'spread', style: { marginBottom: '.8rem' } },
          countEl,
          h('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: () => sendMessage(
              `I'm browsing the Waste Opportunities marketplace${state.filters.query ? ` for "${state.filters.query}"` : ''}` +
              `${state.filters.region ? ` near ${state.filters.region}` : ''}. Help me narrow it down — ask me what I need it for.`)
          }, '✦ Ask the AI Assistant to narrow this down')
        ),
        resultsEl
      )
    );

    runSearch(resultsEl, countEl);
  }
};

/** Banner shown when the AI has picked out a shortlist. */
function highlightBanner() {
  if (!state.highlighted.length) return null;
  return h('div', {
    class: 'card card-pad',
    style: { marginBottom: '1rem', borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
  },
    h('div', { class: 'spread' },
      h('div', {},
        h('strong', {}, '✦ AI Assistant shortlisted ', String(state.highlighted.length), ' listing',
          state.highlighted.length === 1 ? '' : 's'),
        state.highlightNote ? h('div', { class: 'small' }, state.highlightNote) : null
      ),
      h('button', {
        class: 'btn btn-secondary btn-sm',
        onclick: () => { setState({ highlighted: [], highlightNote: '' }); location.reload(); }
      }, 'Clear')
    )
  );
}

/**
 * The filter bar. Every control writes straight into state.filters and then
 * calls `onChange`, so there is exactly one source of truth.
 */
function filterBar(onChange) {
  const f = state.filters;
  const meta = state.meta;

  const update = (key, value) => {
    setState({ filters: { ...state.filters, [key]: value } });
    onChange();
  };

  const queryInput = h('input', {
    type: 'text', value: f.query, placeholder: 'Search material, use, or keyword…',
    oninput: debounce(e => update('query', e.target.value), 280)
  });

  const categorySelect = h('select', { onchange: e => update('category', e.target.value) },
    h('option', { value: '' }, 'All industries'),
    ...(meta?.categories || []).map(c =>
      h('option', { value: c.id, selected: f.category === c.id }, `${c.icon} ${c.label}`))
  );

  // The distance radius only means anything once a region is chosen, so it
  // starts disabled. It is declared BEFORE the region select so the region
  // handler can enable it — see syncDistanceControl below.
  const distanceSelect = h('select', {
    onchange: e => update('maxDistanceKm', e.target.value)
  },
    h('option', { value: '' }, 'That region only'),
    ...[100, 250, 500, 1000].map(km =>
      h('option', { value: String(km), selected: String(f.maxDistanceKm) === String(km) }, `Within ${km} km`))
  );

  /**
   * Enable/disable the distance control to match whether a region is selected.
   *
   * This has to be an explicit DOM update rather than a re-render: the filter
   * bar is built once, so without this the control kept whatever disabled state
   * it had when the page first rendered. Choosing a region appeared to do
   * nothing, which is exactly the bug this fixes.
   */
  function syncDistanceControl() {
    const hasRegion = Boolean(state.filters.region);
    distanceSelect.disabled = !hasRegion;
    distanceSelect.options[0].textContent = hasRegion ? 'That region only' : 'Pick a region first';
    if (!hasRegion) distanceSelect.value = '';
  }

  const regionSelect = h('select', {
    onchange: e => {
      const region = e.target.value;
      if (region) setMyRegion(region);

      // Clearing the region must also clear any radius, otherwise a stale
      // "within 100 km" would silently keep filtering with nothing to measure from.
      const patch = region ? { region } : { region: '', maxDistanceKm: '' };
      setState({ filters: { ...state.filters, ...patch } });

      syncDistanceControl();
      onChange();
    }
  },
    h('option', { value: '' }, 'Anywhere in NZ'),
    ...(meta?.regions || []).map(r =>
      h('option', { value: r.name, selected: f.region === r.name }, r.name))
  );

  // Set the initial state to match whatever region the filters already carry
  // (the AI can arrive here having already set one).
  syncDistanceControl();

  const sortSelect = h('select', { onchange: e => update('sort', e.target.value) },
    ...[
      ['newest', 'Newest first'],
      ['closest', 'Closest first'],
      ['largest', 'Largest volume'],
      ['urgent', 'Most urgent']
    ].map(([v, label]) => h('option', { value: v, selected: f.sort === v }, label))
  );

  // Price-type quick chips — faster than a dropdown for a common filter.
  const priceChips = h('div', { class: 'chip-row' },
    ...[
      ['', 'Any price'],
      ['free', 'Free'],
      ['pay-to-take', 'They pay you'],
      ['negotiable', 'Negotiable'],
      ['paid', 'For sale']
    ].map(([value, label]) =>
      h('button', {
        class: `chip${f.priceType === value ? ' active' : ''}`,
        onclick: e => {
          update('priceType', value);
          e.target.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
          e.target.classList.add('active');
        }
      }, label))
  );

  return h('div', { class: 'filters' },
    h('div', { class: 'filters-row' },
      h('div', { class: 'field' }, h('label', {}, 'Search'), queryInput),
      h('div', { class: 'field' }, h('label', {}, 'Industry'), categorySelect),
      h('div', { class: 'field' }, h('label', {}, 'Your region'), regionSelect),
      h('div', { class: 'field' }, h('label', {}, 'Distance'), distanceSelect),
      h('div', { class: 'field' }, h('label', {}, 'Sort'), sortSelect)
    ),
    h('div', { class: 'spread' },
      priceChips,
      h('button', {
        class: 'btn btn-ghost btn-sm',
        onclick: () => {
          setState({
            filters: { query: '', category: '', region: '', maxDistanceKm: '', priceType: '', sort: 'newest' },
            highlighted: [], highlightNote: ''
          });
          location.reload();
        }
      }, 'Clear all filters')
    )
  );
}

/** Run the search against the API and paint the results. */
async function runSearch(resultsEl, countEl) {
  resultsEl.replaceChildren(loadingBlock('Searching…'));
  try {
    const { listings, count } = await api.listings(state.filters);

    // Put AI-highlighted listings first so the shortlist is impossible to miss.
    const ordered = state.highlighted.length
      ? [...listings].sort((a, b) =>
          (state.highlighted.includes(b.id) ? 1 : 0) - (state.highlighted.includes(a.id) ? 1 : 0))
      : listings;

    countEl.textContent = `${num(count)} listing${count === 1 ? '' : 's'}`;
    resultsEl.replaceChildren(listingGrid(ordered));
  } catch (err) {
    resultsEl.replaceChildren(h('div', { class: 'empty' }, `Could not load listings: ${err.message}`));
  }
}
